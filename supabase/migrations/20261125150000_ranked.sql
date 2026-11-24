-- Ranked play's tables (ADR 0083, PR 3), expand only. Nothing reads or writes them yet: the server's
-- ranked by turns (PR 4) does, and only once accounts and pokes are on in production. Every new
-- column is nullable or has a constant default, so adding it rewrites no table.

-- A season: 8 weeks from Monday 00:00 Sydney, stored as UTC. `ruleset` is the ruleset it opened on:
-- ranked plays the current ruleset, and a bump that would change a season's fights waits for the
-- next season (ADR 0083, decision 5), which the queue checks against this. The sweep closes a
-- season (`closed_at`) and opens the next; at most one is open.
create table game.seasons (
  id smallint primary key check (id > 0),
  name text not null check (char_length(name) between 1 and 40),
  ruleset integer not null check (ruleset > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  closed_at timestamptz,
  check (ends_at > starts_at)
);
create unique index seasons_one_open on game.seasons ((true)) where closed_at is null;

comment on table game.seasons is
  'Ranked seasons (ADR 0083): 8 weeks, the ruleset each opened on, at most one open.';

-- A player's ranked standing in a season: the hidden Glicko-2 rating (never sent to a player) and
-- the trophies they see, with the floor of the highest league reached this season and the peak.
-- `skill` is rating - 2·RD, the board's tie-break and the queue's key (src/server/rating/).
create table game.ratings (
  user_id uuid not null references game.profiles (user_id) on delete cascade,
  season_id smallint not null references game.seasons (id),
  rating double precision not null default 1500,
  rd double precision not null default 350 check (rd > 0 and rd <= 350),
  volatility double precision not null default 0.06 check (volatility > 0),
  skill double precision generated always as (rating - 2 * rd) stored,
  trophies integer not null default 0 check (trophies >= 0),
  floor integer not null default 0 check (floor >= 0 and floor <= trophies),
  peak_trophies integer not null default 0 check (peak_trophies >= trophies),
  series_count integer not null default 0 check (series_count >= 0),
  wins integer not null default 0 check (wins >= 0 and wins <= series_count),
  last_series_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, season_id)
);
-- The Everyone board (ADR 0083): the top of a season among players with 10+ ranked series. A query
-- uses it only when it repeats `series_count >= 10` exactly.
create index ratings_board on game.ratings (season_id, trophies desc, skill desc)
  where series_count >= 10;

comment on table game.ratings is
  'Ranked standing per season (ADR 0083): hidden Glicko-2 and the trophies a player sees.';

-- Each rated series' change, once per player (the primary key is the double-finish guard): before
-- and after, for "your last 5" and for review.
create table game.rating_changes (
  series_id uuid not null references game.series (id) on delete cascade,
  user_id uuid not null references game.profiles (user_id) on delete cascade,
  season_id smallint not null references game.seasons (id),
  result text not null check (result in ('win', 'loss', 'forfeit')),
  rating_before double precision not null,
  rd_before double precision not null,
  rating_after double precision not null,
  rd_after double precision not null,
  trophies_before integer not null check (trophies_before >= 0),
  trophies_after integer not null check (trophies_after >= 0),
  created_at timestamptz not null default now(),
  primary key (series_id, user_id)
);
create index rating_changes_user on game.rating_changes (user_id, created_at desc);

comment on table game.rating_changes is
  'One row per player per rated series (ADR 0083): applied once, kept as history.';

-- Waiting for a ranked opponent: one entry a player (the primary key: a double tap or a second tab
-- is one entry), live until `live_until`, then by turns. The lineup is never sent to anyone.
-- `network` is the rate limits' network subject (an HMAC, never an address), for the pair cap.
create table game.queue_entries (
  user_id uuid primary key references game.profiles (user_id) on delete cascade,
  season_id smallint not null references game.seasons (id),
  ruleset integer not null check (ruleset > 0),
  best_of integer not null default 5 check (best_of in (3, 5)),
  format text not null default 'reveal' check (format in ('blind', 'reveal', 'showdown')),
  lineup text[] not null,
  skill double precision not null,
  live boolean not null default true,
  live_until timestamptz,
  network text,
  created_at timestamptz not null default now()
);
create index queue_entries_waiting on game.queue_entries (season_id, live, created_at);

comment on table game.queue_entries is
  'Players waiting for a ranked opponent (ADR 0083); the lineup is never sent.';

-- A season's reward, granted once by the sweep that closes it: the peak league reached (0 Bronze to
-- 5, named by the owner later). Cosmetic only.
create table game.season_rewards (
  user_id uuid not null references game.profiles (user_id) on delete cascade,
  season_id smallint not null references game.seasons (id),
  league smallint not null check (league between 0 and 5),
  granted_at timestamptz not null default now(),
  primary key (user_id, season_id)
);

comment on table game.season_rewards is
  'Cosmetic rewards by peak league, one per player per season (ADR 0083).';

-- A ranked series counts in the season it was created in.
alter table game.series add column season_id smallint references game.seasons (id);
alter table game.series add constraint series_season_ranked
  check (season_id is null or kind = 'ranked');
-- The pair cap (ADR 0083, decision 9): a pair's rated series in the last 24 hours, either order.
create index series_ranked_pairs on game.series
  (least(player_a, player_b), greatest(player_a, player_b), created_at) where kind = 'ranked';

-- "Show me on the Everyone board" (ADR 0083, decision 6): shown unless the player hides it.
alter table game.profiles add column board_hidden boolean not null default false;

alter table game.seasons enable row level security;
alter table game.ratings enable row level security;
alter table game.rating_changes enable row level security;
alter table game.queue_entries enable row level security;
alter table game.season_rewards enable row level security;

grant select, insert, update on game.seasons, game.ratings, game.rating_changes,
  game.queue_entries, game.season_rewards to game_api;
grant delete on game.queue_entries to game_api;
revoke all on game.seasons, game.ratings, game.rating_changes, game.queue_entries,
  game.season_rewards from anon, authenticated;
