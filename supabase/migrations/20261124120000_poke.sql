-- The Realtime poke's database side (ADR 0082), expand only, switched off. Nothing listens yet.
--
-- A poke is a broadcast with an event name (`inbox` or `match`) and an empty payload, on the public
-- channel `p:<poke_key>`. The key is the player's own unguessable topic: random, never derived from
-- the user id, handed only to that player's page (GET /me/poke, PR 3). On a poke the page does the
-- complete read it does today, so order, duplicates and loss don't matter.
--
-- Row triggers send it with `realtime.send`, which writes `realtime.messages` in the same
-- transaction: Realtime broadcasts it only once that commits, so a rolled-back write pokes nobody,
-- and every path pokes (settle on read and the sweep included) with no request from a function.
-- `WHEN` guards keep a write that changes nothing a player reads from poking anyone: the lobby's
-- `creator_seen_at`, a start's drafts, the live heartbeat (which writes `game.presence`, not these).
-- Nothing the clock decides is poked: the page reads at each deadline it already knows.
--
-- `game.flags`' `poke` row switches every poke off at once with no deploy; it starts off, and only
-- local development and tests turn it on until the owner says (scripts/poke-switch.ts, PR 3).

-- A v4 UUID's 122 random bits, as 32 hex characters: a topic nobody can guess. Rotated by setting it
-- to its default (PR 3: Log out, Forget me, Delete account, Switch).
alter table game.profiles
  add column poke_key text not null default replace(gen_random_uuid()::text, '-', '');
create unique index profiles_poke_key on game.profiles (poke_key);

-- Switches the API and the database read without a deploy.
create table game.flags (
  name text primary key,
  enabled boolean not null default false,
  changed_at timestamptz not null default now()
);
insert into game.flags (name, enabled) values ('poke', false);

comment on table game.flags is
  'Switches flipped without a deploy (scripts/poke-switch.ts); `poke` gates every Realtime poke (ADR 0082).';

alter table game.flags enable row level security;
grant select on game.flags to game_api;
revoke all on game.flags from anon, authenticated;

-- Sends one poke to one player, if pokes are on and the player is still here. Never fails the write
-- that called it: a poke lost is caught by the page's safety read.
create function game.poke(player uuid, event text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  key text;
begin
  if player is null then
    return;
  end if;
  if not exists (select 1 from game.flags where name = 'poke' and enabled) then
    return;
  end if;
  select poke_key into key from game.profiles where user_id = player;
  if key is null then
    return;
  end if;
  begin
    perform realtime.send('{}'::jsonb, event, 'p:' || key, false);
  exception when others then
    raise warning 'poke not sent: %', sqlerrm;
  end;
end
$$;
revoke all on function game.poke(uuid, text) from public, anon, authenticated;

-- A friend's challenge arrives in their inbox.
create function game.poke_challenge_sent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform game.poke(new.invitee, 'inbox');
  return null;
end
$$;
create trigger poke_challenge_sent after insert on game.challenges
  for each row when (new.invitee is not null)
  execute function game.poke_challenge_sent();

-- Accepted, declined, taken or stopped: the sender's lobby reads, the invitee's card goes.
create function game.poke_challenge_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform game.poke(new.creator, 'match');
  perform game.poke(new.invitee, 'inbox');
  return null;
end
$$;
create trigger poke_challenge_changed after update on game.challenges
  for each row when (
    old.series_id is distinct from new.series_id
    or old.start_id is distinct from new.start_id
    or old.cancelled_at is distinct from new.cancelled_at
    or old.invitee_declined_at is distinct from new.invitee_declined_at
    or old.invitee is distinct from new.invitee
  )
  execute function game.poke_challenge_changed();

-- A friend request sent, answered, cancelled or removed: both sides' inboxes.
create function game.poke_friendship() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pair game.friendships := case when tg_op = 'DELETE' then old else new end;
begin
  perform game.poke(pair.low, 'inbox');
  perform game.poke(pair.high, 'inbox');
  return null;
end
$$;
create trigger poke_friendship_added after insert on game.friendships
  for each row execute function game.poke_friendship();
create trigger poke_friendship_changed after update on game.friendships
  for each row when (
    old.accepted_at is distinct from new.accepted_at
    or old.declined_at is distinct from new.declined_at
    or old.withdrawn_at is distinct from new.withdrawn_at
    or old.requested_by is distinct from new.requested_by
  )
  execute function game.poke_friendship();
create trigger poke_friendship_removed after delete on game.friendships
  for each row execute function game.poke_friendship();

-- A start lineup: the other player opened it or locked in, or the series was made.
create function game.poke_start() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform game.poke(new.player_a, 'match');
  perform game.poke(new.player_b, 'match');
  return null;
end
$$;
create trigger poke_start_changed after update on game.starts
  for each row when (
    old.opened_a is distinct from new.opened_a
    or old.opened_b is distinct from new.opened_b
    or old.locked_a is distinct from new.locked_a
    or old.locked_b is distinct from new.locked_b
    or old.series_id is distinct from new.series_id
  )
  execute function game.poke_start();

-- A live match moved: a pick locked, a round settled, a forfeit, the end. Every change a player
-- reads bumps `version` (ADR 0053), so that is the guard.
create function game.poke_series() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform game.poke(new.player_a, 'match');
  perform game.poke(new.player_b, 'match');
  return null;
end
$$;
create trigger poke_series_changed after update on game.series
  for each row when (new.live and old.version is distinct from new.version)
  execute function game.poke_series();

-- A rematch asked, answered or made: both players, on their end screen or anywhere (ADR 0070).
create function game.poke_rematch() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a uuid;
  b uuid;
begin
  select player_a, player_b into a, b from game.series where id = new.series_id;
  perform game.poke(a, 'match');
  perform game.poke(a, 'inbox');
  perform game.poke(b, 'match');
  perform game.poke(b, 'inbox');
  return null;
end
$$;
create trigger poke_rematch_asked after insert on game.rematches
  for each row execute function game.poke_rematch();
create trigger poke_rematch_changed after update on game.rematches
  for each row when (
    old.agreed_at is distinct from new.agreed_at
    or old.declined_by is distinct from new.declined_by
    or old.new_series_id is distinct from new.new_series_id
  )
  execute function game.poke_rematch();
