-- Deleting a player stays quick, and Auth users the game never made a player are deleted (2026-11-28
-- audit). Expand only: four indexes and one read-only function.
--
-- 1. Deleting a player (Forget me, Delete account, the inactive sweep) sets or cascades every row
--    that names them. Postgres finds those rows by the foreign key's column; four columns had only
--    partial indexes (open series, waiting starts and challenges), which a foreign key's action can't
--    use, so each deletion scanned the whole table inside Auth's own delete: slower as history grows,
--    until Auth's statement timeout made Forget me fail. Plain indexes on each.
create index series_player_b on game.series (player_b);
create index starts_a on game.starts (player_a);
create index starts_b on game.starts (player_b);
create index challenges_invitee on game.challenges (invitee);
-- And the sweep's own read of who has been away (`inactivePlayers`), oldest first.
create index profiles_last_seen on game.profiles (last_seen_at);

-- 2. Auth users with no game profile, made over `older_than` ago, oldest first: an email code sent to
--    a new address and never entered (Auth makes the user as it sends the code; the profile comes at
--    verify), or a sign-up whose own clean-up failed. Nobody plays as one: the sweep deletes them
--    through Auth, as Forget me deletes a player. A code works for 10 minutes and a sign-in step for
--    10, so a day's wait never meets one in use.
create function game.orphan_users(older_than interval, max integer) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
  where u.created_at < now() - older_than
    and not exists (select 1 from game.profiles p where p.user_id = u.id)
  order by u.created_at
  limit max
$$;

revoke all on function game.orphan_users(interval, integer) from public, anon, authenticated;
grant execute on function game.orphan_users(interval, integer) to game_api;
