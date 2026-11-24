-- Watching the code emails the Send Email hook hands to pg_net (ADR 0082, addendum), expand only.
--
-- pg_net posts after commit, after Auth has answered, so Resend refusing an email (a bad key, a
-- domain problem) is silent: the player reads "We sent a code" and none comes. pg_net keeps each
-- answer in `net._http_response` for only 6 hours (`pg_net.ttl`), with no URL to tell our sends
-- from any other. So the hook now notes each send's request id in `game.mail_sends`, and its answer
-- is copied there before pg_net drops it: by the next send, and by `/api/v1/health` (every few
-- minutes where an uptime monitor reads it). No address, no code and no player: an id, a time and
-- the answer's status. Kept 7 days.
--
-- `game.mail_outcomes(hours)` counts the last `hours`' sends, refused ones and ones whose answer
-- nobody saw in time, reading only (the daily check, read-only on both projects);
-- `game.mail_watch()` copies answers first, then counts 24 hours (health, as the API's role).

create table game.mail_sends (
  request_id bigint primary key,
  sent_at timestamptz not null default now(),
  -- The answer, once copied: its HTTP status (null for none: a timeout or a connection error).
  answered boolean not null default false,
  status_code integer
);
create index mail_sends_sent_at on game.mail_sends (sent_at);

comment on table game.mail_sends is
  'Each code email handed to pg_net and its answer, no address (ADR 0082): kept 7 days.';

alter table game.mail_sends enable row level security;
revoke all on game.mail_sends from anon, authenticated;

-- Copies pg_net's answers to sends not yet answered, and drops sends older than 7 days.
create function game.note_mail_answers() returns void
language sql security definer set search_path = '' as $$
  with dropped as (delete from game.mail_sends where sent_at < now() - interval '7 days')
  update game.mail_sends sends
  set answered = true, status_code = response.status_code
  from net._http_response response
  where response.id = sends.request_id and not sends.answered
$$;
revoke all on function game.note_mail_answers() from public, anon, authenticated;

-- The last `hours`' sends: all of them, those refused or never answered (a status outside 2xx, a
-- timeout, a connection error), and those whose answer pg_net dropped before anyone copied it.
-- A send younger than 2 minutes with no answer yet is on its way, in none of the last two.
create function game.mail_outcomes(hours integer default 24)
returns table (sent integer, failed integer, unseen integer)
language sql stable security definer set search_path = '' as $$
  select
    count(*)::int,
    count(*) filter (
      where answer.seen and (answer.status is null or answer.status not between 200 and 299)
    )::int,
    count(*) filter (
      where not answer.seen and sends.sent_at < now() - interval '2 minutes'
    )::int
  from game.mail_sends sends
  left join net._http_response response on response.id = sends.request_id
  cross join lateral (
    select
      sends.answered or response.id is not null as seen,
      case when sends.answered then sends.status_code else response.status_code end as status
  ) answer
  where sends.sent_at > now() - make_interval(hours => hours)
$$;
revoke all on function game.mail_outcomes(integer) from public, anon, authenticated;

-- Health's read (as the API's role): copy answers, then count the last day.
create function game.mail_watch()
returns table (sent integer, failed integer, unseen integer)
language plpgsql security definer set search_path = '' as $$
begin
  perform game.note_mail_answers();
  return query select * from game.mail_outcomes(24);
end
$$;
revoke all on function game.mail_watch() from public, anon, authenticated;
grant execute on function game.mail_watch() to game_api;

-- Send Email hook: as before (20261124090000_auth_hooks.sql), noting each send's request id.
create or replace function public.ballbattle_send_email(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  action text := event -> 'email_data' ->> 'email_action_type';
  code text := event -> 'email_data' ->> 'token';
  recipient text;
  relay game.mail_relay;
  api_key text;
  subject constant text := 'Your BallBattle code';
  html text;
  plain text;
  request bigint;
begin
  if action = 'email_change' then
    -- Only a guest adding an address (it has none), so one code to the new one.
    if coalesce(event -> 'user' ->> 'email', '') <> '' then
      return game.auth_refusal(403, 'Codes are sent by the game');
    end if;
    recipient := event -> 'user' ->> 'new_email';
  elsif action in ('signup', 'magiclink') then
    recipient := event -> 'user' ->> 'email';
  else
    return game.auth_refusal(403, 'Codes are sent by the game');
  end if;
  if coalesce(recipient, '') = '' or coalesce(code, '') !~ '^[0-9]{6}$' then
    return game.auth_refusal(403, 'Codes are sent by the game');
  end if;
  if not game.take_auth_ticket('email', game.email_ticket_subject(recipient)) then
    return game.auth_refusal(403, 'Codes are sent by the game');
  end if;

  select * into relay from game.mail_relay;
  if not found then
    return game.auth_refusal(500, 'No mail relay is set');
  end if;

  html := '<h2>Your BallBattle code</h2>'
    || '<p>Type this code in the game to sign in:</p>'
    || '<p style="font-size: 28px; font-weight: 700; letter-spacing: 4px">' || code || '</p>'
    || '<p>It works for 10 minutes. If you didn''t ask for it, ignore this email: nobody can sign '
    || 'in without the code.</p>';
  plain := 'Your BallBattle code is ' || code || E'.\n\nType it in the game to sign in. It works for '
    || E'10 minutes. If you didn''t ask for it, ignore this email: nobody can sign in without the code.\n';

  if relay.kind = 'resend' then
    select decrypted_secret into api_key from vault.decrypted_secrets where name = relay.key_name;
    if api_key is null then
      return game.auth_refusal(500, 'The mail relay has no key');
    end if;
    select net.http_post(
      url := relay.url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', relay.sender_name || ' <' || relay.sender_email || '>',
        'to', jsonb_build_array(recipient),
        'subject', subject,
        'html', html,
        'text', plain
      )
    ) into request;
  else
    select net.http_post(
      url := relay.url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'From', jsonb_build_object('Email', relay.sender_email, 'Name', relay.sender_name),
        'To', jsonb_build_array(jsonb_build_object('Email', recipient)),
        'Subject', subject,
        'HTML', html,
        'Text', plain
      )
    ) into request;
  end if;
  perform game.note_mail_answers();
  insert into game.mail_sends (request_id) values (request);
  return '{}'::jsonb;
end
$$;
