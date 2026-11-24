-- Auth refuses what the game didn't start (ADR 0082, decision 2), expand only. Once the browser
-- holds a publishable key (for the Realtime poke), anyone can call Auth's `/otp` and `/signup`
-- straight from their own address, skipping our counts (ADR 0079). Two Auth hooks close that:
--
-- - **Before a user is created**, a sign-up must carry a ticket our functions wrote just before
--   calling Auth (`bb_ticket` in its user metadata), used once; or come from Google, whose ID token
--   Auth has checked against our client.
-- - **Before an email is sent**, its address must have a ticket our functions wrote just before
--   asking for the code, used once. Only a sign-in or sign-up code, or a guest adding an address,
--   is ever sent.
--
-- With the Send Email hook on, Auth sends no email of its own: the hook does, through pg_net (after
-- commit, from Sydney) to Resend's API, or locally to Mailpit, as `game.mail_relay` says. A
-- project's hooks are switched on in its dashboard (Authentication > Auth Hooks) only once its relay
-- row and key are set; until then this changes nothing there.

create extension if not exists pg_net with schema extensions;

-- What the functions expect Auth to do in the next minute. `subject` is the ticket itself for a
-- sign-up and a digest of the address for an email (no address is kept). A ticket is deleted when
-- used; expired ones go with the next one written.
create table game.auth_tickets (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('signup', 'email')),
  subject text not null,
  expires_at timestamptz not null
);
create index auth_tickets_subject on game.auth_tickets (kind, subject);

comment on table game.auth_tickets is
  'Sign-ups and emails the functions asked Auth for, each usable once for a minute (ADR 0082).';

alter table game.auth_tickets enable row level security;
revoke all on game.auth_tickets from anon, authenticated;

-- The digest an email ticket is kept under: the address in lower case, as Auth lowercases it.
create function game.email_ticket_subject(address text) returns text
language sql immutable security definer set search_path = '' as $$
  select encode(extensions.digest(lower(address), 'sha256'), 'hex')
$$;

-- Writes one ticket (and drops expired ones). Only the functions call it.
create function game.expect_auth(ticket_kind text, ticket text) returns void
language sql security definer set search_path = '' as $$
  with expired as (delete from game.auth_tickets where expires_at < now())
  insert into game.auth_tickets (kind, subject, expires_at)
  values (
    ticket_kind,
    case ticket_kind when 'email' then game.email_ticket_subject(ticket) else ticket end,
    now() + interval '60 seconds'
  )
$$;
revoke all on function game.expect_auth(text, text) from public, anon, authenticated;
grant execute on function game.expect_auth(text, text) to game_api;

-- Uses one live ticket; true if there was one.
create function game.take_auth_ticket(ticket_kind text, ticket_subject text) returns boolean
language sql security definer set search_path = '' as $$
  with taken as (
    delete from game.auth_tickets
    where id = (
      select id from game.auth_tickets
      where kind = ticket_kind and subject = ticket_subject and expires_at > now()
      order by expires_at
      limit 1
      for update skip locked
    )
    returning id
  )
  select exists (select 1 from taken)
$$;
revoke all on function game.take_auth_ticket(text, text) from public, anon, authenticated;

-- Where the hook sends email. One row per project, set by hand (never by a migration: local values
-- must not reach a hosted project): Resend's API with the key in Vault under `key_name`, or
-- Mailpit locally (supabase/seed.sql).
create table game.mail_relay (
  only_row boolean primary key default true check (only_row),
  kind text not null check (kind in ('resend', 'mailpit')),
  url text not null,
  sender_name text not null,
  sender_email text not null,
  key_name text,
  check (kind = 'mailpit' or key_name is not null)
);
alter table game.mail_relay enable row level security;
revoke all on game.mail_relay from anon, authenticated;

comment on table game.mail_relay is
  'Where the Send Email hook delivers codes: Resend (key in Vault) or local Mailpit (ADR 0082).';

-- Auth's answer refusing a hook's request.
create function game.auth_refusal(code integer, message text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('error', jsonb_build_object('http_code', code, 'message', message))
$$;

-- Before-user-created hook (Authentication > Auth Hooks): a sign-up with our ticket, or Google.
create function public.ballbattle_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ticket text := event -> 'user' -> 'user_metadata' ->> 'bb_ticket';
begin
  if event -> 'user' -> 'app_metadata' ->> 'provider' = 'google' then
    return '{}'::jsonb;
  end if;
  if ticket is not null and game.take_auth_ticket('signup', ticket) then
    return '{}'::jsonb;
  end if;
  return game.auth_refusal(403, 'Sign up in the game');
end
$$;

-- Send Email hook: only a code the functions asked for, delivered through the relay.
create function public.ballbattle_send_email(event jsonb) returns jsonb
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
    perform net.http_post(
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
    );
  else
    perform net.http_post(
      url := relay.url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'From', jsonb_build_object('Email', relay.sender_email, 'Name', relay.sender_name),
        'To', jsonb_build_array(jsonb_build_object('Email', recipient)),
        'Subject', subject,
        'HTML', html,
        'Text', plain
      )
    );
  end if;
  return '{}'::jsonb;
end
$$;

revoke all on function public.ballbattle_before_user_created(jsonb) from public, anon, authenticated;
revoke all on function public.ballbattle_send_email(jsonb) from public, anon, authenticated;
grant execute on function public.ballbattle_before_user_created(jsonb) to supabase_auth_admin;
grant execute on function public.ballbattle_send_email(jsonb) to supabase_auth_admin;
