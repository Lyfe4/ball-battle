# 0082: A Supabase Realtime "poke" in place of most polling

- Status: Accepted (2026-11-24), approved by the owner with the answers below to the proposal's
  section 7. Building: PRs 0 to 4 (groundwork, nothing wired to a screen)
- Date: 2026-11-24
- Amends: ADR 0052 (the browser opens one socket to Supabase Realtime; `connect-src` gains its
  origins), ADR 0053 ("polling now, a Realtime poke when it pays": it pays now), ADR 0079 (the
  inbox's 30 s wait becomes a slow safety read; Auth gains hooks)
- Builds on: `docs/realtime-poke-proposal.md` (the reasoning, the cost tables and the PR plan),
  ADR 0080, ADR 0081 (the poke sketched in its cost section)

## Context

Every wait in online play is a poll: the inbox every 30 s, the lobby every 2 s, a start lineup,
the live match and the end screen every second. The proposal measured it from the code: about 122
function calls an hour for an idle signed-in player with friends, about 203 per live Best of 3 per
player, and 2,900 an hour for back-to-back live play. A friend's challenge to someone who expects
nothing waits for the next 30 s read, and ADR 0079's last addendum says that delay "has now been
felt", one of the written triggers.

**The ceiling is about 60k requests a month (owner, 2026-11-24).** The site is on Netlify's
credit-based Free plan (ADR 0052): 300 credits, 2 per 10k requests and 10 per GB-hour, and compute
is most of a request's cost here (≈ 0.002 credits a request). After a dozen production deploys
(180 credits) about 60k requests remain, and past them the site stops. The owner is checking
whether the legacy 125k-invocation limit applies instead; until then every plan reads against the
tighter one. Against it, polling holds about 8 daily players of production-shaped traffic (guests,
one live Best of 3 a day); with pokes, about 25 (the proposal's section 3, Mix P: 25k a month at
10 daily players, 111k at 50). Friends-shaped traffic (Mix F) fits only about 10 daily players
even with pokes (52k), so the poke is necessary but not enough for a launch with friends on this
plan: the next lever is section 2.8's slower heartbeat or a paid plan, decided when the numbers are
real (PR 8 measures them).

## Decision

**A poke, not a feed.** The server broadcasts an event name with an empty payload, `inbox` or
`match`, on a public Realtime channel whose topic is `p:<poke_key>`: 128 random bits kept in
`game.profiles`, never derived from the user id, handed to the player's own page by
`GET /me/poke` (session-authenticated, `no-store`). On a poke the page does the complete,
idempotent read it does today, coalesced to at most one a second, so order, duplicates, loss and
forged pokes cost at most a spare read. Nothing the clock decides is poked: the page already knows
each deadline and reads at it.

**Database triggers send, on commit only.** `AFTER` row triggers with `WHEN` guards on
`game.challenges`, `game.friendships`, `game.starts`, `game.series` (when `version` changes) and
`game.rematches` call one `SECURITY DEFINER` function, `game.poke(player, event)`, which reads the
key and the kill flag and calls `realtime.send`. Every write path pokes, settle-on-read and the
sweep included, with no extra request from a function; a rolled-back write pokes nobody; a read
that changes nothing (the heartbeat writes `game.presence`) pokes nobody. No table joins the
`supabase_realtime` publication and no Presence is used.

**Today's timers stay as the socket-down mode.** A reader with its socket up waits for pokes and
keeps a slow safety read; with the socket down (off, never joined, closed, a missed heartbeat
reply) it polls exactly as today. Every move from down to up reads once.

### The owner's answers (section 7 of the proposal)

1. **Netlify limit:** plan for the tighter ceiling, about 60k requests a month (above).
2. **The publishable key reaches the page only with the Auth hooks.** A dedicated publishable key
   for the browser (revocable on its own, which is also the emergency stop for every socket); a
   Send Email hook that refuses any send our functions didn't record just before calling Auth; and
   a before-user-created hook that refuses a sign-up without the marker our functions add. All
   three are required before production; staging can go first.
3. **The socket client is our own small Phoenix client**, no dependency (`src/app/poke-socket.ts`).
4. **Yes to the inbox's 120 s safety read and `ONLINE_MS` 75 s → 150 s** (with `privacy.html`), in
   PR 5, not before.
5. **The live heartbeat stays** (a read every ~2 s, "away" after 6 s). Section 2.8 and PR 9 are
   not taken.
6. **Guests get pokes only during online flows** (their lobby, a start lineup, a live match, its
   end screen and rematch window); an idle guest opens no socket. Accounts open it while signed
   in and visible.

### Switches

Three layers, each off by default and on only locally and in tests until the owner says:
`VITE_POKE` (the build; off, no poke code is in the bundle, `check-bundle.ts`), `BALLBATTLE_POKE`
(the functions; off, `GET /me/poke` answers `{ off: true }`), and a `game.flags` row `poke`, read by
`/me/poke` and `game.poke()`, flipped with `node scripts/poke-switch.ts on|off|status` through the
Management API's SQL endpoint, with no deploy.

### Build plan

PRs 0 to 4 now, in order, each merged green before the next: this record (0); the Auth hardening
(1); the database side with the flag off (2); `GET /me/poke` and key rotation on Log out, Forget
me, Delete account and Switch (3); the socket client, `VITE_POKE` and the CSP, wired to no screen
(4). Then, each its own approval: the inbox on pokes with the 120 s safety read and `ONLINE_MS`
150 s (5); the lobby, start lineup, end screen and rematch watch (6); the live match (7); measuring,
a week's soak on staging and production on when the owner says (8).

## Consequences

- The browser talks to Supabase for the first time: one `wss:` socket, `connect-src` naming the
  staging and production Realtime origins in both header files.
- The publishable key in the page opens Auth's `/otp` and `/signup` to anyone. The hooks close
  that; until they are on in a project, its key must not ship to a page.
- Realtime messages and connections have their own free-tier quota (about 2M messages and 200
  connections). Whether socket heartbeats count as messages is measured on staging before the
  heartbeat is chosen (the proposal's risk 2).
- Two modes to keep working: the socket-down mode runs in CI with `**/realtime/**` blocked.
- `realtime.messages` rows (topic, event, time) are kept about 3 days by Supabase; the privacy
  policy names them in the PR that first sends one to a page.
