# 0092: Log out ends the session; pokes on unguessable topics only the server can send to

- Status: Accepted (2026-11-28, audit before accounts launch)
- Date: 2026-11-28
- Builds on: ADR 0052 (sessions in a cookie, `sessionOf`), ADR 0079 (accounts), ADR 0082 (the
  Realtime poke)
- Leaves open: a Realtime-only token, if pokes ever carry data (below, a proposal)
- Addendum 2026-11-28: pokes go out on listen-only private channels (below)

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
   reaches A's socket and never B's, and that B's own reaches B. (Since the addendum below, the
   channels are private and listen-only, so only the server can send on them.)

## Why not a user's token in the page

Realtime authorises a channel per user only with that user's JWT, sent by the page on join and
again before it expires. Today the page never holds one: the access and refresh tokens live in an
`HttpOnly` cookie only the functions read (ADR 0052: the browser never talks to Supabase). Handing
the page its access token would let a script injected into the page (an XSS bug) use the
player's Auth session directly: set a password, enrol an MFA factor or read the email address,
none of which the game's own API allows. That is a larger risk than the one closed: with a topic
nobody can guess, a per-user check adds no secrecy (there is nothing in the payload) and does not
stop quota abuse (any guest could still hold its own sockets open). The addendum below gets the one
thing a private channel does add, server-only sends, without any token in the page.

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

## Addendum 2026-11-28: only the server can send a poke

Before accounts reach production, the four questions about public poke channels were answered by
tests against the local Realtime (`poke-isolation.db.test.ts`, `poke.db.test.ts`), not by reasoning:

1. **Pokes carry no data.** Each `realtime.messages` row is the event name (`inbox` or `match`) and
   a payload whose only key is the message id Realtime adds itself (`poke.db.test.ts`).
2. **A topic can't be guessed from anything public.** It is `p:` and the profile's `poke_key`, a
   v4 UUID's 122 random bits made by the database, never derived: it contains neither the user id
   (bare or as its MD5), nor the username, nor the friend code; two players' differ; and no browser
   role can reach `game` at all. `GET /me/poke` hands it only to its own player, behind their
   session; Log out rotates it.
3. **A browser client could send to someone else's topic.** On the public channel, a stranger who
   had the topic and the browser key (every page has it) made the player's page hear `match`, both
   by sending on a joined socket and through Realtime's REST endpoint (`POST
/realtime/v1/api/broadcast` with the browser key: 202). The topic stays unguessable, so a
   stranger first had to learn it (a shared computer, an extension or an XSS bug reading the page,
   an old tab before Log out), but once known it could make that page read once a second per event
   (`POKE_GAP_MS`) for as long as it stayed open, and those function calls are ours.
4. **Fixed: sends are server-only** (migration `20261128140000_poke_private.sql`). The page joins
   its topic as a **private** channel with the browser key alone, which Realtime authorises as
   `anon`, so there is still no sign-in token in the page. A policy on `realtime.messages` lets
   `anon` and `authenticated` **select** (receive) broadcasts on `p:` topics and nothing else; with
   no insert policy no client can send on a private channel, and `game.poke` sends with
   `realtime.send(..., private => true)` as the table's owner. A public channel of the same name is
   a separate channel: a send there, by socket or REST, never reaches the page. The test sends as
   the stranger by socket and by REST, private and public, and the page hears none of it while the
   server's poke arrives; with the page joining the public channel (as before) the same test
   fails, hearing the stranger three times. The page's one-a-second cap per event stays as a second
   line.

The policy reads `realtime.topic()`, which only Realtime sets while authorising a join, so a direct
select of the log by a browser role still sees nothing (`realtime` is not an API schema either).

No dashboard setting is needed: private channels and their policies work with Realtime's "Allow
public access" on, as staging and production have it. Switching it off (Calvin's call, staging
first; `docs/launch-checklist.md`, the runbook's step 10) would also refuse every public join, so
nobody could hold sockets on the project's Realtime for channels of their own. Pokes need no public
channel.

Deploying: the migration runs before the new page is served (Migrate staging on push to `main`;
Publish before `release` moves). For those minutes an open page still joined publicly hears no
pokes and reads on its safety timer (120 s, 30 s with friends, its own deadlines in a live match)
until it reloads. Production has pokes off until launch day, so it sees none of this.
`scripts/smoke.ts` joins the private channel, as the page does.
