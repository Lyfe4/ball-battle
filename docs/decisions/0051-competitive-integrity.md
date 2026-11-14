# 0051: Competitive integrity: secret seeds, pinned rulesets, and what comes before accounts

- Status: Accepted (2026-11-14): option B for seeds, pinned rulesets with frozen bundles for
  verification. Not built yet: it is the design the server work follows.
- Date: 2026-11-14
- Amends: ADR 0017 (a series' seed), ADR 0022 (one ruleset per build, verifying a
  series)
- Amended by: ADR 0052 (the bot's choice seed is secret too; no `packages/sim` workspace or worker
  pool yet)
- Builds on: `docs/audit-2026-11.md` sections 2.3, 2.4, 2.5, 2.7 and 7

## Context

Everything below the draft is built so a backend can sit on it (`docs/vision.md`, "Long-term
goal"): a pure sim that runs in Node, one decoder for untrusted series data
(`decodeSeriesSetup`), and one gate for a valid series (`verifySeries`). Three things still stand
between that and any competitive mode: async PvP, leaderboards (bot ladders included) and later
live PvP.

1. **The seed decides the future, and the client holds it.** `SeriesSetup.seed` decides every
   round's seed (`roundSeed`), every replay of a drawn round (`attemptSeed`), sudden death, the
   Reveal coin toss (`revealFirst`) and, through `lineupSeed`, the bot's lineup. Verifying a Best of
   3 takes about 14 ms, so whoever knows the seed during the draft can play every candidate pick
   out and choose the one that wins. The draft is where `docs/vision.md` puts the skill. With the
   seed known it is a lookup, not a read of the opponent. `deriveSeed` is a reversible
   murmur3-style mix over 32 bits, so revealing one round's seed also gives away the others.
   Hiding the series seed and revealing round seeds doesn't fix that.
2. **The opponent's hidden balls are only hidden by the UI.** Anyone can compute
   `pickLineup(lineupSeed)` from a link. Against a bot in a static site that doesn't matter. In
   PvP the server must never send what a format hides: the opponent's lineup in Blind, and the
   other pick in Showdown before both are locked.
3. **One build verifies one ruleset.** `verifySeries` refuses any setup whose `ruleset` isn't
   today's `RULESET_VERSION` (ADR 0022). An async series takes hours or days, and a deploy that
   bumps the ruleset in that time leaves every open series unverifiable.

Accounts and payments add the usual web risks (section 4).

### What a fair draft needs

- **Nobody can compute a round's result before both picks for that round are locked.** That
  means the player, the opponent, and anyone reading traffic or the client's memory.
- **Nobody can choose a seed after seeing the picks.** That includes the server, so players can
  check afterwards that it didn't.
- **Simultaneous picks (Showdown) stay simultaneous.** The second player to lock learns nothing
  of the first's pick.
- **Every result can be replayed and checked by anyone once the series is over**, as a link can
  be today.
- **Real usage holds.** Retries and double submits of a pick don't change it. A dropped
  connection mid-draft can reconnect. Many players behind one IP (schools, mobile carriers) aren't
  treated as one.

## Options

### A. Keep the client-held seed (today)

Fine for single-player and casual links, where no one gains by solving their own draft. **Not
acceptable for anything ranked**, bot ladders included: the best ladder score would belong to
whoever runs the sim on every pick.

### B. Server-secret seeds, revealed after each lock, with published commitments (recommended)

- The server keeps a secret key `K` (a secret manager, shared by every host, with a key id so it
  can be rotated).
- When a series is created, it derives every seed the series needs as
  `HMAC-SHA256(K, seriesId ‖ purpose ‖ index)`, cut to 32 bits:
  - each round's seed (attempts and sudden death keep deriving from it, so a drawn round replays
    the same way);
  - the Reveal toss;
  - the bot's lineup seed, on a bot ladder.
- For each seed it publishes a **commitment** `SHA-256(seed ‖ salt)`, with a random 128-bit salt
  per seed. Seeds are only 32 bits, so a commitment without a salt can be brute-forced in seconds.
- The commitments go out when the series starts. Each round's seed and salt are revealed only
  once both picks for that round are locked. The toss is revealed at the start, since it decides
  who shows first. The bot's lineup seed is revealed when the series ends.
- Once the series is over, a client (WebCrypto) or anyone else checks every revealed seed against
  its commitment. The series then replays through `verifySeries` like a link today.

Why it works:

- Round _r_'s seed is unknown to the players until both round-_r_ picks are locked, so no pick
  can be simulated against it.
- HMAC outputs are independent, so revealing round 1's seed says nothing about round 2's. The
  reversible `deriveSeed` problem goes away.
- The commitments fix every seed before any pick, so the server can't grind seeds to favour
  anyone without the published commitments exposing it.
- HMAC is deterministic, so any host holding `K` derives the same seed. Nothing has to be
  coordinated between machines, and a retried request gets the same answer.

Simultaneous picks need no cryptography between players here. The server is the referee: it
accepts a pick, stores it, and sends neither pick (nor the round seed) until both are locked.
Locking is idempotent per (series, round, side): the first lock wins, and a retry or double
submit returns the stored pick. State changes use compare-and-set on a series version number, so
requests that arrive late or out of order can't reorder a series.

Costs: server state per series (the seeds can be re-derived from `K`, so only the salts and picks
need storing), and `K` must be protected and rotated (a series records the key id it used).

### C. Joint randomness: commit-reveal between both players and the server

Each party commits to a random value, then reveals it once all commitments are in. The round seed
is a hash of all three, so no single party, the server included, controls it.

- Stronger than B: it protects against a malicious server, not just a grinding one.
- Much more to build: three-party rounds, and a policy for a player who never reveals (forfeit,
  then a server timeout that holds across hosts with different clocks, so it needs database time).
- Every round costs an extra round trip, which hurts live PvP on a phone.

Worth it for prize play run by a third party. Not worth it while the server is ours and its
commitments are public.

### D. A public randomness beacon (for example drand)

The round seed is a hash of the beacon's value for a time just after both picks lock.
Unpredictable and publicly verifiable, with no secret key to run. But it adds an outside
dependency and its latency (beacons publish every few seconds), and an outage blocks play. A good
upgrade for B's commitments in tournaments, not the base.

### Recommendation

**B.** It meets every requirement above against the threats that matter for this game: players
solving the draft, players seeing hidden picks, and a server that could quietly grind seeds. It
keeps the sim pure, because HMAC and SHA-256 run on the server and in the browser's WebCrypto,
never in `src/sim`. And it adds no round trips. C and D stay open as upgrades for prize play,
because B's revealed seeds have the same shape whatever produces them.

### What changes in the sim (when B is built, with a ruleset bump)

- A series setup gains explicit seeds: `seeds: { rounds: readonly number[]; toss?: number }`
  beside today's single `seed`. `roundSeed`, `revealFirst` and the bot's `lineupSeed` read from
  them when present. Single-player play and links keep the series seed, exactly as today.
- `decodeSeriesSetup` learns the new field. `verifySeries` stays the one gate and needs no crypto:
  it replays the revealed seeds. Checking commitments is the server's job, and the client's after
  a series.
- The draft sends a client only what the format shows, and nothing seed-shaped before its lock.

## Verifying a series across rulesets

### Options

1. **Drain before a bump.** A ruleset bump waits until no series is open, or voids the open ones.
   Simple, but async series can last days, so it either blocks deploys or voids real games.
2. **Pin the ruleset per series and keep old sims runnable (recommended).** Every series records
   the ruleset it was created under (it already does: `SeriesSetup.ruleset`).
   - Each bump freezes the sim at that commit into a versioned bundle (for example
     `sim-r14.mjs`, built from `src/sim` with an `exports` map, see "Packaging" below). The
     server keeps a map from ruleset to bundle and verifies each series with the bundle it was
     created under.
   - A client watching a series from an older ruleset lazy-loads that bundle too: a few tens of
     KB, only when needed.
   - CI runs the golden results (ADR 0023) against every bundle still kept, so an old bundle that
     stops reproducing its own results fails the build.
   - Bundles are kept for a window, for example the last 3 rulesets or 30 days. After that an
     open series is settled by the rule announced for the season (finished on its current
     ruleset if possible, else voided and refunded) and its bundle retired.
3. **Store results, not rules.** The server verifies once, then keeps the outcome and enough
   replay data (per-tick snapshots or events) for clients to show it without the old sim. It
   needs no old code, but the data is large, and a stored result can't be re-verified after a
   bug fix.

**Recommendation: 2**, with 1's drain kept as the season-boundary rule. Pinning is what ADR 0022
already implies (a link names its ruleset). Keeping a frozen bundle per ruleset is cheap because
`src/sim` already imports nothing outside itself (enforced by ESLint since this audit) and runs
in Node unchanged.

### Packaging (before the first server line)

- `src/sim/index.ts` as the one public API:
  - `createWorld`, `step`, `BALL_LOOKUP`;
  - the series functions, `decodeSeriesSetup`, a **bound** `verifySeries(setup)` that always uses
    `BALL_LOOKUP` (the bot picks by index into the lookup's order, so a caller must not be able
    to pass another lookup);
  - `BOTS`, `RULESET_VERSION`.
- Then move it to `packages/sim` in a pnpm workspace with an `exports` map, and
  `erasableSyntaxOnly` so Node's type stripping keeps working.
- Normalise optional defaults before hashing or storing a setup (`bestOf: 3` and no `bestOf` are
  the same series).

## Before accounts and payments

Each is small. All of them come before the first account exists:

1. **CSP `connect-src`** for the API origin. Today `default-src 'none'` blocks every `fetch`.
2. **Session in an `HttpOnly; Secure; SameSite=Lax` cookie**, never in `localStorage`, where any
   script on the origin can read it. Pair it with **CSRF protection**: SameSite plus an `Origin`
   check on every state-changing request.
3. **An explicit `Strict-Transport-Security`** header, rather than relying on the host's default.
4. **`require-trusted-types-for 'script'`** in the CSP. Production has no HTML sinks today, so it
   costs nothing and keeps it that way.
5. **Logout clears every `ballbattle.*` key.** Otherwise a held series resumes for the next person
   on a shared device. Saves get a per-tab owner, because two tabs share one saved series today
   (audit 2.7).
6. **The server never trusts the client:**
   - it issues every seed (option B);
   - it verifies every result with `decodeSeriesSetup` and `verifySeries` in a worker pool with a
     CPU budget (a worst-case Best of 5 is about 0.5 s);
   - it rate-limits per account, never per IP alone (families, schools and mobile carriers share
     IPs);
   - it uses idempotency keys on every submission, so retries and double submits are harmless.
7. **Time comes from the database**, never from a client or a host's clock. Pick timers, forfeits
   and season ends must agree across hosts whose clocks differ.
8. **Payments:**
   - use the provider's hosted checkout or fields only, never card data of our own;
   - load its script or iframe only on the payment route, with `frame-src` and `script-src`
     scoped to it there, and relax `payment=()` only there;
   - grant purchases from the provider's signed webhook, idempotent per event id, never from the
     client's redirect;
   - keep entitlements and currency on the server (`docs/vision.md`).
9. **Legal checks before shipping**: paid random rewards (`docs/vision.md`: an M rating in
   Australia, R18+ for simulated gambling), privacy law for accounts (data export and deletion),
   and age requirements in each market.

## Real usage (checked)

- **Double submit or retry of a pick:** idempotent lock per (series, round, side). Test: submit the
  same lock twice, and two different picks for one round concurrently; the first stored wins.
- **Reconnect mid-draft:** the client fetches the series state (its own picks, what the format
  shows, revealed seeds) and carries on. Test: drop the connection between lock and reveal.
- **Out-of-order requests:** compare-and-set on the series version. Test: replay a stale lock
  after the round is revealed; it is refused.
- **A deploy mid-series:** the ruleset is pinned. Test: create under r14, deploy r15, finish and
  verify under r14.
- **Shared IPs:** limits per account. Test: many accounts from one IP each play normally.
- **Non-English names:** names are display text only, never part of a seed or a hash input.

## Library and platform behaviour this relies on

- Node `crypto.createHmac('sha256', key)` and the browser's `crypto.subtle.sign('HMAC', ...)`
  give the same bytes for the same key and input, and both are available without a dependency.
- JSON carries 32-bit unsigned integers exactly (below 2^53), so seeds survive a round trip.
- Browsers default cookies without a `SameSite` attribute to `Lax`, but the attribute is still
  set explicitly, because defaults differ between engines and versions.
- `localStorage` is per origin, shared by every tab, and has no notification within the writing
  tab. Per-tab ownership needs `sessionStorage` or a `storage` listener.

## Consequences

- Ranked and ladder modes are possible without the draft becoming a lookup. Single-player play and
  links stay as they are.
- One ruleset bump carries the explicit seeds, and from then on every kept ruleset adds a frozen
  bundle and a golden run in CI.
- The server owns secrets (`K`, salts) and their rotation. That is new operational work.
- Nothing here is built yet. The first server code follows it: packaging first, then option B
  with its ruleset bump, then ruleset pinning, with the checklist above before the first account.
