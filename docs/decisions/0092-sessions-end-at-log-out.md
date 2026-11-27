# 0092: Log out ends the session; pokes stay on unguessable topics

- Status: Accepted (2026-11-28, audit before accounts launch)
- Date: 2026-11-28
- Builds on: ADR 0052 (sessions in a cookie, `sessionOf`), ADR 0079 (accounts), ADR 0082 (the
  Realtime poke)
- Leaves open: private Realtime channels (below, a proposal)

## Context

Two leftovers of the 2026-11-27 security review, both before accounts reach production:

1. **A token kept working after Log out.** Log out signed the session out in Auth (its refresh
   token revoked, its `auth.sessions` row deleted), but the functions verify an access token
   locally (a signed JWT, ADR 0052): a copy taken before Log out (another device, a shared
   computer, a leaked cookie) worked until it expired, up to an hour.
2. **Poke channels are public** (ADR 0082). Anyone who knows a topic can join it. The question was
   whether to make them private Realtime channels with RLS on `realtime.messages`.

## Decision

1. **Every statement that reads the session's profile also asks whether its Auth session still
   exists**: `game.session_live(session_id)` (migration `20261128120000_session_live.sql`,
   `security definer`, executable by `game_api` alone), anded into the profile's `where` in
   `profileOf`, `meOf`, `loadSeriesAs` and the record's reads (`sessionLive`, `Reader`). The token's
   `session_id` claim comes through `verifyAccess` (or, after a refresh, the new token). A
   signed-out session finds no profile, so the request is a 401 `unauthenticated` ("Your session
   has ended") and the cookie is cleared, as for a deleted player. Same round trips as before; the
   lookup is by `auth.sessions`' primary key. A token without a session id (Auth issues none
   today) reads as live. Other sessions of the same player and every other player are untouched
   (`logout.db.test.ts`).
2. **Pokes stay on public channels with unguessable, per-player topics** (ADR 0082 as built): the
   topic is 122 random bits, handed only to its own player behind their session (`GET /me/poke`),
   rotated at Log out and deleted with the player; payloads are empty; the page reads at most once
   a second per event however many arrive; no browser role can read `realtime.messages`.
   `poke-isolation.db.test.ts` joins two real sockets on the local Realtime and shows a poke for A
   reaches A's socket and never B's, and that B's own reaches B.

## Why not private channels now

Realtime authorises a private channel only with a user's JWT, sent by the page on join and again
before it expires. Today the page never holds one: the access and refresh tokens live in an
`HttpOnly` cookie only the functions read (ADR 0052: the browser never talks to Supabase). Handing
the page its access token would let a script injected into the page (an XSS bug) use the
player's Auth session directly: set a password, enrol an MFA factor or read the email address,
none of which the game's own API allows. That is a larger risk than the one closed: with a topic
nobody can guess, private channels add no secrecy (there is nothing in the payload) and do not stop
quota abuse (any guest could still hold its own sockets open).

A proposal for later, if pokes ever carry data or a topic must be shareable: functions mint a
short-lived Realtime-only JWT (a dedicated key imported as a Supabase JWT signing key, a role with
no grants but `realtime.messages` select on its own topic), so the page never holds the Auth
session. Effort: medium (a migration, a signing key in the dashboard and in Netlify, the socket's
join and renewal). Risk: medium (Auth trusts every signing key it publishes, so the role and
claims must be checked by every API that sees the token).

## Consequences

- A copied session cookie dies at Log out, on its next request, for every route.
- The poke design is unchanged; the launch runbook keeps Realtime's settings as staging has them,
  with its quotas checked weekly (ADR 0082).
- `game.session_live` is one more function the API's role may call; `schema.db.test.ts` and the
  migration pin hold it.
