-- Blocking and "Report this name" (ADR 0079 addendum of 2026-11-25), expand only. Nothing reads
-- either until the accounts switch is on.
--
-- A block is the pair's friendship row kept for good as the blocked player's request, declined by
-- the blocker (`blocked_by`): every rule that keeps a decline from reaching its sender already
-- holds, so the blocked player reads it as a request still sent (or, if they were friends, as a
-- friend who removed them) and nothing they send arrives. The sweep never drops it; Unblock deletes
-- it. Nobody else ever reads `blocked_by`.
alter table game.friendships add column blocked_by uuid;
alter table game.friendships add constraint friendships_block check (
  blocked_by is null
  or (blocked_by in (low, high) and requested_by <> blocked_by and declined_at is not null)
);

comment on column game.friendships.blocked_by is
  'The account that blocked the other (ADR 0079): the row stays a declined request for good.';

-- One report of a name: who reported whom, the name as it was then, why, and when. Kept 90 days by
-- the sweep, and with either account (deleting one deletes its reports). Only the owner reads them
-- (scripts/reports.ts, read-only SQL); the API may only add one and check its own.
create table game.name_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references game.profiles (user_id) on delete cascade,
  reported uuid not null references game.profiles (user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  reason text not null check (reason in ('offensive', 'impersonation', 'other')),
  created_at timestamptz not null default now()
);

create index name_reports_pair on game.name_reports (reporter, reported);
create index name_reports_reported on game.name_reports (reported);
create index name_reports_created on game.name_reports (created_at);

comment on table game.name_reports is
  'Usernames reported by accounts (ADR 0079), for the owner to review; kept 90 days.';

alter table game.name_reports enable row level security;
grant select, insert, delete on game.name_reports to game_api;
revoke all on game.name_reports from anon, authenticated;

-- The name `viewer` sees for a player: their username, unless the viewer reported that very name
-- (then the player's "Player 1234"); a new username shows again.
create function game.name_seen_by(
  viewer uuid,
  player uuid,
  username text,
  display_name text
) returns text
language sql
stable
set search_path = ''
as $$
  select case
    when username is not null and exists (
      select 1 from game.name_reports r
      where r.reporter = viewer and r.reported = player and r.name = username
    ) then display_name
    else coalesce(username, display_name)
  end
$$;

revoke all on function game.name_seen_by(uuid, uuid, text, text) from public;
grant execute on function game.name_seen_by(uuid, uuid, text, text) to game_api;
