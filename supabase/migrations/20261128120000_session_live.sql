-- Log out ends the session at once (2026-11-28 audit). Auth deletes a session's row from
-- `auth.sessions` when it is signed out (`/logout`, scope local), revoking its refresh token, but
-- an access token is a signed JWT that stays valid until it expires (up to an hour): the functions
-- verify it locally, so a copied token kept working after Log out. Every Auth access token names
-- its session (`session_id`); the API's statements that read the player's profile now also ask
-- whether that session still exists (`src/server/session.ts`), in the same round trip.
--
-- Expand only: one function, read-only, nothing changed.

-- Whether session `sid` is still signed in: its row exists and has not passed a time box. A token
-- without a session id (none Auth issues today) reads as live: nothing to check it against.
create function game.session_live(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select sid is null or exists (
    select 1 from auth.sessions s
    where s.id = sid and (s.not_after is null or s.not_after > now())
  )
$$;

revoke all on function game.session_live(uuid) from public, anon, authenticated;
grant execute on function game.session_live(uuid) to game_api;

comment on function game.session_live(uuid) is
  'True while an Auth session is signed in: the API refuses a logged-out access token (2026-11-28).';
