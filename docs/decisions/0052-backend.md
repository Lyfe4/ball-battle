# 0052: The backend: Supabase for accounts and data, Netlify Functions as the game server

- Status: Accepted (2026-11-14), with the decisions in section 11: player vs player comes first
  (slice 1, guests welcome, unrated), then accounts, ranked play and the bot ladder. Nothing is
  built yet except batch publishing (section 1, "Publishing in batches").
- Date: 2026-11-14
- Builds on: ADR 0051 (secret seeds, pinned rulesets, the checklist before accounts), ADR 0022
  (one gate for a valid series), ADR 0048 (Best of 5), `docs/vision.md` ("Long-term goal")
- Amends: ADR 0051 in three places, each said where it comes up: the bot's own seed is secret too
  ("Seeds"), no `packages/sim` workspace yet, and no worker pool ("Deliberately simple")

## Context

The game is a static Vite site on Netlify. Everything below the draft is ready for a server: a
pure sim that runs in Node unchanged, `decodeSeriesSetup` for untrusted input, `verifySeries` as
the one gate, and ADR 0051's design for fair seeds. What's missing is everything a server is:
accounts, storage, an API, and the rules for async play and ratings.

Constraints from the brief: one solo developer, free to start, no servers to look after, secure,
typed end to end, easy for Claude Code to work on, and an API a Capacitor app can use later. The
game against the bot keeps working with no account and offline.

Facts this relies on, measured or read from the code:

- Verifying a Best of 5 takes about 32 ms; the worst case (5 rounds, 3 drawn attempts each, every
  match to the 3600-tick limit) is 0.3-0.5 s of CPU (audit 2.0). One round is under 25 ms
  typically and about 75 ms at worst.
- Reveal Bo5 has 8 picks: rounds 1-4 each have a show and an answer, round 5 plays what is left
  (`revealTurnsOf`). Showdown's round 1 is simultaneous, then the round's winner shows
  (`showdownTurnsOf`). `awaitingPick` already says whose turn it is for every format.
- **The bot's choices are seeded from the series seed** (`bot.ts:176`,
  `deriveSeed([view.seed, salt, role, round])`). ADR 0051 lists the round seeds, the toss and the
  bot's lineup seed as secrets, but not this one. Anyone who knows it can predict the Normal
  bot's answer and the Hard bot's tie-breaks, so it is a secret too (see "Seeds").

## 1. Stack

### Options

|                         | A. Supabase (Auth + Postgres) + Netlify Functions               | B. Supabase all-in (Edge Functions, client talks to Supabase) | C. Netlify Functions + Neon + self-run auth (Better Auth) | D. Cloudflare Workers + D1                                              | E. Firebase                           |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------- |
| Cost, beta (<1k MAU)    | $0 Supabase; Netlify Free or Personal ($9)                      | $0                                                            | $0 Neon; Netlify as A                                     | $0, but free plan's 10 ms CPU limit can't verify a series: $5 paid plan | Functions need the pay-as-you-go plan |
| Cost, ~10k MAU          | ~$25 Supabase Pro + ~$20-50 Netlify                             | ~$25                                                          | ~$19 Neon + Netlify as A                                  | ~$5-10                                                                  | Low, but metered per document read    |
| Auth                    | Managed: guests, Google, Apple, email codes, linking            | Same                                                          | Ours to run and secure                                    | Ours to build                                                           | Managed, excellent                    |
| Database                | Postgres, RLS, migrations in repo                               | Same                                                          | Postgres, branching per PR                                | SQLite (D1)                                                             | Firestore (documents)                 |
| Server code             | Node 24, the runtime the sim is tested in                       | Deno (V8; fine for the sim, a second runtime to test)         | Node 24                                                   | Workers (V8)                                                            | Node                                  |
| Same origin as the site | Yes: `/api/*`, deployed atomically with the client              | No: CORS, a second deploy pipeline                            | Yes                                                       | No, unless the whole site moves                                         | No                                    |
| Local dev               | `supabase start` (Docker) + `netlify dev`                       | `supabase start`                                              | Neon branch or local Postgres                             | `wrangler dev`                                                          | Emulators                             |
| Tests in CI             | Vitest + local Supabase in a job                                | Same, plus Deno                                               | Same                                                      | Miniflare                                                               | Emulators                             |
| Lock-in                 | Low: plain Postgres; web-standard `Request`/`Response` handlers | Medium (Edge Functions, client SDK)                           | Lowest                                                    | Medium (D1, Durable Objects)                                            | High                                  |
| Live PvP later          | Supabase Realtime, or a move of one service                     | Realtime                                                      | Needs a service                                           | Durable Objects: the best fit                                           | Firestore listeners                   |

Notes on the ones not chosen:

- **B** puts the Supabase session in `localStorage` by default (`supabase-js`), which ADR 0051
  forbids, and splits deploys: a deploy preview's client would talk to production functions.
- **C** is the cheapest to leave, but auth is the part a solo developer should not own: account
  linking, token rotation, OAuth edge cases, email abuse, Apple's token revocation.
- **D** is the cheapest at scale and the best home for live PvP, but needs auth built from
  scratch, cross-origin cookies (or moving the site), and a $5 plan from day one for the CPU.
- **E**'s document model makes rating transactions and leaderboard queries awkward, and its
  security rules are a second language to get right.

### Recommendation: A

- **Supabase** for Auth and Postgres: two free projects, `staging` and `production`, both in
  Sydney (`ap-southeast-2`).
- **Netlify Functions** (v2: `export default (req: Request, context) => Response`) for every API
  route under `/api/v1/*`, on the same origin as the site, with the functions region set to
  Sydney (`syd`) next to the database. The default region is Ohio, and a function in Ohio talking
  to a database in Sydney pays about 200 ms per query.
- **The browser never talks to Supabase.** It calls `/api/v1/*` only. The functions hold the
  Supabase session in an `HttpOnly` cookie. So:
  - no tokens in JavaScript;
  - `connect-src 'self'` is the whole CSP change;
  - no third-party script;
  - client and API ship in one atomic deploy, with one rollback;
  - every deploy preview gets its own API, pointed at staging.
- **Why this over D long term:** the handlers use web-standard `Request`/`Response` and plain SQL
  through `postgres` (porsager), which runs on Workers too. If cost or live PvP ever favour
  Cloudflare, moving the API is a port of thin adapters, not a rewrite.

### Cost, roughly

Netlify bills credits: 15 per production deploy, 2 per 10,000 requests, 10 per GB-hour of
function compute (Netlify docs, November 2026). The site is on the Free plan, whose 300 credits a
month are a hard limit: past it the site stops. Every merge to `main` was a production deploy, so
about 20 merges a month used the whole plan before any traffic.

- **Beta, under 1k MAU:** $0-9 a month.
- **Launch:** Supabase Pro ($25: daily backups kept 7 days, no pausing, 100k MAU) for
  production; staging stays free. Netlify Personal or Pro. About $35-45 a month.
- **About 10k MAU,** each playing ~30 series a month, ~20 requests a series: about 6 M requests
  (~1,200 credits) and ~100 GB-hours (~1,000 credits). That is Netlify Pro with extra credits,
  plus Supabase Pro: about $50-100 a month. Cloudflare would be about $10 for the same traffic.
  That gap, not features, is the main reason to move later.

### Publishing in batches (built with this ADR)

- **Production is the `release` branch**, set in Netlify's settings (production branch `release`,
  and only it builds for production). Merging to `main` no longer publishes.
- **The Publish workflow** (`.github/workflows/publish.yml`, run by hand:
  `gh workflow run publish.yml`) publishes a batch:
  - it fast-forwards `release` to a `main` commit whose CI run passed;
  - it refuses anything not on `main`, and never moves `release` backwards (roll back in
    Netlify's dashboard instead).
- **Deploy previews on every pull request are unchanged.** They don't cost deploy credits.
- **Budget on Free:** about 12 publishes a month (180 credits), leaving the rest for bandwidth
  and requests.
- **Move to Personal ($9, 1,000 credits) when the first functions go live in production** (slice
  1's public launch). From then on, every request, every function GB-hour and the scheduled
  deadline sweep (about 2,900 runs a month) draw on the same 300. Move sooner if publishing more
  than about 12 times a month starts to matter.

## 2. Accounts

### What needs no account

The game against the bot, every format and length, links, settings and saved series stay as
they are: `localStorage`, no network, offline. Nothing in this ADR changes them.

### Guests

- A guest is a Supabase **anonymous user**. It is created on the **first online action**
  (accepting or sending a friend challenge, joining the open queue), never on opening the app.
  That keeps offline play untouched and avoids a dead account per visit.
- **Guests play player vs player from the first slice:** friend challenges and the open queue,
  both unrated. They show as a generated name ("Player 4821").
- **Ranked play and the public leaderboards need a signed-in account**: a guest costs nothing to
  make, so many guests could farm a lucky streak or feed one account wins. A guest sees their
  place on a board ("you'd be #12: sign in to appear").
- A guest can delete itself ("Forget me" in settings) from the first slice.
- A guest lives as long as its cookie. Clearing site data loses it; the UI says so before it
  matters ("Sign in to keep your progress").
- Guests with no activity for 90 days are deleted by a scheduled job.

### Signing in

| Method                         | Why                                                                                                                                                                | When                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Google                         | Most players have it; one tap on Android                                                                                                                           | Slice 2                    |
| Email one-time code (6 digits) | For players without Google or Apple. A code, not a magic link: a link opens in another browser or app than the one playing (a Capacitor WebView, an installed PWA) | Slice 2                    |
| Sign in with Apple             | Required on iOS whenever Google is offered (App Store guideline 4.8); needs the $99 USD/year developer account                                                     | With the app-store release |

- No passwords: nothing to store, reset or breach.
- OAuth uses PKCE: the browser navigates to Supabase, comes back to `/api/v1/auth/callback`, and
  the function exchanges the code and sets the cookie.
- Email codes need a real mail sender: Supabase's built-in one is rate-limited and not for
  production. Resend or Postmark free tiers are enough.
- **Native app later:** Capacitor's Google and Apple plugins return an ID token, which goes to
  `POST /api/v1/session/id-token` (Supabase `signInWithIdToken`). Cookies in a Capacitor WebView
  are cross-site to our API origin, so the app either uses `CapacitorHttp` (the native cookie
  jar) or sends a bearer token kept in the Keychain or Keystore. **Every route authenticates
  through one function** (`sessionOf(req)`), so adding the bearer path later changes one file.
  Decide it in the app-store slice, with a test on a real iPhone.

### A guest who signs up

- Signing in from a guest **links the identity to the same user id** (`linkIdentity` for OAuth,
  `updateUser` for email). Every row is keyed by user id, so open and finished series stay.
- If that Google account or email already has an account (signed up on another device), nothing
  is merged. The player chooses: switch to the existing account (the guest's series stay with
  the guest, and say so) or stay a guest. Merging becomes worth building when there is currency to
  merge, and then it needs its own rules.

### Logging out and deleting

- Logout clears the cookie and every `ballbattle.*` key (ADR 0051 item 5).
- **Deletion** (`DELETE /api/v1/me`, in the app and on the web, which both stores require):
  - immediate;
  - deletes the auth user, profile, ratings, queue entry, push subscriptions, open challenges and ladder
    scores;
  - keeps finished series for the opponent's history, with the player shown as "Deleted player"
    (`ON DELETE SET NULL`);
  - an open series is forfeited to the opponent;
  - revokes Apple's token once Sign in with Apple exists (Apple requires it);
  - backups age it out within 7 days, and the privacy policy says so.
- **Export** (`GET /api/v1/me/export`): a JSON file of everything keyed to the user.

## 3. Async PvP

### Which formats work without both players online

- **Blind** works against a saved lineup: each side locks an ordered lineup and the server plays
  it all. But its read is made with no information, which `docs/vision.md` calls a guess.
- **Reveal** can't be played by a saved lineup: each answer is a decision made after seeing the
  show. There are two ways to play it async:
  1. **Turns, like correspondence chess.** Each player decides when it's their turn.
  2. **A bot answers for the absent player** from their saved lineup. That rates the attacker
     against a bot, not a player, so it isn't PvP.
- **Showdown** works as turns too: round 1's picks are simultaneous (both lock, the server shows
  neither until both are in), then the winner shows and the loser answers.

### Recommendation

- **One async state machine for every format.** The server stores locked picks and asks the sim
  whose turn it is (`awaitingPick`), so all three formats come for free.
- **Slice 1 brings two ways to play, both unrated and open to guests:**
  - **Friend challenges** (a link), in any format and length.
  - **The open queue**: Reveal Best of 5 by turns, the format ranked will use. Players learn it
    before a rating is at stake, and ranked later adds a queue beside it, not a new format.
- **Ranked (slice 3) is Reveal Best of 5, by turns,** for signed-in players: one queue and one
  rating. It is the main mode, and its skill gap is the largest measured (20-23 points, ADR 0048).
- **Blind against saved lineups** (instant fights, no waiting) is a cheap later mode on the same
  tables. It's left out until players ask for it.
- **Live PvP later is the same machine with short timers** and a push to say a series moved on,
  instead of a new design.

### Friend challenges

1. **The challenger** chooses the format and length, builds a lineup and gets a link:
   `/?challenge=<token>`.
   - The token is 128 random bits. Only its hash is stored, it expires after 7 days, and it can
     be accepted once.
   - The challenger's lineup is never sent before the series starts.
2. **The friend** opens the link, builds a lineup without seeing the challenger's, and accepts.
   The series starts.
3. **Accepting your own link is refused.** A second friend opening a used link is told it's taken,
   and offered a challenge of their own (no dead end).

### How a series by turns plays (open queue, and later ranked)

1. **Find a match.** The player builds a 5-ball lineup exactly as today, before seeing the
   opponent's. It joins the queue with that lineup locked.
   - One queue entry per player, and at most 3 open series by turns of all kinds.
2. **Matching** runs in the same request, in one transaction:
   - it takes the oldest compatible entry (`FOR UPDATE SKIP LOCKED`): same ruleset and length, and
     not the same opponent within 24 hours. Ranked also needs the ratings within a window that
     widens with the entry's wait (by database time);
   - if one is found, the series is created; if not, the player's own entry waits, for up to 24
     hours.
   - The player can close the app either way. While they wait, the screen offers a friend
     challenge or a game against the bot. The queue may be empty in the early days, and friend
     links are the answer to that.
3. **The series starts:**
   - both lineups and the toss are shown;
   - the commitments are published;
   - the toss seed is revealed, since it decides who shows first.
4. **Turns.** On your turn you watch what played since your last visit (each round replayed from
   its revealed seed), then pick. In Reveal Bo5 a sitting is usually "answer, watch the round,
   show the next": about 5 sittings in all, alternating, fewer at 3-0.
5. **Deadline: 24 hours per turn, by database time.** A missed turn forfeits the series. Expired
   turns are settled when anyone reads the series, and by a scheduled function every 15 minutes.
6. **The end.** The last round plays, the server runs `verifySeries` on the final setup under the
   series' ruleset, then the result (and, in ranked, the rating change) is shown.
   - The client checks every revealed seed against its commitment (WebCrypto) and replays the
     series. A ✓ "fair play" mark in the series bar is the outcome, with the details in a
     `<details>`.

The home screen gains a "Your turn (n)" list, fetched on open.

### Push notifications move into slice 1

Play by turns depends on them. With 24 hours a turn and a forfeit at the end, a player who only
learns it's their turn by opening the app loses series they meant to play, and the opponent waits
for nothing. So Web Push is part of the first PvP slice, not a later one:

- **Opt-in:** asked after the player's first pick in an online series, never on load.
- **Sent when:**
  - it becomes your turn;
  - a queue entry is matched;
  - 4 hours are left on your turn (from the scheduled sweep);
  - a series ends.
- **How:**
  - a small service worker that only shows notifications and opens the series (no offline
    caching);
  - VAPID keys as Netlify secrets;
  - the `web-push` library on the server;
  - a `push_subscriptions` table;
  - `worker-src 'self'` in the CSP.
  - A subscription the push service says is gone (`404`/`410`) is deleted.
- **iPhones:** Safari delivers Web Push only to a web app added to the home screen (iOS 16.4 and
  later). An iPhone player in a Safari tab gets none until they add it or the native app ships, so
  the opt-in explains "Add to Home Screen" there. That limit is the main argument for the
  Capacitor release coming soon after accounts.

### A turn on the server

`POST /api/v1/series/:id/picks { round, ball }`, in one transaction:

1. `SELECT … FOR UPDATE` the series row, so one request at a time changes one series, on any host.
2. Rebuild the `SeriesState` from the stored lineups, picks and rounds with the sim's own
   functions, and check it is this side's turn for this round.
3. `INSERT` the pick `ON CONFLICT (series_id, round, side) DO NOTHING`. A retry or double submit
   returns the stored pick (the first lock wins), so picks need no idempotency key.
4. If the round is now complete:
   - reveal its seed and salt;
   - play it with the pinned sim, draws and sudden death included;
   - store the round and bump `version`.
   - Then, if no pick is due before the next round (Reveal's last round), play that one too.
5. If the series is decided: `verifySeries`, `finished`, rating changes, all in the same
   transaction.

The response is the viewer's view of the series (below). `GET /api/v1/series/:id` returns the same
view with an `ETag` of the version, so polling a series that hasn't moved costs a `304`.

### What a player is sent

One pure function, `viewOf(series, viewer)`, tested per format, decides it:

- both lineups (Reveal, Showdown), or only your own until the end (Blind);
- picks already shown by the format. In Showdown round 1, neither pick until both are locked;
- every commitment, and only the seeds and salts already revealed;
- whose turn it is, and the deadline.

Nothing seed-shaped is sent before its lock (ADR 0051).

### Seeds (ADR 0051 option B, one addition)

- For each series the server derives `HMAC-SHA256(K[key_id], seriesId ‖ purpose ‖ index)`, cut to
  32 bits:
  - `round/0..4`;
  - `toss`;
  - for a bot series, `lineup` and **`bot`**. `bot` is the seed of the bot's choice stream (today
    `setup.seed`), secret until the series ends.
- Every seed gets a random 128-bit salt and a commitment `SHA-256(seed ‖ salt)`. Only the salts
  are stored; the seeds are re-derived from `K`.
- `SeriesSetup` gains `seeds: { rounds; toss?; lineup?; bot? }` (ADR 0051 named all but `bot`).
  The ruleset bump is 15. Single-player play and links keep the one series seed.

### Rulesets

- A series is pinned to the ruleset it was created under (ADR 0051 option 2).
- **Frozen bundles arrive with the first PvP slice,** because a series by turns lasts days and a
  balance change must not void it. How they work:
  - each kept ruleset is an esbuild bundle of `src/sim/index.ts`, committed as
    `rulesets/r15/sim.mjs` and never edited;
  - the server imports the bundle the series names;
  - a client watching an older series lazy-loads the same file;
  - CI replays the golden results against every kept bundle.
- **Committing build output is deliberate (decided):** a bundle must be byte-identical forever,
  and rebuilding an old commit with newer tools doesn't promise that.
- **New series always use the newest ruleset.** Before ranked exists, balance changes ship as
  today. Once ranked is live, **changes that affect ranked fights ship only between seasons**
  (decided). Changes that touch only the bot or the offline game can still ship any time, since
  pinning keeps every open series on its own rules.

## 4. Leaderboards and rating

### The bot ladder (slice 4)

- **Weekly, against the Hard bot, Reveal Best of 5.** The score is the **best win streak of the
  week** (decided), ties to whoever reached it first. The board lists signed-in players only.
- One open ladder series per player. A series not finished within 24 hours is a loss, so
  abandoning a losing series doesn't protect a streak.
- The week starts and ends by database time (Monday 00:00 in Sydney, stored as UTC).
- Streaks are clear to read and need no rating maths. With option B's seeds, a streak can only
  come from drafting well, not from solving the seed.

### Ranked PvP (slice 3, signed-in players only)

- **Glicko-2**, updated after each series, the way Lichess does it, rather than in batched rating
  periods. It suits async play: few games, long gaps, and a rating deviation (RD) that says how
  sure it is.
  - Start at 1500, RD 350, volatility 0.06, τ 0.5.
  - RD grows with inactivity, computed from `last_series_at` when read.
  - A rating is shown with "?" while RD is above 110.
  - The leaderboard needs 10 ranked series in the season and sorts by `rating − 2·RD`, so a lucky
    start can't top it.
- **Why not Elo:** it treats a new player's first result as being as certain as a veteran's,
  which makes new players' ratings swing badly.
- **Glicko-2's `exp` and `log` live in `src/server/rating/`, never in the sim.** A rating is
  computed once, in one transaction, and stored. It doesn't need to match across engines.
- **Seasons** of about 8 weeks:
  - a new season carries each rating halfway towards 1500, with RD 250;
  - a series counts in the season it was created in, so one that spans the boundary isn't
    ambiguous.
  - **Ruleset bumps that change ranked fights go out only at season boundaries** (decided).
- **A result counts only after verification:**
  - the finishing transaction runs `verifySeries` under the pinned ruleset;
  - it writes `rating_changes` (primary key `(series_id, user_id)`, so it can't apply twice) and
    updates `ratings`.
  - If verification ever fails (the server built the series, so that is a bug): the series is
    `void`, nobody's rating moves, and the error monitor alerts.
  - A forfeit is a loss with nothing left to verify.

## 5. Data model

Postgres, in a schema `game` that is **not exposed** through Supabase's Data API (the browser
never queries the database). RLS is still enabled on every table with no policies, so a
misconfigured exposure leaks nothing.

| Table                | Key fields                                                                                                                                                                                                                                                                                                                                                                             | Notes                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`           | `user_id` PK → `auth.users` ON DELETE CASCADE, `display_name`, `created_at`                                                                                                                                                                                                                                                                                                            | Names start as "Player 4821"; signed-in players can change them                                                                                                                             |
| `series`             | `id` uuid, `kind` (`friend`/`open`/`ranked`/`ladder`), `ruleset`, `format`, `best_of`, `player_a`, `player_b` (null for a bot; both ON DELETE SET NULL), `bot`, `lineup_a`, `lineup_b` text[], `key_id`, `status` (`open`/`finished`/`forfeit`/`void`), `winner`, `version`, `turn_side`, `turn_deadline`, `season_id`, `request_id`, `created_at`, `finished_at`, `final_setup` jsonb | `unique (player_a, request_id)` makes creation idempotent. `final_setup` is the full `SeriesSetup` with revealed seeds and picks: a few hundred bytes that replay the whole series anywhere |
| `series_seeds`       | PK `(series_id, purpose, idx)`, `salt` bytea, `commitment` bytea, `seed` int (set on reveal), `revealed_at`                                                                                                                                                                                                                                                                            | Salts are secret until revealed. Seeds are derived from `K`                                                                                                                                 |
| `picks`              | PK `(series_id, round, side)`, `ball`, `created_at`                                                                                                                                                                                                                                                                                                                                    | The PK is the idempotent lock                                                                                                                                                               |
| `rounds`             | PK `(series_id, round)`, `a`, `b`, `outcomes` text[], `winner`, `sudden_death`                                                                                                                                                                                                                                                                                                         | Stored as played, so reads don't replay                                                                                                                                                     |
| `challenges`         | `id`, `token_hash` (unique), `creator`, `format`, `best_of`, `lineup` text[], `created_at`, `expires_at`, `series_id` (set on acceptance)                                                                                                                                                                                                                                              | Friend links. Accepting sets `series_id` where it is null, so it happens once                                                                                                               |
| `queue_entries`      | PK `user_id`, `kind` (`open`/`ranked`), `ruleset`, `best_of`, `format`, `lineup` text[], `rating` (ranked only), `created_at`                                                                                                                                                                                                                                                          | The lineup is never sent to anyone                                                                                                                                                          |
| `push_subscriptions` | PK `endpoint`, `user_id`, `p256dh`, `auth`, `created_at`                                                                                                                                                                                                                                                                                                                               | Deleted when the push service answers 404 or 410, and with the user                                                                                                                         |
| `seasons`            | `id`, `starts_at`, `ends_at`                                                                                                                                                                                                                                                                                                                                                           |                                                                                                                                                                                             |
| `ratings`            | PK `(user_id, season_id)`, `rating`, `rd`, `volatility`, `series_count`, `last_series_at`                                                                                                                                                                                                                                                                                              |                                                                                                                                                                                             |
| `rating_changes`     | PK `(series_id, user_id)`, before and after `rating`/`rd`                                                                                                                                                                                                                                                                                                                              | Idempotency and history                                                                                                                                                                     |
| `ladder_scores`      | PK `(user_id, week)`, `current_streak`, `best_streak`, `best_at`                                                                                                                                                                                                                                                                                                                       | Updated in the finishing transaction                                                                                                                                                        |
| `rate_limits`        | PK `(subject, bucket, window_start)`, `count`                                                                                                                                                                                                                                                                                                                                          | Fixed windows, upserted. Purged daily                                                                                                                                                       |

- **Replays and verification need only `final_setup`.** No tick data, snapshots or events are
  stored.
- **Migrations** are SQL in `supabase/migrations/`, written with `supabase migration new`.
- **Types:** row types are generated (`supabase gen types typescript --schema game`) and checked
  in. CI regenerates them against the migrated local database and fails on a diff.

## 6. Security and privacy

### ADR 0051's checklist, item by item

1. **`connect-src 'self'`.** The API is same-origin, so there's no CORS and no new origin.
2. **The session cookie** is `__Host-bb_session`: `HttpOnly; Secure; SameSite=Lax; Path=/`. The
   `__Host-` prefix forbids a `Domain` and requires `Secure`.
   - It holds Supabase's access and refresh tokens. A function refreshes them when expired and
     rewrites the cookie.
   - CSRF: every non-GET checks `Origin` against the site, and requires
     `Content-Type: application/json`, which a cross-site form can't send without a preflight
     that we never answer.
3. **HSTS** set explicitly in `netlify.toml` and `scripts/security-headers.ts`.
4. **`require-trusted-types-for 'script'`** added at the same time.
5. **Logout clears `ballbattle.*`.** A per-tab owner goes on saved series (audit 2.7).
6. **The server never trusts the client:**
   - it issues every seed;
   - it plays every round itself;
   - it runs `verifySeries` before anything counts.
   - **No worker pool (amends ADR 0051):** each function invocation is its own process slot, so a
     slow verification can't block another request. The function timeout is the CPU budget.
   - Limits are per account (`rate_limits`). Netlify's per-IP rule is only a coarse flood guard,
     set high enough for a school class on one IP.
7. **Time comes from the database.** Deadlines, weeks and seasons use `now()` in the
   transaction. No host clock is read for game rules.
8. **Payments:** not in this ADR; ADR 0051's rules stand.
9. **Legal:** below.

### Secrets and least privilege

- **`K` (the seed keys)** is a Netlify environment variable, marked secret and scoped to
  functions. Production and deploy previews get different keys. It is a JSON map of key id to
  key, so a key can rotate while old series keep theirs.
- **The functions connect to Postgres as a role `game_api`** with `SELECT/INSERT/UPDATE` on the
  game tables it needs, `DELETE` only on `queue_entries` and `rate_limits`, and nothing on
  `auth`.
- **The service-role key** is used only by the account-deletion and auth calls, in one module.
- Nothing secret is in the repo or the client bundle. A CI step fails the build if the client
  bundle contains a known secret's prefix.

### Abuse

| Abuse                                                   | Answer                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Farming a ladder streak with many guests                | Boards show signed-in accounts only, and a rate limit on series per account                                                                                                                                            |
| Win trading between two accounts                        | Matchmaking avoids repeat opponents within 24 h, and friend series are unrated. Watch for pairs that meet often                                                                                                        |
| Queue or pick spam, or guests who join and walk away    | Per-account rate limits, one queue entry, 3 open series by turns. A walked-away series is a forfeit after 24 h. Guest creation is rate-limited too, so a new guest per series costs the abuser time                    |
| Display names                                           | Optional, signed-in only, 3-20 characters. NFC-normalised, length counted in graphemes (`Intl.Segmenter`, so non-English names aren't cut mid-character), a word list, and a report button. No chat                    |
| Supabase's anonymous sign-in limit (30 per hour per IP) | **Our functions make that call, so every player shares Netlify's few outgoing IPs.** Test in slice 1 whether Supabase honours a forwarded client IP. If not, raise its limit and rely on ours (section 11, still open) |
| A player using a solver for picks                       | Allowed in effect: the counter map is public and the pick screens show the odds. Option B stops what matters, solving the seed                                                                                         |

### Logging, monitoring, backups

- **Logs:** one JSON line per request through a small `log()` helper: request id, route, status,
  duration, user id. Never tokens, cookies, emails or full IPs.
- **Errors:** Sentry's free tier on the functions from slice 1, with PII sending off. A `void`
  series is reported as an error. Client-side reporting comes later (another `connect-src`
  entry).
- **Backups:** Supabase Pro's daily backups from the day real players' progress matters. Before
  that, the data is a beta and can be reset. Add point-in-time recovery when currency or
  purchases exist.

### Australian privacy law (NSW). Not legal advice

- **The Privacy Act 1988 and its Australian Privacy Principles** apply to businesses with more than
  $3M annual turnover, with exceptions. A solo developer is very likely exempt today.
  - The government has agreed in principle to remove that exemption, so build as if the APPs
    apply. It costs little here: collect the minimum, say what's collected, let players see and
    delete it.
- **The Children's Online Privacy Code** (due from the OAIC by December 2026) will cover services
  likely to be used by children. A casual game probably is. Watch it before launch.
- **The statutory tort for serious invasions of privacy** (in force since June 2025) applies
  whatever the turnover.
- **NSW's own privacy act** binds NSW public agencies, not us.
- **The under-16 social media ban** excludes online games. Adding chat or social feeds would need
  a fresh check.
- **GDPR and UK GDPR** apply to players there, whatever our size, if the game is offered to them.
  Export and deletion cover most of it.
- **What we collect:**
  - a user id;
  - an email only for email sign-in;
  - a display name only if chosen;
  - play records;
  - a push subscription only if the player opts in;
  - IPs only in short-lived platform logs.
  - Stored in Sydney. Supabase, Netlify and Sentry are overseas companies, which is a
    cross-border disclosure under APP 8.
- **The app stores require** a privacy policy page (and Apple's privacy labels).

### Legal advice comes first (decided)

**No stored player data goes public until a lawyer has answered these.** Slice 1 stores guest
data, so its public launch waits for this. Until then the online modes are switched on only in
deploy previews and staging (a build flag set per Netlify context).

1. **Privacy policy:** what it must say for guests, accounts, push subscriptions, error reports and
   overseas providers, and where it must be shown (the site, both app stores).
2. **Terms of service:** conduct, forfeits, removing accounts that cheat, liability, and later
   virtual currency and refunds under the Australian Consumer Law.
3. **The small-business exemption:** does it apply, does it still apply once players overseas or
   purchases come, and should we opt in to the APPs anyway (`docs/vision.md` builds as if they
   apply)?
4. **Players under 16:**
   - whether to ask an age, and what to do with the answer;
   - the Children's Online Privacy Code;
   - whether playing strangers with generated names and no chat needs parental consent;
   - the app stores' age ratings.
5. **Guest data:**
   - is an anonymous user id with its play history personal information;
   - is 90 days of inactivity before deletion a fair retention;
   - may finished series be kept for the opponent's history after deletion, shown as "Deleted
     player";
   - what consent push notifications need.

Later, before purchases: loot-box classification (already in `docs/vision.md`), and GDPR if the
game is marketed outside Australia.

## 7. Code layout and standards

```text
src/sim/index.ts           the sim's one public API (ADR 0051): createWorld, step, the series
                           functions, a bound verifySeries, BOTS, RULESET_VERSION
src/api/                   the contract: request and response types and their decoders, shared by
                           client and server (no DOM, no Node)
src/server/                the game server: seeds.ts, series-machine.ts, view.ts,
                           rating/glicko2.ts, db/*.ts (one module per table group), session.ts,
                           log.ts. Node types, no DOM
netlify/functions/*.ts     one small file per route, about 20 lines each: parse, call
                           src/server, answer
supabase/                  config.toml, migrations/*.sql, seed.sql
rulesets/r15/sim.mjs       frozen bundles (slice 3)
```

- **Import rules (ESLint):**
  - `src/server` may import `src/sim/index.ts` and `src/api`, nothing else;
  - the client may import `src/api` but never `src/server`;
  - nothing outside the sim deep-imports sim modules.
- A `tsconfig.server.json` sets `lib: ES2023` and Node types.
- **Validation** uses hand-written total decoders taking `unknown`, like `decodeSeriesSetup`. No
  Zod: the repo has one style for untrusted input. Worth revisiting if the contract passes about
  20 routes or a native app wants a generated client (then OpenAPI).
- **API conventions:**
  - `/api/v1`, JSON;
  - errors as `{ error: { code, message } }` with the right HTTP status;
  - `ETag` on series reads;
  - a client `requestId` on creates.
  - It is a plain REST API that a native app can call as it is.

### Environments

|                 | Client and API                   | Database                                | Seed key                                                |
| --------------- | -------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Local           | `netlify dev` (Vite + functions) | `supabase start` (Docker)               | A dev key in `.env` (git-ignored, with an example file) |
| Deploy previews | Netlify deploy preview           | Staging project, shared by all previews | Staging key                                             |
| Production      | Netlify production               | Production project                      | Production key                                          |

- **Migrations to production** run in the Netlify production build (`[context.production]`,
  `supabase db push` before `vite build`), so the database is migrated before the functions that
  need it go live. Migrations are expand-then-contract, so the previous deploy keeps working.
- **Staging** is migrated by a CI job on every pull request that changes `supabase/`.
- **A Supabase branch per PR** is the standard, but it's a paid feature. Shared staging is enough
  for one developer. Grow to branches when two PRs' migrations start to collide.

### Tests and CI

- **Unit tests (Vitest, the existing `unit` project), no database:**
  - seeds and commitments, with test vectors shared by Node `crypto` and WebCrypto;
  - `viewOf` for every format (what each side may see after each lock);
  - the series machine against `verifySeries`;
  - Glicko-2 against the worked example in Glickman's paper;
  - the decoders, fuzzed like `series-verify-untrusted.test.ts`.
- **Integration tests (a new `server` project, a new CI job):**
  - `supabase start`, apply migrations, then call the function handlers directly with `Request`
    objects;
  - two concurrent locks of one round (the first stored wins);
  - a stale pick after the round played;
  - a retried create;
  - a deadline passing;
  - deleting a player mid-series;
  - the `authenticated` and `anon` roles can't read `game.*`.
- **Browser flows:** a friend challenge played by two browser contexts against the API running
  locally (`netlify dev`), in Chromium at first. The offline game's flows don't change.

### Deliberately simple, and when to grow it

| Simple now                                            | Standard or bigger                  | Grow when                                                                                                                   |
| ----------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Hand-written decoders                                 | Zod, or OpenAPI codegen             | ~20 routes, or a generated native client                                                                                    |
| Plain SQL through `postgres` with generated row types | A query builder (Kysely)            | Queries get dynamic (filters, sorting UIs)                                                                                  |
| Shared staging database                               | A database branch per PR            | Migrations collide                                                                                                          |
| Rate limits in Postgres                               | Redis or Upstash                    | Limit checks show in latency                                                                                                |
| Polling with `ETag`                                   | Realtime push                       | Live PvP                                                                                                                    |
| `src/sim` with an `index.ts`                          | ADR 0051's `packages/sim` workspace | A second repo or package consumes the sim. Until then the workspace moves ~90 imports for no gain. **This amends ADR 0051** |
| No worker pool                                        | A pool                              | The server moves off serverless                                                                                             |

## 8. Build order

Each slice ships on its own. Sizes: S half a day, M one to two days, L more.

### Slice 0: the sim ready for a server (M, 2 PRs, no visible change)

- **PR 1:** `src/sim/index.ts` with a bound `verifySeries`. Also `erasableSyntaxOnly`, the ESLint
  ban on deep sim imports, and normalising `bestOf` defaults before storing.
- **PR 2:** explicit seeds in `SeriesSetup`, all four (`rounds`, `toss`, `lineup`, `bot`), read by
  `roundSeed`, `revealFirst`, `pickLineup` and the bot's stream.
  - The decoder learns them; ruleset 15 and `pnpm golden`.
  - Also `src/api/fairness.ts` (commitment checks in WebCrypto) and the HMAC derivation, with test
    vectors.

### Slice 1: player vs player, guests welcome, unrated (L, about 6 PRs)

The first thing players see from the backend. It contains:

1. **Infrastructure (M):**
   - Supabase projects in Sydney, the Netlify functions region, `supabase/` with the first
     migration, the `game_api` role;
   - `GET /api/v1/health`, which reads the database;
   - the integration CI job; Sentry; `log()`;
   - the build flag that keeps online modes out of production until the legal sign-off.
2. **Guest sessions and headers (M):**
   - guest creation on the first online action, the cookie, `sessionOf`, the CSRF check;
   - `connect-src`, HSTS, Trusted Types, logout and "Forget me" clearing `ballbattle.*`;
   - rate limits;
   - the test of Supabase's anonymous sign-in limit through our functions.
3. **The series machine (L):**
   - `series-machine`, `viewOf`, secret seeds and commitments, picks by turns;
   - deadlines, forfeits and the scheduled sweep;
   - the first frozen ruleset bundle, with its golden run in CI;
   - the client plays a server series in the existing series screens, with a fair-play ✓ at the
     end;
   - offline, the online modes show a "You're offline" state with a way back (no dead end).
4. **Friend challenges (M):**
   - the link, accepting it, any format and length;
   - the "Your turn (n)" list on home;
   - an "Online" section in Other modes.
5. **The open queue (M):** Reveal Best of 5, matched by waiting time (no rating yet), with a friend
   link or a bot game offered while waiting.
6. **Web Push (M):** the opt-in, the service worker, subscriptions, and the four notifications
   above.

**Before its public launch:** the legal answers (section 6), the privacy policy and terms pages,
the Netlify Personal plan, and Supabase Pro if the series kept are worth backing up (recommended:
yes, from launch).

### Slice 2: real accounts (M-L, about 3 PRs)

- Google and email-code sign-in, linking a guest, display names;
- data export, and account deletion beyond "Forget me" (Apple's token revocation follows with
  Sign in with Apple).

### Slice 3: ranked (M-L, about 3 PRs)

The queue, turns and pinning already exist, so ranked is the rating and the rules around it:

1. Glicko-2, `ratings`, `rating_changes`, and the ranked queue with its rating window, for
   signed-in players (M).
2. Seasons, season 1, and the rule that ranked-affecting balance ships only between seasons, in
   CLAUDE.md and the publish checklist (S-M).
3. The ranked leaderboard (S-M).

### Slice 4: the weekly ladder against the Hard bot (M, about 2 PRs)

- Bot series on the same machine (the `lineup` and `bot` seeds secret until the end);
- `ladder_scores` and the best-streak board for signed-in players.

After that, in `docs/vision.md`'s order:

- **Currency and unlocks:** server-owned balances in an append-only ledger table.
- **The Capacitor release:**
  - Sign in with Apple;
  - the bearer-or-native-cookie decision;
  - native push. It closes the iPhone Web Push gap, so it should come soon after accounts.
- **Live PvP:** the same machine with short timers and a realtime channel, its own ADR. Supabase
  Realtime or Durable Objects decided then.

## 9. Library and platform behaviour this relies on

| Library or platform       | Behaviour to rely on or guard against                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Netlify Functions         | Default region Ohio: set `syd`. Each instance may be reused or not: no state in memory. Env vars differ per deploy context. Scheduled functions have a short execution limit (enough for settling deadlines). Per-IP rate-limit rules count every user behind one IP together                                                                                                                                                                                                                                 |
| Netlify billing           | 15 credits per production deploy; the Free plan's limit is hard (the site stops)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Supabase Auth             | Access tokens last 1 h by default. Refresh tokens rotate, with a short reuse window: two tabs refreshing at once must both succeed (test it). Anonymous sign-ins are limited per IP and the docs recommend a CAPTCHA. `linkIdentity` needs manual linking switched on. The default email sender isn't for production. JWTs are signed with asymmetric keys and verified against a JWKS: check issuer and audience `authenticated`, and set an explicit small clock tolerance rather than trusting the default |
| Supabase free plan        | Pauses a project after 7 days without activity (staging will pause; fine). No downloadable backups. Two free projects per account                                                                                                                                                                                                                                                                                                                                                                             |
| Supabase Data API         | Exposes `public` by default: our tables live in `game`, which isn't exposed                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `postgres` (porsager)     | Through Supabase's pooler in transaction mode it needs `prepare: false`. Keep `max: 1` per function instance                                                                                                                                                                                                                                                                                                                                                                                                  |
| Postgres                  | `now()` is the transaction's start time, the same for every statement in it: deadlines are compared against it. `FOR UPDATE SKIP LOCKED` for matching. `ON CONFLICT DO NOTHING` for idempotent locks                                                                                                                                                                                                                                                                                                          |
| WebCrypto / Node `crypto` | Same HMAC and SHA-256 bytes (ADR 0051); test vectors pin it                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Cookies                   | `SameSite=Lax` set explicitly. `__Host-` needs `Path=/`, `Secure`, no `Domain`. A Capacitor WebView treats our API's cookies as third-party (WebKit blocks them): see section 2                                                                                                                                                                                                                                                                                                                               |
| Glicko-2                  | Uses `exp` and `log`. Fine on the server, never in `src/sim`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 10. Real usage, checked

| Scenario                                              | What happens                                                                                            | Test                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| A school class, one IP, all making guests             | Our limits are per account. Supabase's per-IP anonymous limit is the risk                               | Slice 1: 50 guest creations from one IP through the functions |
| Double tap on a pick, or a retry on a slow connection | The first lock wins and the retry gets the stored pick                                                  | Two concurrent locks; the same lock twice                     |
| The same series open in two tabs                      | The server holds the state; the stale tab's pick is refused or returns the stored one, and it refetches | A stale `ETag`, then a pick                                   |
| Reconnecting mid-turn                                 | `GET` the series and carry on                                                                           | Drop between lock and reveal                                  |
| A deploy bumps the ruleset mid-series                 | The series finishes on its pinned bundle                                                                | Create under r15, deploy r16, finish under r15                |
| Hosts with different clocks                           | Only database time is used                                                                              | A deadline test with a faked host clock                       |
| A player deletes their account mid-series             | The opponent wins by forfeit; history shows "Deleted player"                                            | Integration test                                              |
| A guest clears site data                              | The guest is gone; the UI warned them                                                                   | A flow on the warning                                         |
| Non-English display names                             | NFC, graphemes counted, never part of a seed or hash                                                    | Names in Thai, Arabic, emoji with joiners                     |
| The client's replay disagrees with the server's round | The server's result stands; the client logs a determinism error                                         | A forced mismatch in a unit test                              |

## 11. Decisions (2026-11-14) and what is still open

### Decided

1. **Player vs player comes first:** friend challenges and an open queue, both unrated and open to
   guests, are slice 1. Accounts follow, then ranked, then the weekly bot ladder. Web Push moves
   into slice 1, because play by turns depends on it.
2. **The weekly ladder** is scored by best weekly win streak.
3. **Guests** play friend challenges and the open queue, never ranked; ranked needs an account.
4. **24 hours per turn and up to 3 open series by turns** to start.
5. **Ranked-affecting balance changes ship only between seasons.**
6. **The Netlify Free plan stays for now. Production publishes in batches** from `release` (built
   with this ADR). Move to Personal when the first functions go live in production.
7. **Both departures from ADR 0051 are accepted:** no `packages/sim` workspace yet, and no worker
   pool. The bot's choice seed joins the secret seeds.
8. **Each ruleset's frozen sim is committed** to the repo.
9. **Legal advice comes before any stored player data goes public.** The questions are in section 6.

### Still open

- **Population.** The open queue may be empty early on. Friend links and the bot fill the wait.
  Watch how long entries wait before deciding when ranked opens.
- **Supabase's per-IP anonymous limit seen through our functions.** If a forwarded IP or a raised
  limit doesn't fix it, there are two ways out:
  - the browser calls Supabase directly for the guest, and the tokens go straight to our cookie
    endpoint;
  - or a Turnstile CAPTCHA (a third-party script, and CSP changes).
  - Slice 1's second PR answers this.
- **iPhone players in Safari get no push** until they add the game to the home screen or the
  native app ships. Watch the forfeit rate by platform. If it's high, the Capacitor release moves
  up.
- **The legal answers** may change the data kept for guests, or add an age question to slice 1.

## Consequences

- The game gains a server, and with it ongoing work:
  - two Supabase projects;
  - secrets and their rotation;
  - migrations;
  - an integration CI job (about 2 minutes);
  - an error monitor to read.
- The offline game is untouched. Online play is opt-in: a section of Other modes and a "Your
  turn" list, and later a ranked button.
- Every competitive result comes from the server's own play of fair, committed seeds, and anyone
  can re-check it from `final_setup`.
- Moving the API to Cloudflare later stays a port, not a rewrite.
