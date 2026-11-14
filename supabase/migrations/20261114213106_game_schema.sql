-- The game's own data (ADR 0052, section 5), slice 1 part A: guests' profiles, series played by
-- turns, their secret seeds, picks and rounds, friend challenges and rate limits. Later slices add
-- their tables in their own migrations (expand, then contract).
--
-- The schema `game` is not exposed through Supabase's Data API (only `public` is): the browser
-- never queries the database, it calls /api/v1/* only. RLS is enabled on every table with no
-- policies anyway, so a misconfigured exposure would return nothing. The functions connect as
-- `game_api`, which can read and write these tables and nothing in `auth`.

create schema game;
revoke all on schema game from public, anon, authenticated;

-- A player: today always a guest (a Supabase anonymous user), made on their first online action.
-- Deleting the auth user deletes this row, which forfeits their open series (below).
create table game.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- "Player 4821": generated, never chosen by a guest (ADR 0052, "Abuse").
  display_name text not null check (char_length(display_name) between 1 and 40),
  -- When the player confirmed they are 16 or older, at their first online action.
  adult_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- Read by the inactive-guest cleanup (90 days, a later slice); updated at most daily.
  last_seen_at timestamptz not null default now()
);

-- A series played by turns between two players (or, later, a player and a bot). Side `a` is the
-- challenger, side `b` the player who accepted. Both player columns become null when that player is
-- deleted, so the opponent's history keeps the series ("Deleted player").
create table game.series (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('friend', 'open', 'ranked', 'ladder')),
  -- The RULESET_VERSION it is played under: its frozen bundle plays and verifies it (ADR 0052).
  ruleset integer not null check (ruleset > 0),
  format text not null check (format in ('blind', 'reveal', 'showdown')),
  best_of integer not null check (best_of in (3, 5)),
  player_a uuid references game.profiles (user_id) on delete set null,
  player_b uuid references game.profiles (user_id) on delete set null,
  -- A bot's id, for a bot series (a later slice); null when side b is a player.
  bot text,
  lineup_a text[] not null,
  lineup_b text[] not null,
  -- Which seed key (an id in the server's key map) derives this series' seeds.
  key_id text not null,
  status text not null default 'open' check (status in ('open', 'finished', 'forfeit', 'void')),
  -- Null while open, and for a forfeit both sides missed.
  winner text check (winner in ('a', 'b')),
  -- Bumped on every change: the ETag of a series read.
  version integer not null default 0,
  -- Who must pick next ('both': Showdown's round 1), and by when (database time).
  turn text check (turn in ('a', 'b', 'both')),
  turn_deadline timestamptz,
  -- A client's id for the request that created the series, so a retried create returns it.
  request_id uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  -- The whole SeriesSetup with every seed and pick, once finished: replays it anywhere.
  final_setup jsonb,
  unique (player_a, request_id),
  check ((status = 'open') = (finished_at is null)),
  check (status = 'open' or turn is null)
);
create index series_open_a on game.series (player_a) where status = 'open';
create index series_open_b on game.series (player_b) where status = 'open';
create index series_deadlines on game.series (turn_deadline) where status = 'open';
create index series_finished_a on game.series (player_a, finished_at desc) where status <> 'open';
create index series_finished_b on game.series (player_b, finished_at desc) where status <> 'open';

-- One row per seed a series uses (ADR 0051 option B). The seed itself is derived from the key
-- (never stored until revealed); the salt stays secret until then, the commitment is public.
create table game.series_seeds (
  series_id uuid not null references game.series (id) on delete cascade,
  purpose text not null check (purpose in ('round', 'toss', 'lineup', 'bot')),
  idx integer not null check (idx between 0 and 4),
  salt bytea not null check (octet_length(salt) = 16),
  commitment bytea not null check (octet_length(commitment) = 32),
  -- A 32-bit unsigned seed, set when it is revealed.
  seed bigint check (seed between 0 and 4294967295),
  revealed_at timestamptz,
  primary key (series_id, purpose, idx),
  check ((seed is null) = (revealed_at is null))
);

-- A pick, locked once: the primary key is the idempotent lock, so a retry or a double submit gets
-- the stored pick back and the first lock wins.
create table game.picks (
  series_id uuid not null references game.series (id) on delete cascade,
  round integer not null check (round between 0 and 4),
  side text not null check (side in ('a', 'b')),
  ball text not null,
  created_at timestamptz not null default now(),
  primary key (series_id, round, side)
);

-- A round as the server played it, so reads never replay a fight.
create table game.rounds (
  series_id uuid not null references game.series (id) on delete cascade,
  round integer not null check (round between 0 and 4),
  a text not null,
  b text not null,
  seeds bigint[] not null,
  outcomes text[] not null,
  winner text not null check (winner in ('a', 'b')),
  sudden_death boolean not null,
  primary key (series_id, round)
);

-- A friend challenge: a link holding a 128-bit random token, of which only the hash is stored. It
-- can be accepted once (series_id set where it was null) and expires after 7 days.
create table game.challenges (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  creator uuid not null references game.profiles (user_id) on delete cascade,
  ruleset integer not null check (ruleset > 0),
  format text not null check (format in ('blind', 'reveal', 'showdown')),
  best_of integer not null check (best_of in (3, 5)),
  -- The challenger's lineup: never sent to anyone before the series starts.
  lineup text[] not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  series_id uuid references game.series (id) on delete set null,
  unique (creator, request_id)
);
create index challenges_creator on game.challenges (creator, created_at desc);

-- Fixed-window counters, per account (or per client IP for guest creation), upserted. Old windows
-- are purged by the scheduled sweep.
create table game.rate_limits (
  subject text not null,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null,
  primary key (subject, bucket, window_start)
);

-- A deleted player forfeits every open series to the opponent (ADR 0052, "Logging out and
-- deleting"), however the deletion comes: "Forget me", the inactive-guest cleanup or the dashboard.
-- It runs as its owner, since the deletion arrives as Supabase Auth's own role.
create function game.forfeit_open_series() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update game.series
     set status = 'forfeit',
         winner = case when player_a = old.user_id then 'b' else 'a' end,
         turn = null,
         turn_deadline = null,
         finished_at = now(),
         version = version + 1
   where status = 'open' and (player_a = old.user_id or player_b = old.user_id);
  return old;
end;
$$;
revoke all on function game.forfeit_open_series() from public, anon, authenticated;
create trigger profiles_forfeit_open_series
  before delete on game.profiles
  for each row execute function game.forfeit_open_series();

alter table game.profiles enable row level security;
alter table game.series enable row level security;
alter table game.series_seeds enable row level security;
alter table game.picks enable row level security;
alter table game.rounds enable row level security;
alter table game.challenges enable row level security;
alter table game.rate_limits enable row level security;

-- The functions' role: what the API needs and no more. Its password is set per environment, outside
-- migrations (supabase/seed.sql locally; the dashboard's SQL editor on staging and production).
-- It bypasses RLS (it owns no table, so it needs the attribute); `anon` and `authenticated` get
-- nothing.
create role game_api with login noinherit bypassrls;
grant usage on schema game to game_api;
grant select, insert, update on all tables in schema game to game_api;
grant delete on game.rate_limits to game_api;
revoke all on all tables in schema game from anon, authenticated;
