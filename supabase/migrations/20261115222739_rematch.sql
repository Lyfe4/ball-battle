-- A rematch after a live friend match (ADR 0055), expand only: one new table, nothing else
-- changes. A row per ended live series once either player asks: who asked and when, the other's
-- yes or no, each side's new lineup, and the new live series once both are in. The timers (30 s to
-- answer, 60 s for the lineups) are read against the database's `now()`; nothing is written when
-- one runs out.

create table game.rematches (
  series_id uuid primary key references game.series (id) on delete cascade,
  asked_by text not null check (asked_by in ('a', 'b')),
  asked_at timestamptz not null default now(),
  -- When the other player said yes; null until then.
  agreed_at timestamptz,
  -- Who said no; null unless one did.
  declined_by text check (declined_by in ('a', 'b')),
  lineup_a text[],
  lineup_b text[],
  -- The new live match, once both lineups are in.
  new_series_id uuid references game.series (id) on delete set null,
  check (agreed_at is null or declined_by is null),
  check (new_series_id is null or agreed_at is not null)
);

alter table game.rematches enable row level security;
grant select, insert, update on game.rematches to game_api;
revoke all on game.rematches from anon, authenticated;
