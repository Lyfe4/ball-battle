-- Lineups picked together after accepting (ADR 0080), expand only: one new table, a nullable
-- column on challenges, and a challenge's lineup no longer required. Nothing old is dropped or
-- changed in meaning; the rematch's own lineup columns are simply no longer written.
--
-- A start is the agreement to play, before the series exists: a live challenge accepted, or a
-- rematch both said yes to. Both players build their lineups at once against one clock
-- (`deadline_at`, written at the agreement from the API's constant, read against `now()`). Each
-- side's draft is kept as it is built (secret: only its own player reads it), with a sequence so a
-- late answer never replaces a newer draft. The series, and so its seeds, is made only when both
-- lineups are locked or the clock has run out (ADR 0051, 0052): a draft is then finished at random,
-- and a side that never opened the lineup loses by `start_missed`.

create table game.starts (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references game.profiles (user_id) on delete cascade,
  player_b uuid not null references game.profiles (user_id) on delete cascade,
  format text not null check (format in ('reveal', 'showdown')),
  best_of integer not null check (best_of in (3, 5)),
  -- The rematch this start follows (the ended live series), if it is one.
  rematch_of uuid unique references game.series (id) on delete cascade,
  agreed_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  -- When each player first read the start: a player who never did loses when time runs out.
  opened_a timestamptz,
  opened_b timestamptz,
  draft_a text[] not null default '{}',
  draft_b text[] not null default '{}',
  draft_seq_a integer not null default 0,
  draft_seq_b integer not null default 0,
  -- When each lineup was locked in; its draft is then the lineup.
  locked_a timestamptz,
  locked_b timestamptz,
  -- The series it made, once made.
  series_id uuid unique references game.series (id) on delete set null,
  check (player_a <> player_b),
  check (deadline_at > agreed_at)
);

-- The sweep and a player's one-match check look for starts not yet made into a series.
create index starts_open on game.starts (deadline_at) where series_id is null;
create index starts_player_a on game.starts (player_a) where series_id is null;
create index starts_player_b on game.starts (player_b) where series_id is null;

comment on table game.starts is
  'Both lineups picked at once after a live challenge or rematch was agreed (ADR 0080).';

alter table game.starts enable row level security;
grant select, insert, update on game.starts to game_api;
revoke all on game.starts from anon, authenticated;

-- A live challenge is sent without a lineup and accepted into a start. Old challenges in flight
-- keep theirs (the sender's side of the start is then locked from it).
alter table game.challenges alter column lineup drop not null;
alter table game.challenges
  add column start_id uuid unique references game.starts (id) on delete set null;
