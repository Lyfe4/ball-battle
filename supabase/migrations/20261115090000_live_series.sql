-- Live friend matches (ADR 0053), expand only: a series played live keeps the same machine as a
-- series by turns, with short deadlines, fights the server schedules, presence per player per
-- series, and the reason a series ended. Play by turns (`live = false`) is untouched.

alter table game.series
  add column live boolean not null default false,
  -- When both players had arrived: the first pick phase opened then. Null until both are here.
  add column started_at timestamptz,
  -- When the current pick phase opened (live only): a pick before it is refused (a fight is on).
  add column turn_opens_at timestamptz,
  -- Why a forfeit ended it (live): out of time is never a forfeit in a live series, a random
  -- ball is picked instead. Null for a series by turns and for one that finished.
  add column end_reason text check (end_reason in ('timeout', 'left', 'disconnected', 'start_missed')),
  add check (live or (started_at is null and turn_opens_at is null));

-- When each player of a live series was last heard from on it (every read is a heartbeat). A row
-- per side, made when that player first asks (the friend's at Accept); none yet means not arrived.
create table game.presence (
  series_id uuid not null references game.series (id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  seen_at timestamptz not null,
  primary key (series_id, side)
);

-- A live round's Fight! and the end of its watching time at 1×, by database time: both screens
-- fight at `fight_at` and the next pick opens at `ends_at`. Null for a series by turns.
alter table game.rounds
  add column fight_at timestamptz,
  add column ends_at timestamptz,
  add check ((fight_at is null) = (ends_at is null)),
  add check (ends_at is null or ends_at > fight_at);

-- A pick the server made at random when its time ran out (both pages say so).
alter table game.picks add column auto boolean not null default false;

-- A live link: open while its sender's lobby page keeps asking (`creator_seen_at`), until they
-- cancel it. A by-turns link keeps its 7 days.
alter table game.challenges
  add column live boolean not null default false,
  add column creator_seen_at timestamptz,
  add column cancelled_at timestamptz,
  add check (not live or creator_seen_at is not null);
create index challenges_live_waiting on game.challenges (creator)
  where live and series_id is null and cancelled_at is null;

create index series_live_open on game.series (id) where live and status = 'open';

alter table game.presence enable row level security;
grant select, insert, update on game.presence to game_api;
revoke all on game.presence from anon, authenticated;
