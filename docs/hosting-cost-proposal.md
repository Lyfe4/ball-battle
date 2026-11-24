# Proposal: what hosting costs, and when to change it

- Status: decided as ADR 0084 (2026-11-25), the owner's answers to section 8. Kept for the
  measurements and the options; the ADR decides.
- Builds on: ADR 0052 (backend, "Cost, roughly"), ADR 0053 (live matches, "Cost on Netlify"),
  ADR 0082 (the Realtime poke; legacy plan addendum), `docs/realtime-poke-proposal.md` sections 1-3
  (Mix P and Mix F), `docs/ci-cost.md`, `netlify.toml`, `src/server/db.ts`,
  `src/server/routes/round-trips.db.test.ts`.
- Pricing and docs were read on 2026-11-24 (sources at the end). Anything not confirmed on a
  vendor page is marked (unverified).

## In short

On the legacy free plan the limit is the **number of function calls (125k a month)**, not their
length: legacy plans bill functions by request count, regardless of runtime. With today's measured
pokes a player costs about **63 calls a day** in production-shaped play (Mix P) and **140** once
friends ship (Mix F), so the legacy plan holds about **64** and **29** daily players. The ~0.6 s
Ohio↔Sydney wait costs nothing on the legacy plan; it costs most of the bill on every credit plan
(about 90% of a call's credits), which is why leaving the legacy plan for Free or Personal credits
would _lower_ the ceiling (Free credits: ~60k calls). Recommendation: **stay on the legacy free plan
now**, put one round trip less in the series read, and watch the monthly count. When a month passes
**75k calls** (about 40 Mix P or 18 Mix F daily players), move to **Netlify Pro ($20, credit-based)
with functions in Sydney (`syd`)**: the database round trips drop from ~190 ms to ~1-2 ms each
(estimate), a call falls from ~0.002 to ~0.0004 credits, and 3,000 credits cover about 1,000 daily
players of either mix. The switch off the legacy plan is permanent, so it waits for the trigger. A
free alternative with the same effect on latency is moving the database to the US instead; that
depends on where the players are.

## 1. What a player costs today (measured)

Staging, 2026-11-24, two Chromium phones, one live Reveal Best of 3, picks after 3-12 s, sender 60 s
in the lobby, both 120 s on the end screen. Function calls per phase, sender / friend:

| Run        | Lobby  | Lineup | Match (s)       | End screen (120 s) | Total           |
| ---------- | ------ | ------ | --------------- | ------------------ | --------------- |
| Pokes on 1 | 8 / 1  | 8 / 12 | 36 / 35 (133 s) | 10 / 10            | 120 (62 / 58)   |
| Pokes on 2 | 8 / 2  | 7 / 10 | 49 / 48 (135 s) | 10 / 10            | 144 (74 / 70)   |
| Pokes off  | 22 / 1 | 9 / 11 | 51 / 46 (118 s) | 63 / 63            | 266 (145 / 121) |

Series read latency at the client: p50 638-658 ms, p90 821-1,284 ms, max ~2-3.4 s. Pooler: at
most 4 API backend connections, at most 1 active at a sample.

**What the time is.** `round-trips.db.test.ts` pins a warm series read at **2 queries** (the session,
then the series) and a pick at **4**. At ~190 ms per Ohio↔Sydney round trip that is ~380 ms of a
read and ~760 ms of a pick inside the function; the rest of the 640 ms is the client to Ohio and
back. So the function's own duration per read is about 0.4-0.55 s (unverified: Netlify's logs
would show it). The tables below use **0.65 s** as an upper bound.

### Per player, the figures used below

| Item                                     | Pokes on | Pokes off | How                                               |
| ---------------------------------------- | -------: | --------: | ------------------------------------------------- |
| One live Best of 3 (no lobby, 1 min end) |   **56** |    **90** | lineup ~9, match ~42, end screen 5 a minute       |
| Sender's 2-minute lobby                  |       11 |        42 | 8 in the first minute, then the 20 s safety read  |
| Same, signed in (inbox at 2 s, off only) |       11 |      ~100 | + 60 inbox reads when polled (code, not measured) |
| Idle signed in with friends, an hour     |       33 |       122 | 120 s safety read; 30 s inbox (ADR 0082)          |
| Page loads (`/me`, `/me/poke`, home)     |      2-3 |       2-3 | per day                                           |

The proposal estimated 203 → 66 per Best of 3; measured it is **90 → 56**. The end screen is where
pokes save (63 → 10 per two minutes). The match is ~75% of what is left, because the 2 s presence
heartbeat stays (owner's decision).

**Per player-day:**

- **Mix P** (guests, one live Best of 3, half wait 2 min in a lobby): pokes on 56 + 5.5 + ~2 ≈
  **63**; off 90 + 21 + ~2 ≈ **112**.
- **Mix F** (30 min signed in with friends, two live Best of 3, one 2-minute lobby): pokes on
  25 min idle 14 + loads 3 + 112 + 11 ≈ **140**; off 50 + 3 + 180 + 100 ≈ **333**.

Plus ~3k a month fixed (the 15-minute sweep, 2,880; health checks). 30-day month.

## 2. The limits we are under

| Limit                              | Value                                                                              | Source / status                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Netlify legacy Free: functions     | 125k invocations per site a month                                                  | Netlify legacy pricing page                                                              |
| Netlify legacy: how functions bill | by request count, regardless of runtime                                            | Netlify functions usage and billing page                                                 |
| Netlify legacy Free: runtime       | 100 hours a month                                                                  | (unverified): forums and blogs only; not on Netlify's current legacy page                |
| Netlify legacy Free: past a limit  | new builds disabled, **all sites on the account paused**; only an upgrade restores | Netlify legacy billing FAQ (general rule for metered features, not stated for functions) |
| Netlify legacy Free: build minutes | 300 a month (hard)                                                                 | Netlify legacy pricing page                                                              |
| Netlify legacy Free: bandwidth     | 100 GB a month (hard)                                                              | Netlify legacy pricing page                                                              |
| Leaving legacy                     | **permanent**: no way back to a legacy plan                                        | Netlify legacy billing FAQ                                                               |
| Function region                    | "available on all Pro and Enterprise plans"; `syd` is a self-serve region          | Netlify optional configuration page. Whether _legacy_ Pro counts: (unverified)           |
| Supabase Realtime, free            | 2M messages, 200 peak connections                                                  | Supabase Realtime pricing page                                                           |

**Runtime hours don't bind on the legacy plan.** 125k calls × 0.65 s ≈ **22.6 hours**. The 100 hours
(if they apply) would be reached at ~550k calls, long after 125k. On the legacy plan the 600 ms
wait is a latency problem, not a cost problem.

**The failure mode is the real risk.** Past 125k, the general rule pauses every site on the account,
the static game included: the bot game, which needs no server, would go down with the API. There is
no overage to pay on the Free tier; only an upgrade restores it, and that upgrade is to a credit plan.

## 3. Calls and runtime by daily players (pokes on, Netlify in Ohio)

| Daily players | Mix P calls |    of 125k | Runtime (h, 0.65 s) | Mix F calls |    of 125k | Runtime (h) |
| ------------- | ----------: | ---------: | ------------------: | ----------: | ---------: | ----------: |
| 10            |         22k |        18% |                 4.0 |         45k |        36% |         8.1 |
| 50            |         98k |        78% |                  18 |        213k |   **170%** |          38 |
| 200           |        381k |   **305%** |                  69 |        843k |   **674%** |         152 |
| 1,000         |       1.89M | **1,510%** |                 341 |       4.20M | **3,360%** |         758 |

Pokes off for comparison: Mix P 37k / 171k / 675k / 3.36M; Mix F 103k / 503k / 2.0M / 10M.

**Ceilings on the legacy plan:** Mix P ≈ (125k - 3k) / 1,890 ≈ **64 daily players**; Mix F ≈
122k / 4,200 ≈ **29**. With pokes off they were 36 and 12.

## 4. The options

### 4.1 Netlify functions in Sydney (`syd`)

- **Allowed on:** Pro and Enterprise (Netlify docs, above). Not Free, not Personal. The comment in
  `netlify.toml` already says so. Whether a legacy Pro team can set it, and whether a legacy free
  team can still buy legacy Pro, is (unverified); new purchases appear to be credit plans.
- **Effect on latency:** the function and the database in the same AWS region (`syd` is
  ap-southeast-2) make each query ~1-2 ms instead of ~190 ms (unverified until measured). A read goes
  from ~0.4-0.55 s inside the function to ~0.03-0.08 s; a pick from ~0.8 s to ~0.1 s. **Every player
  gains**, wherever they are: today each request crosses the Pacific twice (two queries); with `syd`,
  a player in the US crosses it once (client → Sydney), a player in Australia not at all. Rough
  client p50: Australia ~0.1-0.15 s, US ~0.3-0.35 s (unverified).
- **Effect on cost:** on the legacy plan, none (count-billed). On a credit plan compute falls ~85%:
  per call 0.0002 (request) + 0.08 s × 10 credits per GB-hour ≈ **0.0004 credits**, against **0.002**
  in Ohio.
- **What changes:** one line in `netlify.toml` (`[functions] region = "syd"`, or the site setting),
  the scheduled sweep with it; `privacy.html` (the "runs in Ohio" sentence) and its date in the same
  PR. Realtime, the database and `src/server` unchanged.

### 4.2 Supabase Edge Functions, or Postgres RPC from the browser

**Edge Functions** (Deno, on Supabase's infrastructure). Free: 500k invocations a month; Pro and
Team: 2M, then $2 per million (Supabase docs). Per-request CPU and wall-clock limits on Free:
(unverified) 2 s CPU, 150 s wall.

- **Gain:** run beside the database (an Edge Function runs nearest the caller by default and can be
  pinned to a region, (unverified) details), so the same latency gain as 4.1, and 4× the legacy
  invocation allowance for $0.
- **Cost of the move:** every handler moves to Deno. The handlers are web-standard
  `Request`/`Response` with `postgres` (porsager), which runs on Deno, and the frozen
  `rulesets/r<N>/sim.mjs` bundles are plain ES modules, so it is a port, not a rewrite (ADR 0052
  already lists Deno as "a second runtime to test"). CI would need a Deno run of the database tests.
- **Same origin:** the session is a `__Host-` cookie and the CSP is `connect-src 'self'`. Keep both
  with a Netlify proxy rewrite (`/api/v1/*` → `https://<ref>.supabase.co/functions/v1/api/:splat`,
  status 200). A proxied request is not a Netlify function invocation (on credit plans it is a web
  request). That cookies and `Set-Cookie` pass through unchanged is (unverified).
- **Real-usage risk: the client IP.** Rate limits key on the network (`network.ts`) from Netlify's
  `context.ip`. Behind a proxy the function sees Netlify's address unless the original is forwarded
  and trusted; then every player shares one network key and the guest and email limits lock everyone
  out together. `supabase-daily.yml` already checks IP forwarding for Auth; the same check and a
  `test:db` case ("two client IPs through the proxy are two networks") would be needed.

**Postgres RPC through PostgREST from the browser.** One round trip from the client, and Supabase
doesn't cap Data API requests on Free. But:

- the browser would need a Supabase JWT, which the codebase deliberately never gives it (HttpOnly
  sessions; ADR 0082 section 2.3, option A: an XSS becomes an account takeover);
- rules would move from `src/server` into SQL and RLS, against "routes are thin; rules live in
  services" and "what a player may see is decided by `viewOf` alone";
- a series is played and verified by its frozen JS sim bundle, which Postgres can't run.

**Not recommended**, except perhaps a future public, read-only leaderboard view, and even that is
better served by 4.3.

### 4.3 Caching

- **ETag / 304 saves bytes, not calls.** The series read returns `304` when the version hasn't moved,
  but the function still runs and still reads the database to learn the version. On the legacy plan
  a 304 costs a full call.
- **Per-player reads can't be CDN-cached** (`/me/*`, `/series/:id`, `/starts/:id`, lobbies): each is
  one player's view behind a cookie, and the API sends `Cache-Control: no-store` by default
  (`http.ts`). Caching them with `Netlify-Vary: cookie=...` would risk serving one player's view to
  another. Don't.
- **Public reads can be:** a leaderboard, ruleset or roster metadata, a public profile. Netlify's CDN
  caches a function response only when asked (`Netlify-CDN-Cache-Control: public, durable,
max-age=60, stale-while-revalidate=120`); a hit doesn't invoke the function, and `durable` shares
  it across edge nodes. None of today's frequent reads is public, so this is a rule for ranked and
  leaderboards (`docs/vision.md`), not a saving now.

### 4.4 Netlify Personal or Pro (credit-based) vs the legacy free plan

Credit plans (Netlify pricing page): Free 300 credits, **Personal $9 / 1,000**, **Pro $20 / 3,000**.
15 credits per production deploy, 10 per GB-hour of compute, 2 per 10k web requests, 20 per GB of
bandwidth. Extra: Personal 500 credits for $5 ($0.01 each); Pro about $10 per 1,500 ($0.0067).
Functions default to 1 GB, so a GB-hour is an hour of function time. Whether duration is wall time
including I/O wait is not stated (unverified); assume it is, as ADR 0053 did.

With ~12 publishes a month (180 credits), the credits left for calls:

| Plan, region       | Credits per call | Calls a month after 180 for deploys | Mix P daily players | Mix F daily players |
| ------------------ | ---------------: | ----------------------------------: | ------------------: | ------------------: |
| Legacy Free, Ohio  |      count, 125k |                               ~122k |                  64 |                  29 |
| Credit Free, Ohio  |            0.002 |                                 60k |                  30 |                  13 |
| Personal $9, Ohio  |            0.002 |                                410k |                 215 |                  97 |
| Pro $20, Ohio      |            0.002 |                               1.41M |                 745 |                 335 |
| **Pro $20, `syd`** |       **0.0004** |                           **~7.0M** |          **~3,700** |          **~1,700** |

Credit Free and Personal **can't** choose a region, so on them the Pacific wait is ~90% of the bill.
Leaving the legacy plan for credit Free halves the ceiling; Personal gives ~3× for $9; Pro in
`syd` gives ~55× for $20. Page loads and static assets also count as web requests and bandwidth on
credit plans: at 1,000 daily players perhaps 300-500 credits a month (rough: ~3 loads × ~15
requests a day, ~0.3 MB a day after caching; unverified, the dashboard will tell).

### 4.5 Other levers

| Lever                                                                                                  | What it saves                                                                                   | Cost / catch                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Series read in one query** (session joined into the series statement, or one SQL function per route) | ~190 ms per read in Ohio (~30% of a read, ~45% of its function time); a pick 4 → 2-3            | Code in `src/server/db/`; `round-trips.db.test.ts` changes from 2 to 1. No call saved, so nothing on the legacy bill; matters for latency now and credits later                                                                                                                                                              |
| **Slower live heartbeat** (proposal 2.8: 4 s, away after 12 s)                                         | match calls roughly halve: a Best of 3 ~56 → ~35; Mix P ceiling 64 → ~95, Mix F 29 → ~45        | Changes a rule (6 s to "disconnected"); owner kept 2 s on 2026-11-24                                                                                                                                                                                                                                                         |
| Inbox safety read 120 s → 300 s                                                                        | idle with friends 33 → ~15 an hour; Mix F 140 → ~132 a day                                      | Friends' "online" needs `ONLINE_MS` above the safety read, and `privacy.html`; small gain                                                                                                                                                                                                                                    |
| End screen and lineup safety reads 10 s → 20 s                                                         | ~3 a cycle                                                                                      | A lost poke holds a player up to 20 s; small gain                                                                                                                                                                                                                                                                            |
| **Database to the US** (new Supabase project in us-east-2, beside Netlify's Ohio)                      | Same round-trip gain as 4.1, on **any** Netlify plan, $0                                        | Supabase can't move a project's region in place (unverified): a new project, data and Auth users migrated, Google client, keys, both CSP sockets, `scripts/supabase-projects.ts`, `privacy.html`. Australian players then cross the Pacific once per request and for the socket. Cheapest while production holds little data |
| Cloudflare Workers ($5 paid: 10M requests, CPU time billed, **no charge for duration**)                | Waiting on Sydney costs nothing; 10M calls covers ~1,000+ daily players of either mix for ~$5-6 | The API port ADR 0052 planned for "if cost ever favours Cloudflare": a second origin or the whole site moved, cookie and CSP work, Hyperdrive or Smart Placement to sit near the database (unverified details), the same client-IP care as 4.2. Free Workers (10 ms CPU) can't verify a series (ADR 0052)                    |
| Fly.io, a small always-on Node in Sydney                                                               | Flat price, no per-call count                                                                   | A server to run, patch and scale; against ADR 0052's choice of serverless; pricing (unverified)                                                                                                                                                                                                                              |

## 5. Monthly cost by option (pokes on, today's 2 s heartbeat)

Netlify credits include 180 for deploys. "n/a" means the plan stops the site.

| Option                                        | Mix P 10  | 50        | 200       | 1,000           | Mix F 10  | 50        | 200             | 1,000           |
| --------------------------------------------- | --------- | --------- | --------- | --------------- | --------- | --------- | --------------- | --------------- |
| A. Legacy Free, Ohio (today)                  | $0        | $0        | n/a       | n/a             | $0        | n/a       | n/a             | n/a             |
| B. Personal $9, Ohio (credits used)           | $9 (224)  | $9 (375)  | $9 (942)  | **$39** (3,960) | $9 (270)  | $9 (606)  | **$18** (1,866) | **$85** (8,580) |
| B'. Pro $20, Ohio                             | $20       | $20       | $20       | $26             | $20       | $20       | $20             | **$57**         |
| **C. Pro $20, `syd`** (credits used)          | $20 (189) | $20 (221) | $20 (340) | $20 (974)       | $20 (199) | $20 (269) | $20 (534)       | $20 (1,944)     |
| D. Edge Functions + Netlify legacy for static | $0        | $0        | $0        | $25¹            | $0        | $0        | $25¹            | $29¹            |
| E. Cloudflare Workers paid                    | $5        | $5        | $5        | ~$5-6           | $5        | $5        | $5              | ~$5-6           |
| F. Database to us-east-2 + Personal $9        | $9        | $9        | $9        | $9              | $9        | $9        | $9              | ~$18            |

¹ Supabase Pro ($25), which ADR 0052 plans for production at launch anyway (backups, no pausing), so
the marginal cost is ~$0-4. D and E also carry a port of `src/server`; F a database move. Option A
at 50 Mix P daily players is 78% of the limit, so it is already past the trigger below. C at 1,000
daily players leaves ~1,000 credits for static traffic and a worse-than-estimated duration.

Supabase stays on Free throughout these numbers, apart from D. Realtime at 1,000 Mix F daily players
is ~1.2-2.4M messages a month by the proposal's ~40-80 per player-day: at or over the 2M free
quota. Socket heartbeats were seen not to count (ADR 0082 addendum). Peak connections at 1,000
daily players ≈ 120-300 against 200 (proposal section 3's estimate scaled), so Supabase Pro (5M
messages, 500 connections) arrives around **600-800 daily players** whatever Netlify does.

## 6. Checks

**Real usage.**

- _A group on one network_ (a school, a café) already shares the network key for guest creation and
  email codes. Any option that puts a proxy in front of the API (D, E) risks making **every** player
  one network unless the client IP is forwarded and trusted. Test: two client IPs through the proxy
  count as two networks; a forged forwarding header from the client is ignored.
- _The legacy cap is all-or-nothing._ At 125k the bot game, which needs no server, goes down with
  the API. A popular day (a link shared in a group chat) can spend a month's headroom in a few days.
  Check: the Usage page weekly once production has online play; the 75k trigger leaves room for one.
- _Retries:_ a slow read (p90 up to 1.3 s, max 3.4 s) is not retried by the page, but every
  heartbeat is a call. Moving to `syd` makes reads faster, not fewer.

**Library and platform behaviour this relies on.**

- Netlify legacy plans count invocations "regardless of runtime"; credit plans bill duration × memory
  (1 GB default, 1-4 GB only on credit Pro); whether duration includes I/O wait: (unverified).
- Netlify function region: per site or per function, Pro and Enterprise; each function runs in one
  region; scheduled functions included (unverified that the site setting moves them).
- Netlify CDN caches function responses only with cache headers; query strings are in the key,
  cookies only by `Vary`/`Netlify-Vary`; `durable` shares across edges; a hit doesn't invoke.
- `postgres` (porsager): `max: 1`, `prepare: false`, `idle_timeout` 20 s, untyped strings so each
  query is one round trip (`db.ts`). A warm instance reuses its connection; a cold one pays the TLS
  and auth handshake to Sydney (several round trips) once.
- Supabase's transaction pooler: one query at a time per connection; no pipelining (CLAUDE.md).
- ETag: a `304` still runs the function and its queries.
- Supabase Realtime: 2M messages, 200 peak connections on Free; how a broadcast to one subscriber
  is counted (1 or 2 messages) is not stated on the pricing page (unverified).

**Deployment reality.** Moving functions to `syd` means more instances per database connection
budget only if traffic grows: each instance holds one pooler connection for 20 s idle, and today's
peak was 4. The free pooler's client limit is (unverified) 200; at ~1,000 daily players with a 2 s
heartbeat, peak concurrent instances could reach tens, not hundreds. Clocks are unaffected: every
rule reads the database's `now()`.

## 7. Recommendation and triggers

1. **Now (beta, under ~30 daily players):** stay on the **legacy free plan**. Do not switch to a
   credit plan early: it is permanent, and credit Free in Ohio would halve the ceiling.
   - Read the Usage page (Functions) once a week while production has online play, and record the
     month's calls beside the estimate here (63 / 140 a player-day) to check the model.
   - Make the **series read one query** (and look at the pick's four). It saves ~190 ms on every
     live read today, and ~30% of the function time that a credit plan will bill later.
   - Keep caching rules for when public reads exist (4.3); nothing to cache now.
2. **Trigger 1: a month passes 75k calls** (60% of 125k), or friends are about to ship to
   production (Mix F's ceiling is ~29 daily players): move to **Netlify Pro ($20) with functions in
   `syd`** that week. Same PR: `netlify.toml` region, `privacy.html` and its date. Measure p50/p90
   with `scripts/live-measure.ts` before and after. If the owner's players are mostly in the US, weigh
   **F** (database to us-east-2, Personal $9) instead, ideally before production holds real data.
3. **Trigger 2: Pro's credits pass 2,400 a month (80%)** or ~600 daily players: Supabase Pro for
   Realtime and the database (planned anyway), then reconsider the heartbeat (2.8) before any port.
   Only past ~1,500 daily players, or if live ranked needs it, revisit Cloudflare Workers (E) as
   ADR 0052 already anticipates.
4. **Not recommended:** Postgres RPC from the browser (security model and the sim); per-player CDN
   caching; Edge Functions (D) unless Supabase Pro is bought for other reasons _and_ the Netlify
   bill matters more than a second runtime.

## 8. Decisions for the owner

1. **Stay on the legacy free plan until a month passes 75k calls?** (Recommended. Leaving is
   permanent.)
2. **Is friends' production launch (Mix F) also a trigger?** At ~29 daily players it hits 125k much
   sooner than production-shaped play.
3. **Where are the players?** Mostly Australia/NZ: Netlify Pro with `syd` (C, $20). Mostly US: move
   the database to us-east-2 (F, $9 or $0 on legacy), best done before production has real data.
4. **Make the series read (and pick) fewer queries now?** A latency win today; a cost win only after
   the move to credits.
5. **Revisit the 2 s heartbeat?** It is ~75% of a match's calls; 4 s with 12 s "away" lifts the
   legacy ceiling by ~50% (Mix P 64 → ~95). Kept as is on 2026-11-24.
6. **Check the dashboard** for the 100-hour runtime limit and the month's real call count; neither
   is confirmed on Netlify's current pages.

## Sources (read 2026-11-24)

- Netlify, functions optional configuration (region, `syd`, Pro and Enterprise, 1 GB default):
  https://docs.netlify.com/build/functions/optional-configuration/
- Netlify, functions usage and billing (legacy: by request count regardless of runtime; credit:
  GB-hours): https://docs.netlify.com/build/functions/usage-and-billing/
- Netlify, legacy pricing plans (125k invocations per site a month, 300 build minutes, 100 GB):
  https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/
- Netlify, billing FAQ for legacy plans (Free: sites paused at a limit; switching to credits is
  permanent):
  https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/billing-faq-for-legacy-plans/
- Netlify, pricing (Free 300, Personal $9 / 1,000, Pro $20 / 3,000; 15 per deploy, 10 per GB-hour,
  2 per 10k requests, 20 per GB; credit packs): https://www.netlify.com/pricing/
- Netlify, caching overview (function responses, `Netlify-CDN-Cache-Control`, `durable`,
  `Netlify-Vary`): https://docs.netlify.com/build/caching/caching-overview/
- Supabase, Edge Functions pricing (500k free; 2M on Pro, then $2 per million):
  https://supabase.com/docs/guides/functions/pricing
- Supabase, Realtime pricing (2M messages, 200 peak connections free; Pro 5M, 500):
  https://supabase.com/docs/guides/realtime/pricing
- Cloudflare, Workers pricing (Paid $5: 10M requests, 30M CPU ms; no charge for duration):
  https://developers.cloudflare.com/workers/platform/pricing/
- 100 hours of runtime on the legacy free plan: Netlify community forum posts only, e.g.
  https://answers.netlify.com/t/125k-functions-limit-got-over-starter-vs-pro-limits-are-not-clear-urgent/151709
  (unverified)
