-- Pokes for play by turns (ADR 0085, the two-phone playtest ADR 0083 asks for), expand only.
--
-- Every change a player reads of a series by turns bumps `version`, as a live series' does: its
-- making (inserted, then advanced to its first turn in the same transaction), a pick, a round
-- settled, the end, a turn that ran out. Each pokes both players' series screens (`match`) and
-- both inboxes (`inbox`), where "Your turn" comes and goes. A read changes nothing and pokes
-- nobody. Live series keep their own trigger (20261124120000_poke.sql), unchanged.

create function game.poke_turns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform game.poke(new.player_a, 'match');
  perform game.poke(new.player_a, 'inbox');
  perform game.poke(new.player_b, 'match');
  perform game.poke(new.player_b, 'inbox');
  return null;
end
$$;
revoke all on function game.poke_turns() from public, anon, authenticated;

create trigger poke_turns_changed after update on game.series
  for each row when (not new.live and old.version is distinct from new.version)
  execute function game.poke_turns();
