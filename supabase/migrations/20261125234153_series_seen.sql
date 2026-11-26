-- Endings of series by turns a player has seen (ADR 0086, S11), expand only.
--
-- Friends lists a series by turns that ended (a finish, or a turn that ran out) until its player
-- has seen it: their own read of the finished series writes this row. Nobody else reads it, so
-- nothing pokes on it (the ending itself already pokes both inboxes, 20261125200000_poke_turns.sql).
-- It goes with the series and with the player.
create table game.series_seen (
  series_id uuid not null references game.series (id) on delete cascade,
  player uuid not null references game.profiles (user_id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (series_id, player)
);

create index series_seen_player on game.series_seen (player);

comment on table game.series_seen is
  'Endings of series by turns a player has seen (ADR 0086): Friends lists an ending until then.';

alter table game.series_seen enable row level security;
grant select, insert on game.series_seen to game_api;
revoke all on game.series_seen from anon, authenticated;
