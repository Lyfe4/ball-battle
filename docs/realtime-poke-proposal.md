# Proposal: a Supabase Realtime "poke" in place of most polling

- Status: approved (2026-11-24) with the owner's answers to section 7, recorded in ADR 0082
  (`docs/decisions/0082-realtime-poke.md`), which is the decision; this is its reasoning and numbers.
- Builds on: ADR 0052 (the backend and its costs), ADR 0053 (live matches; "polling now, a Realtime
  poke when it pays"), ADR 0079 (accounts, the inbox poll and its cost table), ADR 0080 (lineups
  together), ADR 0081 (the poke sketched in its cost section), `docs/accounts-and-friends-proposal.md`
  ("Moving off polling").
- Trigger reached: ADR 0079's last addendum says the 30 s wait for a friend's challenge "has now been
  felt", which is one of the written triggers.

## 1. Where we are today

### What polls, and how often (read from the code, `main` at e0aec30)

| Who reads                        | Where                                    | Cadence                                                                                                                                     | Route                    |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Inbox (accounts only)            | `src/app/inbox-poll.ts`                  | at start; 30 s while visible with something to watch; 2 s while `expecting`; never hidden                                                   | `GET /me/inbox`          |
| Who am I (accounts builds)       | `src/app/who-am-i.ts`, `online-mount.ts` | once per page load, only where the hint cookie or storage says there may be a player; again on the next tab screen after Profile or sign-in | `GET /me`                |
| Back to your match               | `online-mount.ts` (`HOME_ASK_MS`)        | once per home visit with a guest; every 10 s while it shows                                                                                 | `GET /me/match`          |
| Sender's lobby                   | `online-challenge.ts` (`LOBBY_POLL_MS`)  | 2 s (it is also the lobby's heartbeat, `LOBBY_SEEN_MS` = 60 s)                                                                              | `GET /challenges/:token` |
| Start lineup (ADR 0080)          | `start-lineup.ts` (`ASK_MS`)             | 1 s for up to 60 s (75 s Best of 5)                                                                                                         | `GET /starts/:id`        |
| Live match                       | `src/app/live-ask.ts`                    | 1 s while the other player can move, else 2 s (shortened after a slow read so heartbeats stay ≤ 3 s apart)                                  | `GET /series/:id` (ETag) |
| End screen, rematch              | `online-rematch.ts` (`ASK_MS`)           | 1 s while a rematch can be asked (≤ 2 min) or is under way                                                                                  | rematch read             |
| Rematch watch, away from the end | `rematch-watch.ts` (`ASK_MS`)            | 2 s for ≤ 3.5 min after a live match                                                                                                        | rematch read             |
| By-turns series (hidden)         | `online-live.ts` (`TURNS_POLL_MS`)       | 15 s                                                                                                                                        | `GET /series/:id`        |
| Sweep                            | scheduled function                       | every 15 min (≈ 2,900 a month)                                                                                                              | `sweep`                  |

Not a function call: the new-version check (`build-check.ts`) fetches the static `index.html`.

### Function calls per player per hour (visible page; a hidden page makes none)

| Player                                                   | Calls today                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Guest idle on Play (production: online on, accounts off) | **≈ 0 an hour**: one `/me/match` per home visit, and only on a device with a guest. Staging adds one `/me` per page load. |
| Signed in, idle, with friends                            | **≈ 122**: inbox every 30 s (120), plus `/me` and `/me/match` once per load                                               |
| Signed in, idle, no friends                              | **≈ 2 per page load**, then nothing (their first friend request waits for the next load)                                  |
| Waiting on a challenge (sender in the lobby)             | **3,600 an hour** signed in (lobby 2 s + inbox 2 s), **1,800** as a guest. A 2-minute wait: 120 / 60                      |
| Being challenged, expecting nothing                      | 120 an hour; the card lands with the next 30 s read (15 s on average)                                                     |
| Live friend match, back to back                          | **≈ 2,900 an hour** (one Best of 3 cycle ≈ 203 calls in ≈ 4¼ min, below)                                                  |

One live Best of 3, per player: lineup 1 s × ~45 s = **45**; the match, measured in ADR 0053's
adaptive-polling table (104 to 126 requests for both phones, 2 fights) ≈ **24 a minute**, ≈ **60**;
picks, accept and lock ≈ **8**; one minute on the end screen (1 s, plus the inbox at 2 s) ≈ **90**.
Total ≈ **203**. Sitting the whole 2-minute rematch window adds ~90 more.

**Netlify logs:** the CLI is logged in to `battle-ball`, but it only streams live function logs; it
has no historical counts. The numbers above come from the code and ADR 0053's measured runs. The
real monthly count is on the dashboard (Usage → Functions); worth a look to check this model.

### Against the 125k a month, at 10, 50 and 200 daily players

Two usage mixes per daily player per day, 30-day month, plus ≈ 3k fixed (the sweep, health checks):

- **Mix P (production today: accounts off, guests only):** one live friend Best of 3 a day (203), and
  half of them sent the link and waited 2 minutes in the lobby (≈ 30). ≈ **235 a day**, 7k a month.
- **Mix F (friends shipped):** 30 minutes signed in with friends (25 idle: ≈ 56), two live Best of 3
  (406), one 2-minute lobby (120). ≈ **580 a day**, 17.4k a month.

| Daily players | Mix P, calls a month | of 125k    | Mix F, calls a month | of 125k    |
| ------------- | -------------------- | ---------- | -------------------- | ---------- |
| 10            | ≈ 73k                | 58%        | ≈ 177k               | **142%**   |
| 50            | ≈ 355k               | **284%**   | ≈ 873k               | **698%**   |
| 200           | ≈ 1.41M              | **1,130%** | ≈ 3.48M              | **2,780%** |

**Check the limit itself (a decision for you):** 125k invocations is the legacy Netlify free plan.
ADR 0052 says the site is on the credit-based Free plan: 300 credits, 2 per 10k requests plus 10 per
GB-hour, and compute is ~90% of a request's cost here (each read waits ~630 ms on Sydney from
Ohio). That is ≈ 0.002 credits a request, so 125k requests ≈ 245 credits. After 12 publishes (180
credits) the real ceiling is **≈ 60k requests a month**, and past it the site stops. Every table here
counts calls, so it reads against either plan.

## 2. The design

### 2.1 The poke model

- **The server stays the source of truth.** A poke is a broadcast with an event name and an empty
  payload: `inbox` or `match`. No ids, no versions, no game data.
- **On a poke the page does the read it does today.** `inbox` calls `poll.poke()` (it already exists
  and already coalesces: `busy` / `again` in `inbox-poll.ts`). `match` makes whichever online screen
  is showing (lobby, start lineup, live match, end screen, rematch watch) read now. A poke for an old
  series just costs one spare read of the current one.
- **Order, duplicates and loss don't matter**, because every read is complete and idempotent. Two
  pokes before a read is back become one more read (as `again` does today). A lost poke is caught by
  the safety read (below).
- **What the clock decides is not poked.** A pick running out, a start window closing, a rematch
  offer expiring: these are settled on read (ADR 0053). The page already knows each deadline from the
  view, so it reads at that deadline (plus a small margin), as the rematch watch does today.

### 2.2 What pokes, and what stays polled

| Event                                                           | Poked               | To whom                 | Fired by (table, change)                     |
| --------------------------------------------------------------- | ------------------- | ----------------------- | -------------------------------------------- |
| A friend's challenge arrives                                    | `inbox`             | the invitee             | `game.challenges` insert with `invitee`      |
| Challenge accepted / declined / taken / stopped                 | `match` and `inbox` | the sender, the invitee | `game.challenges` update of its state        |
| Friend request sent / accepted / declined / cancelled / removed | `inbox`             | both sides              | `game.friendships` insert, update, delete    |
| Start lineup: opponent opened, locked, start made               | `match`             | both players            | `game.starts` update                         |
| Live match: pick locked, round settled, forfeit, end            | `match`             | both players            | `game.series` update where `version` changed |
| Rematch asked / answered / its lineup opened                    | `match` and `inbox` | both players            | `game.rematches` insert, update              |

**Stays polled, and why:**

1. **The live-match heartbeat (2 s).** Presence (`game.presence`) is written by the player's own read,
   and the other phone says "disconnected" after 6 s without one. A socket's presence is no use here:
   our server can't see it, and on a public channel it can be faked. So a live match keeps a read
   every ~2 s; the pokes replace only the 1 s reads while waiting on the other player. (Section 2.8
   has a further option.)
2. **The lobby's heartbeat**, slowed from 2 s to **20 s**: it only has to keep `creator_seen_at` inside
   `LOBBY_SEEN_MS` (60 s). Accept and decline arrive by poke.
3. **Friends' online status.** "Online" means "a request within `ONLINE_MS` (75 s)". Nothing is
   written when someone goes offline, so there is nothing to poke. It refreshes with the safety read.
   **This depends on `ONLINE_MS`:** with a 2-minute safety read, an idle friend whose page is open
   would show offline. So `ONLINE_MS` goes from 75 s to **150 s** in the same PR, and `privacy.html`
   with it (`legal-pages.test.ts` reads the number).
4. **`/me/match` on home** (10 s while "Back to your match" shows). It's rare and short-lived. It can
   take `match` pokes later.
5. **Play by turns** (hidden). Unchanged.

### 2.3 Channels, and who can listen

Our sessions are HttpOnly `__Host-bb_session` cookies holding Supabase tokens that page JavaScript
can never read (`src/server/cookie.ts`), and the browser never talks to Supabase today
(`src/server/auth.ts`, header comment). Realtime's private channels authorise a subscriber by a
Supabase JWT, checked by RLS on `realtime.messages`. The options:

| Option                                                                   | How the page gets in                                                                                    | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Private channels, using the session's own access token in JS          | hand the access token to the page                                                                       | **No.** It breaks the HttpOnly rule. That token can call Auth as the user (`PUT /auth/v1/user` changes the email), so an XSS would become an account takeover.                                                                                                                                                                                                                                                                              |
| B. Private channels with a short-lived token our function mints          | `GET /me/poke` signs a JWT (`sub`, a listener role, 10-minute expiry)                                   | **Not now.** Projects use asymmetric signing keys (ES256/RS256/EdDSA, JWKS), so Realtime only accepts a token signed by a key Supabase holds. Minting one means importing our own private key as a project signing key. Auth, the Data API and our own `verifyAccess` (which trusts the JWKS) would then also accept the token, unless every one of them checks a claim. That is a big new secret and a big change, for little gain over C. |
| **C. A public channel on an unguessable per-player topic (recommended)** | `GET /me/poke` returns the topic `p:<poke_key>`, where `poke_key` is 128 random bits in `game.profiles` | **Yes.** No token in JS. Pokes carry nothing, so a leaked topic gives away only _when_ that player's inbox or match moved, and lets someone cause spare reads, which the page caps.                                                                                                                                                                                                                                                         |
| D. A second Supabase project used only as a relay                        | its own publishable key, broadcasts sent by our functions with its secret key                           | Safer key exposure (section 2.4), but the free tier allows 2 active free projects and staging and production already use them. Every write path would also have to remember to send. Kept as the fallback if the key risk in 2.4 is judged too high.                                                                                                                                                                                        |

**Senders: database triggers rather than our functions.** Sending from the functions means
`POST /realtime/v1/api/broadcast` with the secret key, after commit, on every write path. Settled-on-
read changes (a random pick at its deadline, a forfeit made in the sweep or in the other player's
read) are easy to miss that way, and each send adds an Ohio → Sydney round trip to a billed
function. With triggers instead:

- `AFTER INSERT/UPDATE/DELETE ... FOR EACH ROW WHEN (...)` on the six tables above, calling one
  `game.poke(player uuid, event text)`. It is a `SECURITY DEFINER` wrapper (fixed `search_path`,
  execute revoked from `public`, `anon`, `authenticated`) that looks up `poke_key`, checks the kill
  flag and calls `realtime.send('{}', event, 'p:' || poke_key, false)`.
- It goes out **only on commit** (a rolled-back write sends nothing), from **every** path including
  settle-on-read and the sweep, with **no extra request** from the function. That fits the pooler
  rule of one query at a time per connection.
- `WHEN (old.version is distinct from new.version)` on series, and the equivalent on the others, so
  a read that changes nothing pokes nobody (this matters: the heartbeat writes `game.presence`, not
  the series row).

**Hardening on C:**

- **Topic secrecy:** `poke_key` is 16 random bytes (`gen_random_bytes`), never derived from the user
  id. It is sent only by `GET /me/poke` (session-authenticated, `no-store`) and never logged.
- **Rotation:** a new `poke_key` on Log out, Forget me, Delete account, "Switch to it?" (the deleted
  guest's rows go anyway) and on demand. Linking a guest to an account keeps the user id and can keep
  the key.
- **Forged pokes:** on a public channel, anyone who knows the topic can also _send_ to it. The page
  treats a poke only as "read now, if you haven't for 1 s": coalesced, at most one read per second per
  reader. Worst case is today's 1 s cadence, well inside `LIMITS.reads` (900 per 5 minutes per session).
- **No other data on Realtime:** no table joins the `supabase_realtime` publication (no Postgres
  Changes), and no Presence is used. The `game` schema stays revoked from `anon` and `authenticated`.

### 2.4 The security cost of the publishable key (the real decision)

Any Realtime socket needs the project's publishable key in the page. **Today that key never leaves
the functions,** and they use it with Auth (`tokenCall`, `signOut`). Once it is in the bundle, anyone
can call the hosted Auth endpoints directly from their own IP:

- `POST /auth/v1/otp`: **email codes to any address, skipping our caps** (`LIMITS.codes*`: 90 a day,
  2,700 a month). Auth's own project-wide email-per-hour limit then becomes the only cap. An attacker
  can spend it, so real players get no code (a sign-in DoS), and they can spam from our sender.
- `POST /auth/v1/signup`: anonymous users with no profile. They can't use our API (`sessionOf`
  requires a profile), but they count as users and sit in `auth.users` until swept.

Mitigations, in order of preference (must-do before the key reaches **production**; staging can go
first):

1. **A dedicated publishable key for the browser** (the new API keys allow several), so it can be
   revoked on its own. That is also the emergency kill switch for every socket.
2. **Auth hooks that refuse what we didn't start:** a Send Email hook (our function) that sends only
   when `rate_limits` holds the matching send we recorded just before calling `/otp`; and a
   before-user-created hook that refuses sign-ups without the marker our `signUpGuest` adds. This
   closes the bypass for good.
3. At minimum, set Auth's own email limit at or below ours and watch it, accepting the DoS risk.

If none of these is acceptable, option D (a relay project) or staying on polling are the honest
alternatives.

### 2.5 Fallback, and when the socket can't be trusted

The page runs in one of two modes, per reader:

- **Socket up** (joined and the last heartbeat answered): readers wait for pokes, with slow safety
  reads: **inbox every 120 s** (was 30 s), lobby 20 s, live match heartbeat as today, lineup and end
  screen only on poke and at deadlines.
- **Socket down**: **today's cadences exactly** (the current timers stay in the code as this mode).
  This covers: `/me/poke` says off; no join within 10 s; a socket error or close; a missed heartbeat
  reply. Every move from down to up reads once, since messages sent while down are lost.

| Case                                           | What happens                                                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab hidden                                     | No reads, as today. The socket closes after 10 s hidden (a quick app switch keeps it). On show: reconnect and one read, as today's visibility read.                                                                                       |
| `pagehide` / bfcache                           | Close the socket (an open WebSocket keeps a page out of the back/forward cache in some browsers).                                                                                                                                         |
| Socket drops on a flaky phone                  | Back to today's timers at once. Rejoin with backoff (1, 2, 5, 10, 30 s). Heartbeat every 15 s, so a dead socket is noticed within ~30 s.                                                                                                  |
| Realtime down, or a network that blocks `wss:` | Never joins, so polling exactly as today. Players notice nothing but the delay.                                                                                                                                                           |
| Kill switch flipped while pages are open       | Pokes stop. Live screens keep their 2 s heartbeat (a pick shows within ~3 s). The inbox falls back to its 120 s safety read until the next `/me/poke` (every page load and every return to visible) says off and restores today's timers. |

### 2.6 CSP and headers

- `connect-src 'self' wss://<staging-ref>.supabase.co wss://<production-ref>.supabase.co`, in
  `scripts/security-headers.ts` and `netlify.toml` together (`security-headers.test.ts` keeps them in
  step). Only `wss:` is needed, since the page never calls Supabase over HTTPS. The origin is named
  explicitly because older Safari doesn't match `wss:` to `'self'`. One CSP serves every context, so
  both project origins are listed.
- `netlify dev` and `pnpm preview` need the local Realtime origin (`ws://127.0.0.1:54321`). Add it in
  the local header set only, and let the test allow that one difference, so it never ships.
- No `worker-src`: no Web Worker. Trusted Types are unaffected (no HTML sinks). COOP, CORP and
  `Referrer-Policy: no-referrer` don't touch WebSockets.
- `scripts/check-bundle.ts`: no poke code, Realtime URL or key in a build without online play.

### 2.7 Accounts off in production

Yes, guests get pokes too, **but only during an online flow**: their lobby, a start lineup, a live
match, its end screen and rematch window. Those are exactly the guest flows that poll at 1 to 2 s
today. Guests have sessions and profiles (anonymous Auth users), so they get a `poke_key` like anyone.
An **idle** guest opens no socket: they have no inbox, so there is nothing to poke. That keeps
connections for people actually playing. Accounts open the socket whenever signed in and visible.

### 2.8 Optional, your call: a slower live heartbeat

The heartbeat is what's left of a live match's cost. With `AWAY_AFTER_MS` 6 s → 12 s and a 4 s
heartbeat, match reads roughly halve. "Opponent disconnected" would show after ~12 s instead of ~6 s,
and the time to a forfeit would be 42 s, or 36 s if `GRACE_MS` drops to 24 s. That changes a rule you
set (ADR 0053), so it is a separate decision. The numbers below show both.

## 3. Cost with the poke

### Function calls per player

| Player                        | Today           | With pokes                                                           |
| ----------------------------- | --------------- | -------------------------------------------------------------------- |
| Guest idle on Play            | ≈ 0 an hour     | ≈ 0 (no socket)                                                      |
| Signed in, idle, with friends | ≈ 122 an hour   | ≈ 33 (safety read 30, `/me/poke` and loads ~3)                       |
| Signed in, idle, no friends   | ≈ 2 per load    | ≈ 3 per load, and their first request now arrives at once            |
| Sender, 2-minute lobby wait   | 120 (guest 60)  | ≈ 9 (lobby 6, a poke read, `/me/poke`)                               |
| One live Best of 3 cycle      | ≈ 203           | ≈ 66 (lineup 4, match ~54, picks 4, end screen 4); **≈ 41** with 2.8 |
| Live play, back to back       | ≈ 2,900 an hour | ≈ 930 an hour; **≈ 580** with 2.8                                    |

### Monthly, same mixes as section 1

| Daily players | Mix P today | Mix P poke | (with 2.8) | Mix F today | Mix F poke | (with 2.8) |
| ------------- | ----------- | ---------- | ---------- | ----------- | ---------- | ---------- |
| 10            | 73k         | **25k**    | 17k        | 177k        | **52k**    | 37k        |
| 50            | 355k        | **111k**   | 74k        | 873k        | **246k**   | 171k       |
| 200           | 1.41M       | **435k**   | 285k       | 3.48M       | **975k**   | 675k       |

So, against 125k: pokes keep production-shaped traffic under the limit up to about **55 daily
players** (about 80 with 2.8), and friends-shaped traffic up to about **25** (35). At 200 daily
players either way needs a paid plan. On the credit plan's real ceiling (~60k), pokes take Mix P from
about 8 daily players to about 25.

### Supabase Realtime, free tier

ADR 0053's figures: **200 concurrent connections, 100 messages a second, about 2M messages a
month** (and 100 channel joins a second). Re-check them on Supabase's pricing page in PR 1.

- **Messages:** about 40 pokes per Mix F player-day (two matches ≈ 30, inbox ≈ 5, lineup and end
  ≈ 5). Counting both send and delivery to be safe, that is 80. At 200 daily players, 80 × 200 × 30 ≈
  **480k a month, 24% of 2M**. Whether socket heartbeats count is to verify. If they do, a 15 s
  heartbeat is 240 an hour per open socket: ~25 average sockets ≈ 4.3M a month, **over the limit**.
  In that case use realtime-js's 25 s default (≈ 2.6M, still tight) or 30 s. **This is the number to
  measure on staging first.**
- **Connections:** 200 daily players × 30 minutes, spread over ~4 evening hours ≈ 25 on average,
  ~60 at peak (more with second tabs). The 200 limit arrives at roughly 600 to 800 daily players.
- **Database:** `realtime.messages` rows are tiny and Supabase drops their partitions after ~3 days.
  Staging and production are separate projects, so each has its own quota.
- **Privacy:** those rows (topic, event, time) are kept ~3 days, and `ONLINE_MS` changes. Both go in
  `privacy.html` with its date, in the PRs that make them.

## 4. Rollout

- **Switches, three layers:**
  1. Build: `VITE_POKE` beside `VITE_ONLINE`. Previews and `main` on; production on only when you say
     (like the friend switch). Off, none of the code is in the bundle.
  2. Functions: `BALLBATTLE_POKE`. Off, `GET /me/poke` answers `{ off: true }` and pages poll as today.
  3. **Instant, no deploy:** a `game.flags` row (`poke`), read by `/me/poke` and by `game.poke()`.
     Flipped with `node scripts/poke-switch.ts on|off|status` through the Management API's SQL endpoint
     (the same token as the daily checks). A Netlify env change needs a redeploy (15 credits in
     production), so it can't be the instant switch. Emergency stop for every open socket: revoke the
     browser's publishable key (2.4).
- **Staging first:** previews and `main` share the staging project. Soak a week there with the two-
  iPhone playtest (ADR 0070) and `scripts/live-measure.ts` rerun. Then turn production on.
- **Tests:**
  - Unit: the socket client against a fake WebSocket (join, rejoin backoff, heartbeat timeout → down,
    coalescing, unknown events ignored, close on hidden and `pagehide`). `inbox-poll.test.ts` gets both
    modes (up: 120 s safety; down: today's cadences unchanged), plus `live-ask` and lineup deadlines.
    Each is first shown failing with the poke disabled.
  - Database (`test:db`, with Realtime enabled in `supabase/config.toml`, off today): exactly one
    `realtime.messages` row per change, to the right topics; none on a no-op update; none when rolled
    back; none with the flag off; the topic never contains a user id; a new key after Log out, Forget
    me and Switch.
  - Online (`test:online`, two Chromium phones against `netlify dev` and the local stack): the safety
    timers set long, so **only a poke can explain the arrival**. A friend's challenge lands in < 3 s
    with no inbox read in between. A request accepted. The start lineup's "ready". A pick reaching the
    other phone in < 1.5 s. A rematch. Then the same flows with `**/realtime/**` blocked
    (`page.route`), finishing on today's polling. Then the flag turned off mid-session.
  - CSP: `security-headers.test.ts`, and the `pnpm preview` console clean with a socket open.
- **CI:** the `test:db` and `test:online` jobs start the Realtime container too (a few seconds). If a
  job is added or renamed, update the ruleset list in the same PR.

## 5. Risks

1. **The publishable key opens Auth to the browser (2.4).** The biggest risk. It is why the Auth
   hardening is a must before production.
2. **The message quota, if heartbeats count (3).** Measure on staging before choosing the heartbeat.
3. **Realtime quietly drops messages** (at most once; nothing replayed on a public channel). The
   safety reads and "read on every rejoin" cover it, but a dead-yet-open socket can delay an idle
   player's challenge by up to 2 minutes. The 15 to 30 s heartbeat bounds how long it stays "up".
4. **An online status that is less fresh:** offline shows after up to 150 s, not 75 s.
5. **Trigger load:** a trigger that fires on a hot path (presence, a no-op update) would spam pokes.
   The `WHEN` clauses and the "none on no-op" database test guard it.
6. **Two tabs or two devices** each hold a socket (more connections) and each read on a poke. Fine at
   this scale. One socket per browser through a `BroadcastChannel` can come later if needed.
7. **iOS:** a closed or backgrounded page gets neither a poll nor a poke. Reaching it still needs push
   and the app release (unchanged).
8. **Two modes to keep working.** The fallback is today's code, but it only runs when the socket is
   down, so the blocked-socket online flows must keep running in CI.

### Library and platform behaviour this relies on (verify each in its PR)

- **Realtime broadcast, public channel:** anyone with the publishable key and the topic can subscribe
  _and send_. Delivery is at most once. Messages sent while a client is disconnected are lost (replay
  is private-channel only).
- **`realtime.send(payload, event, topic, private)`:** inserts into `realtime.messages`. Delivered after
  commit from the WAL. Rolled back means not sent. Partitions kept ~3 days. Which roles may execute it
  (hence the `SECURITY DEFINER` wrapper) is to verify.
- **Phoenix channels protocol:** a join reply or a timeout (realtime-js: 10 s). Client heartbeats
  (realtime-js default 25 s), and the server drops a socket that misses them. Rejoin is the client's job.
- **Supabase limits:** connections, messages a second and a month, joins a second, message size. Do
  heartbeats count? Verify.
- **Supabase Auth with the publishable key:** `/signup`, `/otp` and `/token` accept it, so they are
  open to the browser once it ships (2.4). Hooks are available on the free plan: verify.
- **Netlify:** functions can't hold sockets. Env changes need a redeploy. Requests and GB-hours are
  billed, and preview functions bill the same credits.
- **Browsers:** CSP `connect-src` governs `wss:`, and older Safari doesn't match `wss:` to `'self'`.
  Hidden tabs throttle timers. iOS suspends hidden pages and drops their sockets. An open WebSocket
  can keep a page out of bfcache.
- **Postgres:** row triggers run in the writing transaction. `WHEN (old.x is distinct from new.x)`
  skips no-op updates. Settle-on-read writes inside GET handlers fire triggers too (wanted: the other
  player hears of it).

### Real usage and deployment, checked

- **School Wi-Fi blocking `wss:`, or a corporate proxy:** never joins, so they poll as today.
- **Groups on one network:** nothing new keys on IP.
- **A typo fixed and retried, double taps:** writes are idempotent. A duplicate write pokes, which
  costs only a spare read.
- **Account switch or Forget me on a shared device:** the key rotates, so the old topic goes quiet.
- **Several function instances, hosts with different clocks:** the database is the only sender.
  Pokes carry no time, so clocks don't matter. Ordering doesn't matter because every read is complete.
- **Geography:** the trigger sends from Sydney, next to the players. The poke arrives in ~50 ms, and
  the read still goes via Ohio (~600 ms). Realtime fixes the waiting, not the read (ADR 0053).

## 6. PR plan (each into `main`, each leaves the game whole)

0. **ADR 0082 and this proposal in `docs/`**, with the owner's decisions recorded. CLAUDE.md's
   pointer line.
1. **Auth hardening** (2.4): a dedicated browser key and the Send Email and before-user-created hooks,
   or the chosen alternative. Tests: an `/otp` call not started by us sends nothing; one we started
   still does (`email-limits.db.test.ts`); a sign-up without our marker is refused.
2. **The database side, flag off:** migration (`profiles.poke_key`, `game.flags`, `game.poke()`, the
   triggers), Realtime enabled locally, and `test:db` cases from section 4. Nothing listens yet.
3. **`GET /me/poke` and key rotation:** behind `BALLBATTLE_POKE` and the flag. Rotation on Log out,
   Forget me, Delete account and Switch. `scripts/poke-switch.ts` and its test. Database tests through
   `TestBrowser`.
4. **The socket client, not wired:** `src/app/poke-socket.ts` (its choice is decision 3). `VITE_POKE`,
   the CSP in both header files, `check-bundle.ts`. Unit tests with a fake WebSocket.
5. **The inbox on pokes:** the socket-up mode in `inbox-poll.ts` (120 s safety), `ONLINE_MS` 150 s and
   `privacy.html`. Online: a friend's challenge and a friend request arrive by poke, and again with the
   socket blocked.
6. **Lobby, start lineup, end screen and rematch watch on pokes:** reads on poke and at deadlines,
   lobby heartbeat 20 s. Online: `friend-challenge`, `lineups-together`, `rematch-anywhere`, each by poke
   and blocked.
7. **The live match on pokes:** the 1 s waiting reads go, the heartbeat stays. Online: `live-match`,
   both disconnect flows, a pick in < 1.5 s.
8. **Measure and document:** `live-measure.ts` with pokes into ADR 0053's table, a week's soak on
   staging, the ADR "as built", CLAUDE.md. Production on only when you say.
9. _(If chosen)_ **The slower heartbeat** (2.8): `live.ts` timers, `live-watch.test.ts`, the disconnect
   flows, the pre-match line's words.

## 7. Decisions for you

1. **Which Netlify limit applies:** the 125k-invocation legacy plan, or ADR 0052's 300 credits (≈ 60k
   requests after 12 publishes)?
2. **The publishable key in the page (2.4):** accept it with the Auth hooks (recommended), accept it
   with rate limits only, or don't ship it (relay project or stay on polling)?
3. **The socket client:** a small Phoenix client of our own (~200 lines, no dependency, unit-tested;
   recommended in keeping with "no libraries without reason"), or `@supabase/realtime-js`?
4. **Safety read and online status:** inbox every 120 s and `ONLINE_MS` 75 s → 150 s?
5. **The live heartbeat (2.8):** keep 6 s away, or 12 s with a 4 s heartbeat?
6. **Guests:** pokes only during online flows (recommended), never, or always while visible?
