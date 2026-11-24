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

## Addendum (2026-11-24): the Auth hooks, as built (PR 1)

Both hooks are Postgres functions (`20261124090000_auth_hooks.sql`), so they run beside the data
they check, from every path, with no server of ours in the way and nothing to stand up in tests.

- **Tickets.** Just before each Auth call that may make a user or send an email, the function
  writes a ticket with `game.expect_auth(kind, ticket)` (one statement; `auth-tickets.ts`): a
  sign-up ticket (128 random bits, carried to Auth as `data.bb_ticket` in the new user's metadata)
  and an email ticket (a SHA-256 of the lower-cased address: no address is kept). Each works once,
  for 60 s; expired ones go with the next one written. `signUpGuest` and a new device's `/otp`
  carry a sign-up ticket; every code request writes one email ticket (a guest's email change that
  Auth refuses as `email_exists` sends nothing, so the same ticket serves the sign-in code after
  it).
- **Before a user is created** (`public.ballbattle_before_user_created`): a ticket, used once, or
  `provider = google` (Auth has checked Google's ID token against our client: someone who gets
  their own Google token and calls Auth directly makes only their own Google account). Anything
  else is `403`. The owner's dashboard "Add user" is refused too.
- **Before an email is sent** (`public.ballbattle_send_email`): only a sign-up or sign-in code
  (`signup`, `magiclink`) to the user's address, or a guest's first address (`email_change` for a
  user with none); never a reset, invite or reauthentication; and only with that address's ticket.
- **The hook sends the email itself.** With a Send Email hook on, Auth sends nothing of its own,
  so the hook renders the code email (the same words as `supabase/templates/code.html`, which stays
  as Auth's fallback should a hook be switched off) and hands it to `pg_net`, which posts it after
  commit: to Resend's API in a hosted project (its key in Vault), to Mailpit locally
  (`supabase/seed.sql`), as the one row of `game.mail_relay` says. Set by hand in each hosted
  project, never by a migration, so local values can't reach one.
- **Changed from today:** Resend refusing an email (a bad key, a domain problem) no longer reaches
  the player as `email_busy`: `pg_net` sends after Auth has answered, so the page says "We sent a
  code" and none comes. Its answers are in `net._http_response` (kept 6 hours). Watch it after
  switching the hooks on; if this bites, the daily check can count failures there.
- **The daily check** (`project-check.ts`) writes a ticket for its test guest once the project has
  the migration (else it signs up as before), and says whether Auth refuses a sign-up without one:
  a warning while the hooks are off, never a failure until they are required.
- **Not built here:** the dedicated browser key. It is made in the dashboard (steps below) and
  reaches the page through `GET /me/poke` in PR 3, from the functions' `SUPABASE_BROWSER_KEY`, so
  the bundle never holds a key and a key is revoked or replaced without a build.

Tests (`auth-hooks.db.test.ts`, against the local stack with both hooks on): an `/otp` straight to
Auth, for a new address or an existing account, is refused and sends nothing; a code the game asked
for still arrives (and every email sign-in test still passes through the hook); a ticket works once
and not after its minute; a sign-up without our ticket is refused with either key, with one it
works once; Google passes; a reset or invite is refused even with a ticket; only Auth may run the
hooks. Five of them were seen failing with the ticket check switched off.

### Switching the hooks on in a hosted project (owner, dashboard)

Staging first; production only before the key reaches a production page. The migration must be
applied first (staging: Migrate staging after the merge; production: the next Publish).

1. **Resend:** create an API key with sending access for `play.calvinrdevelopment.com`.
2. **Supabase → Integrations → Vault → Add new secret:** name `resend_api_key`, value that key.
3. **SQL Editor**, with the sender address from Authentication → Emails → SMTP Settings:
   `insert into game.mail_relay (kind, url, sender_name, sender_email, key_name) values ('resend',
'https://api.resend.com/emails', 'BallBattle', '<sender address>', 'resend_api_key');`
4. **Authentication → Auth Hooks → Add hook → Before User Created:** Postgres, schema `public`,
   function `ballbattle_before_user_created`, enabled.
5. **Add hook → Send Email:** Postgres, schema `public`, function `ballbattle_send_email`, enabled.
6. **Check:** sign in with an email code on the staging site (the code arrives); in the SQL Editor,
   `select status_code, created from net._http_response order by created desc limit 5` shows 200;
   `node scripts/project-check.ts staging` says Auth refuses a sign-up without our ticket.
7. **The browser key:** Project Settings → API Keys → Publishable keys → create one named
   `browser-poke`. Put it in Netlify as `SUPABASE_BROWSER_KEY`, scoped to Functions, for the
   deploy-preview and branch-deploy contexts only (PR 3 reads it).

To undo: switch the Send Email hook off (Auth sends through its SMTP again) and the before-user-
created hook off; revoke `browser-poke` to stop every socket.

## Addendum (2026-11-24): the database side, as built (PR 2)

`20261124120000_poke.sql`, expand only, with the flag off. Nothing listens yet.

- **`profiles.poke_key`**: 32 hex characters from a v4 UUID (122 random bits, `gen_random_uuid()`,
  which the API's role may call; `pgcrypto`'s `gen_random_bytes` would need a grant on the
  `extensions` schema for 6 more bits). Unique. Rotated by setting it to its default (PR 3).
- **`game.flags`**, one row `poke`, inserted off. The API's role may read it.
- **`game.poke(player, event)`**: `SECURITY DEFINER`, callable by no API or page role; returns at
  once with the flag off or no such player; otherwise `realtime.send('{}', event, 'p:' || key,
false)` inside its own exception block, so a poke that can't be written never fails the game's
  write (a lost poke is what the safety read is for). Realtime adds the message's own `id` to the
  empty payload; nothing of the game's.
- **Triggers**, each `AFTER ... FOR EACH ROW` with a `WHEN` guard on the columns a player reads:

  | Table              | When                                                                                                                                 | Who, which event                        |
  | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
  | `game.challenges`  | inserted with an invitee                                                                                                             | the invitee, `inbox`                    |
  | `game.challenges`  | `series_id`, `start_id`, `cancelled_at`, `invitee_declined_at` or `invitee` changes (never `creator_seen_at`, the lobby's heartbeat) | the sender `match`, the invitee `inbox` |
  | `game.friendships` | inserted, deleted, or answered (`accepted_at`, `declined_at`, `withdrawn_at`, `requested_by`)                                        | both, `inbox`                           |
  | `game.starts`      | `opened_*`, `locked_*` or `series_id` changes (never a draft)                                                                        | both, `match`                           |
  | `game.series`      | a live series' `version` changes (every change a player reads bumps it)                                                              | both, `match`                           |
  | `game.rematches`   | inserted, or `agreed_at`, `declined_by`, `new_series_id` changes                                                                     | both, `match` and `inbox`               |

  A start's insert is not poked: it always comes with the challenge's or rematch's own change.

- **Realtime runs locally** (`supabase/config.toml`) and in CI's database and online jobs: its
  service is what creates `realtime.send` and `realtime.messages` in the local database.

Tests (`poke.db.test.ts`): one `match` to each player for a live pick and none for a plain read
(the heartbeat); none when the change rolls back; none with the flag off; the topic is
`p:` and 32 hex characters, never the user id, the payload only Realtime's id, not private;
friends' request, answer and removal poke both inboxes and a no-op update pokes nobody; a friend's
challenge reaches the invitee, a decline the sender's lobby, the lobby heartbeat nobody; a start's
open and lock poke both, a draft nobody; a rematch's ask and answer poke both twice; only the
database may call `game.poke`. Four were seen failing with the series trigger dropped and the
`WHEN` guards removed.

## Addendum (2026-11-24): GET /me/poke, the key's rotation and the switch, as built (PR 3)

- **`GET /api/v1/me/poke`** (`routes/poke.ts`, `src/api/poke.ts`), any player with a session,
  `private, no-store`, counted as a read: `{ url, key, topic }` (Realtime's socket for the
  project, the browser key, `p:` and the player's key) only while the functions have
  `BALLBATTLE_POKE=1` and the database's flag is on; otherwise `{ off: true }`, and the page polls
  as it always has. The browser key comes from the functions' `SUPABASE_BROWSER_KEY`, required
  once `BALLBATTLE_POKE=1` (a `ConfigError` names it): never the functions' own publishable key
  and never in the bundle, so revoking or replacing it needs no build. A guest is answered too;
  when a page asks is the page's choice (decision 6, PR 5 on).
- **Rotation.** Log out (`DELETE /session`) gives the player a new key after the in-a-match check,
  so a topic an old page or anyone else learned goes quiet. Forget me, Delete account and the
  guest that Switch deletes take their key with their profile. Linking a guest keeps its user id
  and its key.
- **`scripts/poke-switch.ts status|on|off local|staging|production`** flips the flag through the
  Supabase CLI's SQL (the Management API) or, for `local`, the stack's database; production on
  needs `--production` as well. Off is never refused.

Real use: a family iPad where one player logs out and another signs in gets a new topic, so the
first player's pokes (only timings) no longer reach that device's page; a guest who taps Forget me
mid-way leaves no topic behind. Two tabs share one key, as they share one session.

Tests: `routes/poke.db.test.ts` (a guest's own topic, the browser key and the socket, `no-store`,
no user id; off with the flag off; off without `BALLBATTLE_POKE`; 401 without a session; a new key
after Log out, seen failing without the rotation; gone on Forget me and Delete account; on Switch
the guest's key goes and the account answers with its own), `config.test.ts` (the switch needs
online play and the browser key) and `poke-switch.test.ts`.

## Addendum (2026-11-24): the socket client, the build switch and the CSP, as built (PR 4)

Nothing imports the socket yet: no screen listens, and every build's bundle is as before.

- **`src/app/poke-socket.ts`**, our own Phoenix 1.0.0 JSON client (decision 3), about 250 lines
  with no DOM types (the page comes in through `PokePage`; `poke-page.ts` is the browser's). It
  opens `url?apikey=<browser key>&vsn=1.0.0`, joins `realtime:<topic>` as a public channel
  (`private: false`, no self-broadcast, no Presence), and is **up** only once the join is
  answered `ok`; `onState` says each change. It is **down** on a refused or unanswered join
  (10 s), a heartbeat not answered by the next one, `phx_error`/`phx_close`, an error or a close,
  and then retries after 1, 2, 5, 10, then every 30 s, back to 1 s after a good join. A broadcast
  of `inbox` or `match` on its topic is handed on, at most one of each a second (a flood, forged or
  not, is one read a second and the last one is never lost); anything else is ignored. Hidden for
  10 s it closes (a quick app switch keeps it), shown it reopens; `pagehide` closes it (an open
  socket can keep a page out of the back/forward cache), `pageshow` reopens it; nothing opens
  while hidden. It never reads: the screens read on a poke and on every move from down to up
  (PR 5 on).
- **Heartbeat 25 s** (realtime-js's default), not the proposal's 15 s, until staging's measurement
  says whether heartbeats are billed messages (the proposal's risk 2). A dead socket is then
  noticed within about 50 s; while it looks up, the screens' safety reads still run.
- **`VITE_POKE`** (`POKE_BUILD`, `src/app/poke-build.ts`): only with online play, and unset in
  every Netlify context for now (previews and staging included: the owner's rule for this run),
  so `netlify.toml` builds nothing new. `scripts/check-bundle.ts` refuses the poke's route,
  Realtime's socket path or a Phoenix join in a build without it.
- **CSP**: `connect-src 'self' wss://<staging>.supabase.co wss://<production>.supabase.co` in
  `netlify.toml` and `scripts/security-headers.ts` (a test keeps them equal and checks the refs
  against `supabase-projects.ts`); `pnpm preview` alone adds the local stack's
  `ws://127.0.0.1:54321` (`LOCAL_SECURITY_HEADERS`), and the test checks `netlify.toml` never holds
  a local address. **`netlify dev` serves `netlify.toml`'s headers, so a page there can't reach
  the local Realtime under the CSP**: PR 5's online tests need a way round that (a dev-only header
  rule, or testing the socket under `pnpm preview`), decided there.
- **Checked in Chromium, Firefox and WebKit** (a scratch Playwright run, not a CI test: the browser
  jobs have no Supabase): the real socket under `pnpm preview`'s CSP joined the local Realtime,
  received `match` and `inbox` from `game.poke()` about 10 ms after the write, ignored a broadcast
  to another topic, logged no CSP or console error, and closed cleanly.
- **Found doing it:** Realtime starts a project's database replication only when its first client
  connects; messages written before that are not broadcast. Locally that is the first socket
  after `supabase start`. Hosted projects may do the same after an idle spell, so the first pokes
  after a quiet hour can be lost: the read on every move to up, and the safety reads, cover it.

Tests: `poke-socket.test.ts` (fake WebSocket and timers: the join and its URL, up only on `ok`, a
refused and an unanswered join, a missed heartbeat, the backoff sequence and its reset, Realtime
closing the channel, known pokes only and only on its topic, a flood coalesced, hidden and shown,
`pagehide` and `pageshow`, `close()` for good, nothing opened while hidden; five seen failing
with the heartbeat check, the coalescing, the hidden close and the `pagehide` close switched off),
`check-bundle.test.ts` and `security-headers.test.ts`.

## Addendum (2026-11-24): the owner's measurements, and the mail watch

**Heartbeats are not billed as Realtime messages** (owner, from Supabase's usage page: staging's
24 November shows about 200 messages, matching the pokes sent, not the ~900 socket heartbeats of
that day's testing). So the proposal's risk 2 is closed and the socket heartbeats every **15 s**,
as the proposal planned (PR 5 changes `poke-socket.ts`): a dead socket is noticed within about
30 s instead of 50 s.

**Netlify is the legacy free plan** (owner): 125k function calls a month, not credits. The
ceiling in the Context above is therefore 125k, not about 60k; the proposal's section 3 already
reads against 125k (Mix P to about 55 daily players with pokes, Mix F to about 25). Build minutes
(300 a month) are now the tighter budget during development: one push per pull request.

**The mail watch** (`20261124190000_mail_watch.sql`). With the Send Email hook on, a code email
Resend refuses is silent: pg_net posts after Auth has answered, so the player reads "We sent a
code" and nothing comes, and pg_net keeps its answer in `net._http_response` for only 6 hours
(`pg_net.ttl`, checked on staging), with no URL to tell our sends from any other.

- The hook now notes each send's pg_net request id in `game.mail_sends`: an id, a time and, once
  copied, the answer's HTTP status. No address, no code, no player; kept 7 days. Not personal
  data, so `privacy.html` is unchanged.
- Answers are copied before pg_net drops them by the next send and by `/api/v1/health`
  (`game.mail_watch()`, the API's role), which an uptime monitor reads every few minutes.
- `game.mail_outcomes(hours)` counts the last day's sends, those refused or never answered (a
  status outside 2xx, a timeout, a connection error) and those whose answer went before anyone
  copied it (`unseen`; a send under 2 minutes old with no answer is on its way, in neither). It only
  reads, so the daily check calls it through the read-only SQL endpoint on both projects.
- **Alerts:** the daily check (`project-check.ts`, `supabase-daily.yml`) fails on any refused send
  in the last 24 h, so GitHub emails you; `unseen` is a warning on the run. `/api/v1/health` adds
  `emailSends` (`ok`, `failing`, `unseen`, `unknown`), never changing its status: an UptimeRobot
  keyword monitor for `"emailSends":"ok"` on a deploy's health alerts within minutes (staging's, and
  production's when accounts ship). A deploy ahead of the migration says `unknown`, never `down`.

Tests: `mail-watch.db.test.ts` (a delivered code; a code the relay refused while Auth answered
200; a refusal kept after pg_net drops it, copied by the next send and by health's read; unseen
and on-its-way; the 24-hour window and the 7-day drop; no page role may read it, the API only
health's function; three seen failing with the copy switched off), `health.db.test.ts`
(`emailSends`) and `supabase-tools.test.ts` (the check's wording).

## Addendum (2026-11-24): the inbox on pokes, as built (PR 5)

- **One socket per page** (`src/app/poke-hub.ts`, `pokes.ts`): readers `want()` it and `listen()`
  for pokes and up/down; it opens with the first reader (asking `GET /me/poke` where to listen) and
  closes with the last, so an idle guest opens none (decision 6). It asks again when a page hidden
  long enough for its socket to close shows again, and when the inbox is told the player may have
  changed (a sign-in, a switch): pokes switched off by the flag, or a new key after Log out, reach
  an open page without a reload. A failed ask is off. Without `VITE_POKE`, `pokes` is undefined and
  none of it is bundled.
- **The inbox** (`inbox-poll.ts`, `inbox-watch.ts`) wants the socket while an account is signed
  in. Up, an `inbox` poke reads at once and the only timer is a safety read every 120 s
  (`INBOX_SAFETY_MS`), expecting or not; every move to up reads once. Down, the 30 s and 2 s
  timers apply exactly as before, from the moment it goes down. A friendless account now hears its
  first friend request at once (it had no timer before, and still has none down).
- **`ONLINE_MS` 75 s → 150 s**, and `privacy.html` with it, which also names the update channel's
  key and Realtime's 3-day record of each signal (`legal-pages.test.ts`).
- **The socket heartbeats every 15 s** (the addendum above).
- **`netlify dev`'s CSP and the local Realtime**: netlify.toml stays free of any local address
  (`security-headers.test.ts`). The online flows' phones instead have each page's policy rewritten
  on its way in (`src/flows/realtime-support.ts`, `realtime-policy.ts`) to exactly the policy
  `pnpm preview` serves (`LOCAL_SECURITY_HEADERS`; the test checks they are equal). A page that a
  Playwright route fulfils has no address, so Chromium's Local Network Access check counts it as
  public and refuses a loopback socket: the flows grant `local-network-access` to their own origin.
  Neither reaches anything but a test. Locally and in CI, pokes are on: `build:online` sets
  `VITE_POKE`, `local-env.ts` writes `BALLBATTLE_POKE` and the stack's publishable key as the
  browser key, and `supabase/seed.sql` turns the flag on.
- **Online tests** (`inbox-poke.online.test.ts`): with the socket up, a stranger's friend request
  and a friend's challenge each reach a phone on home within 3 s, read right after an `inbox` poke
  and well inside the 120 s safety wait (seen failing with the flag off); with `**/realtime/**`
  blocked (`routeWebSocket` closing every socket), both arrive on the 30 s reads and no socket is
  ever up.

Tests: `poke-hub.test.ts` (one socket for every reader, closed with the last; off and a failed ask
stay down; pokes and up/down to each listener; an answer after everyone let go is dropped; asked
again after a long hide and on a possible new player, a new topic reopens and off closes),
`inbox-poll.test.ts` (up: a read on each poke and move to up, then 120 s; down: today's timers at
once; nothing to watch keeps no timer), `poke-socket.test.ts` (15 s), `security-headers.test.ts`,
`legal-pages.test.ts`, `inbox.db.test.ts` (online until 150 s).
