# BallBattle

Browser auto-battler: balls with different abilities bounce around a square arena with health
bars until one wins. No player control; you pick balls and watch. This is a portfolio piece, so
code quality matters as much as features.

Where it's heading (PvP best of 3 with blind lineups, soft counters, then a backend):
`docs/vision.md`. Built today: Best of 3 and Best of 5 against a bot (ADR 0017, 0048), three draft
formats (blind, reveal, showdown; ADR 0019, 0021, 0029, 0035) and three bot levels (ADR 0035);
online (previews, staging, and the live site behind the vs Friend switch, ADR 0068), live friend matches in Reveal and Showdown (ADR 0052, 0053).
Home is by opponent (ADR 0055, `src/app/modes.ts`): Play opens the last series set up against the
bot in one tap (first visit: Best of 3 · Reveal · vs Normal bot), and a card per opponent opens
its setup screen (vs Bot; vs Friend in online builds). The series rules and bots are pure sim code
(`src/sim/series.ts`, `src/sim/bot.ts`), the same functions a server would run, so keep them
deterministic and DOM-free. Every decision is an ADR in `docs/decisions/` (indexed in its
README, with status); the last audit is `docs/audit-2026-11.md`.

Stack: TypeScript (strict), Vite, pnpm, Vitest, ESLint (flat config) + Prettier, Husky +
lint-staged, plain HTML Canvas 2D. No game engine, no physics library, no React.

## Commands

- `pnpm dev`: the dev server on http://localhost:5199. Dev only: `/styleguide.html` (every ball
  design in each ability state, large and at phone size, and the shared UI parts; `?only=ui`,
  `?only=phone-arena`), `/brand.html` (icons and link-preview image drawn by the game's
  renderer; save each canvas as the `public/` file it names and commit it) and `/sounds.html`
  (every sound, each ball's in turn, the busiest fights as sound alone).
- `pnpm build`: typecheck and build to `dist/`. `pnpm preview`: serve `dist/` on
  http://localhost:4199 with the production security headers (`scripts/security-headers.ts`, kept
  in step with `netlify.toml` by a test); check the console for CSP errors after loading anything
  new.
- `pnpm test` (`pnpm test:watch`): the fast unit suite. A test that plays whole series or every
  pair gives itself a time budget (`WHOLE_RUN_TIMEOUT_MS`) rather than relying on Vitest's 5 s.
- `pnpm test:slow`: roster-wide tests that play every matchup for whole matches (`*.slow.test.ts`,
  one file per concern, helpers in `src/sim/balls/roster-support.ts`). Run after changing any
  ball or the combat rules.
- `pnpm test:browsers`: the known match results (`src/golden`, ADR 0023) and flows through the
  real page (`*.browser.test.ts`, ADR 0025) in headless Chromium, Firefox and WebKit. Projects by
  suffix: `wide` 1280 x 800, `full` 1920 x 1080 (ADR 0038), `touch` 375 x 812 with real taps (ADR
  0037), `iphone` 390 x 844 and `safari` 390 x 664 (ADR 0039), `landscape` 812 x 375 (ADR 0067). Never resize the viewport in a
  test. Browser tests never use a random seed: each file starts as a fresh device on a pinned
  seed (`src/flows/browser-setup.ts`, `fixed-seed.ts`; a flow pins its own with `pinSeed`), and
  every wait names what it waits for (`waitFor`, `until`). Locally, one engine at a time is what
  CI runs (`--project "browsers* (chromium)"`); all three at once can overload a machine. Needs
  `pnpm exec playwright install chromium firefox webkit` once.
- `pnpm test:db`: the API (`src/server`, `*.db.test.ts`) against a local Supabase; start it first
  with `pnpm exec supabase start` (Docker). Migrations are `supabase/migrations/*.sql` (`pnpm exec
supabase migration new <name>`, then `pnpm exec supabase db reset`).
- `netlify dev`: an online build (`pnpm build:online` first) and the API on one origin,
  http://localhost:8888, with `.env` (`node scripts/local-env.ts > .env`). Online play is built
  only where `VITE_ONLINE=1` (previews, the main branch deploy, `build:online`) and served only
  where the functions have `BALLBATTLE_ONLINE=1`; production builds `VITE_ONLINE` from
  `BALLBATTLE_ONLINE`, the vs Friend switch (`node scripts/friend-switch.ts on|off|status`, ADR
  0068). Never switch it on unless the user asks. `pnpm test:online`: two phones through live
  friend matches in Chromium (a whole match, a pick running out, Leave and forfeit, a disconnect),
  against `netlify dev`. After changing `src/server`, restart `netlify dev`: it can keep serving
  the old functions.
- `pnpm lint`, `pnpm typecheck` (`tsc -b`), `pnpm format` / `pnpm format:check`.
- `pnpm balance [seeds] [--ball <id>] [--serial]`: every matchup (both slot orders) across all
  cores; prints the matrix, each ball's shape and whether the targets are met; exits 1 on any
  MISS. Run after any change to a ball's stats or ability or the combat rules; `--ball` plays one
  ball's matchups (a new ball), `--serial` one thread with byte-identical output. `pnpm balance:summary` also rewrites `docs/balance-summary.md` (commit it after such a change);
  `pnpm balance:matrix` writes the matchup sheet, `docs/balance-matrix.csv` (every pair: rates,
  map, band) and `docs/balance-balls.csv` (every ball's counters), from the same fights without
  the sensitivity runs; `pnpm balance:ci` is CI's reduced run (150 seeds, map shape, ADR 0011 addendum).
- `pnpm golden`: rewrite `src/golden/golden-matches.json` after a `RULESET_VERSION` bump. It
  refuses otherwise: results that move without a bump are a bug.
- `pnpm ruleset:freeze`: after `pnpm golden`, freeze the new ruleset as `rulesets/r<N>/` (its
  bundled sim and its known results; ADR 0052). Commit it; it is never rebuilt or edited, and
  `test:slow` replays every frozen ruleset's results against its own bundle.

CI runs format, lint, typecheck, unit tests and build in one job, `test:slow`, `balance:ci` and
`test:db` (against a local Supabase) and `test:online` (against `netlify dev`) in their own, and the browser suite in two jobs per engine (phones, the rest): 11 jobs. All must pass.

## Architecture rules

1. **`src/sim/` is a pure, deterministic simulation**: no DOM, no `Date`, no `Math.random`, no
   timers, no transcendental `Math` functions or `**` (they differ between engines; `+ - * /` and
   `Math.sqrt` are exact). Enforced by `tsconfig.sim.json` and ESLint. It imports nothing outside
   `src/sim`: a server runs it on its own (ADR 0001). Its public API is `src/sim/index.ts`, bound to
   this build's roster (`verifySeries(raw)`, `createWorld(seed, a, b)`); `src/api` and `src/server`
   import only that file, the client never imports `src/server` (ESLint, ADR 0052).
2. **Fixed timestep**: ticks of exactly `DT = 1 / 60` s. Same inputs + same seed = identical result.
3. **Randomness only from the seeded PRNG** (`src/sim/rng.ts`), its state in
   `WorldState.rngState`.
4. **`src/render/` only reads sim state and draws it.** Transient effects are driven by sim events
   and kept in the render layer (`src/render/effects.ts`). `src/ui/` (the plain-DOM HUD) is
   read-only too.
5. **`src/main.ts` wires it together**; the match on screen and its frame loop are `src/arena.ts`.
   Browser helpers that are neither sim nor rendering live in `src/app/` as small pure functions
   with tests (history is `src/app/navigation.ts`, tested with a fake history). Each screen's
   wiring has its own module in `src/screens/` (the series' `series-setup.ts` and `series-play.ts`
   joined in `series.ts`); a new screen gets its own module there, a route in `src/app/route.ts` (ADR 0020) and a test for its link.
6. **Balls are data**: one file per ball in `src/sim/balls/`, made with `defineBall` and listed in
   `src/sim/balls/index.ts`. Runtime state (`BallState`) is separate from the definition.
7. **Abilities are hooks that return actions** (ADR 0003): hooks (`onTick`, `onWallHit`, `onHitBall`,
   `onDamageDealt`, `onDamageTaken`, `onKnockedOut`) get a read-only context and never
   mutate or use `Math.random` (use `ctx.random()`). A ball's ability state is
   `type XState = Readonly<{ ... }>`. A new action kind goes in the `AbilityAction` union and the
   exhaustive switch in `src/sim/abilities/apply-actions.ts`.
8. **`step(world, definitions)` returns `{ world, events }`** and never mutates its input. Events
   are output only; anything the sim must remember lives in `WorldState`. A finished match is
   returned unchanged.
9. **Battle feel bends presentation time, never sim time** (ADR 0007): hit-stop, slow-mo and the
   intro change when ticks run, not which. Effects respect `prefers-reduced-motion`.

## Workflow

Work on a branch and open a pull request; never commit to `main`. Once every CI check passes (the
CI jobs and Netlify's deploy preview; Netlify's header, pages-changed and redirect checks are
informational), merge it yourself with a merge commit (no squash) and delete the branch. Never
merge a red pull request: fix it on the branch. GitHub enforces part of this: the ruleset "main:
CI must pass" requires a pull request (no reviews), merge commits only, and every CI job that runs
on a pull request (the 11 jobs by name, from GitHub Actions); so `gh pr merge --auto --merge
--delete-branch` waits for them. Netlify's preview is not required by it: check it yourself. When
a CI job is added or renamed, update the ruleset's list in the same pull request (repository
Settings → Rules → Rulesets), or merges wait forever for a check that never reports. `release` is
not covered, so Publish still moves it.

Merging doesn't publish. Production is the `release` branch (Netlify's Free plan charges 15 of 300
monthly credits per production deploy, ADR 0052): publish a batch of merges with the Publish
workflow (`gh workflow run publish.yml`), which fast-forwards `release` to a `main` commit whose CI
passed, after applying its migrations to production (ADR 0068). Publish only when the user asks.

## Conventions

Each line is a rule; its ADR has the reasoning.

**Rulesets and series**

- Bump `RULESET_VERSION` (`src/sim/ruleset.ts`) in the same commit as anything that can change a
  fight, a bot's choice or a series: stats, abilities, combat rules, counter-map sides, the roster
  or its order, seeds and salts. Add the new fingerprint to `ruleset.test.ts` (never edit an old
  one), then `pnpm golden`, `pnpm ruleset:freeze` and, after the bump, `pnpm balance:summary`
  and `pnpm balance:matrix` (ADR 0022, 0023, 0052; tests check both name the current ruleset). A series records
  its ruleset and is verified by that ruleset's frozen bundle.
- `verifySeries` (`src/sim/series-verify.ts`) alone decides whether a series is valid: `playSeries`,
  the route, a saved series after a reload and a future server all use it; no second check.
  Series data from outside is read only by `decodeSeriesSetup` (`src/sim/series-decode.ts`),
  which `verifySeries` runs first; it takes `unknown` and never throws.
- A series' length is `SeriesSetup.bestOf` (absent is 3, `mode=bo5` in a link), never a constant
  (ADR 0048).
- Rules read a series' seeds only through `src/sim/series-seeds.ts` (`roundSeedOf`,
  `firstToShowOf`, `botSeedOf`): a local series and a link derive them from `seed`, a server
  series names them in `SeriesSetup.seeds`, secret until each lock (ADR 0051, 0052). The server
  derives them with `src/server/seeds.ts` and players check them with `src/api/fairness.ts`.

**The server (ADR 0052)**

- `src/server` imports only types from `src/sim` (ESLint): a series is played and verified only by
  its ruleset's frozen bundle (`rulesetSim`, `rulesets/r<N>/sim.mjs`). A missing bundle is
  `ruleset_missing`, never a fallback. `src/server/current-ruleset.ts` is bumped with
  `RULESET_VERSION` (a test checks).
- Deleting players never waits on the vs Friend switch (ADR 0078): with it off, only Forget me
  (`DELETE /me`) and the sweep answer (`alsoWhileOff`); every build offers Forget me, its one
  request the only API path a build without online play may hold (`check-bundle.ts`).
- Every route authenticates through `sessionOf` and starts with `guard` (method and CSRF). Routes
  are thin; rules live in services, SQL in `src/server/db/`. Times in rules are the database's
  `now()`. What a player may see of a series is decided by `viewOf` alone.
- Database tests (`*.db.test.ts`) call handlers through `TestBrowser`; two requests at once use
  `elsewhere(...)` with a second `testDeps()`, since one connection would queue them.
- Queries on one connection go one at a time, never in `Promise.all`: Supabase's pooler
  (transaction mode) never answers two pipelined queries, so the request hangs. The API, the
  database tests and `netlify dev` connect through the local pooler, as on Netlify.
- Migrations are never applied by hand (ADR 0068): Migrate staging applies them on every push to
  `main`, and a pull request whose preview needs its migration first runs
  `gh workflow run migrate-staging.yml -f ref=<branch>` before merging (every deploy preview and
  `main` use staging); Publish applies them to production before `release` moves, or publishes
  nothing. Expand only. An applied migration is never edited: a change is a new migration, pinned
  in `scripts/supabase-tools.test.ts`.
- The two hosted projects (`scripts/supabase-projects.ts`) are checked daily
  (`supabase-daily.yml`: awake, IP forwarding works). The workflows' `SUPABASE_ACCESS_TOKEN` (the
  `supabase` environment, `main` only) expires 2027-11-17.
- What the server stores, for how long, and who handles it is written in `privacy.html` (ADR
  0069; `scripts/legal-pages.test.ts` reads it against the constants). A change to any of them changes the
  policy, and its date, in the same pull request.
- The client tells failures apart (`callApi`, `failureKindOf`): "You're offline" only when the
  device is offline or no response came; a timeout, a server error and a refusal each say so
  with Try again (`online-failure-text.ts`).

**Accounts (ADR 0079)**

- Behind `BALLBATTLE_ACCOUNTS` (functions) and `VITE_ACCOUNTS` (`ACCOUNTS_BUILD`): on in previews
  and staging, off in production until friends ship (`friend-switch.ts --accounts`). Off, every
  `/api/v1/auth/*` answers `accounts_off`; guests are unchanged.
- Rules read `profiles.account_at` (`Session.account`), never a token's `is_anonymous`. A guest
  links to the same user id; an existing account is "Switch to it?", which deletes the guest.
- No sign-in starts or finishes during a live match or lobby (`whileNotLive`, `in_a_match`).
- Sign-in steps live in sealed `__Host-` cookies (`sealed-cookie.ts`, 10 minutes); Google's state
  is also marked used in the database. Google runs only where its client is set (exact redirect
  URIs: local and staging, never previews).
- Usernames are checked on the server only (`username-rules.ts`, our own blocklist); the name
  shown is `coalesce(username, display_name)`. One change per 30 days by `now()`; no free-name
  check, every try is counted. `/health` reports sign-in's settings as `accounts`, never a 503.
- Email codes are counted before Auth is called (`LIMITS.codes*`, `spendAll`): the player's own
  limits first, then everyone's caps (90 a day, 2,700 a month), which answer `email_busy` alike.
  An email answer never says whether an address has an account.

**Live friend matches (ADR 0053)**

- A live series is a series by turns with a clock: timers in `src/api/live.ts` (30 s a pick, 6 s to
  Fight!: Get ready, then the whole 3-2-1, ADR 0054; away after 6 s, 30 s grace, 60 s to arrive),
  every time the database's. A Reveal match's first pick opens 6.5 s after the start, after the
  coin toss both phones play together from the server's time (ADR 0061). A phone that learns of a round too late for the whole 3-2-1 says Get
  ready until Fight!, never a count joined part-way (`countdownLine`). What the clock
  decided (the start, a random pick as of its deadline, a forfeit) is settled on read, on a pick and
  in the sweep, earliest first (`live-service.ts`); never on a host's clock.
- Presence is `game.presence` (per series and side), written by the player's own read of the
  series in the same statement; `/me/match` (home) is never a heartbeat.
- While a live fight plays, a read that changes nothing is the heartbeat only: no layout, no
  arena redraw, no re-staging (`online-play.browser.test.ts`). Per-frame DOM writes go through
  `setText`, `setHidden` and `setAttr` (`src/ui/dom.ts`), which write only a change.
- The server times each round's fight (`fight_at`, `ends_at`) with `attemptWatchMs`, which must stay
  longer than the page's own presentation (`live-watch.test.ts`); picks before `ends_at` are
  refused. The page starts each fight with a timer for its server time (`online-live.ts`), plays
  it at 1x, and shows nothing of a round before its `ends_at`.
- One live match or waiting lobby per player (`in_a_match`), held by a per-player advisory lock.
  Live is Reveal and Showdown only. Play by turns stays in the code and its tests, hidden.
- A rematch reaches the other player anywhere (ADR 0070, `rematch-watch.ts`): a floating card on
  any screen but over a fight, Accept straight to the lineup, the asker told of a no.
- A rematch (ADR 0055) is a row in `game.rematches` (`src/server/rematch.ts`): asked within 2
  minutes of a live match's end, answered within 30 s, both lineups within 60 s, then a new live
  series (new seeds). Its timers are read against `now()`, never written; every move locks the old
  series' row in a statement of its own before reading.

**The sim**

- Sim types are `readonly`. The order within a tick is documented on `step` (`src/sim/step.ts`);
  keep it, and its event order, when adding a phase. Every hook in a phase sees the same snapshot.
- Status effects (ADR 0009) come only from `applyStatus` or a zone's `status`, refresh rather than
  stack and expire at the start of their expiry tick; a new kind extends `StatusKind`. A ball that
  shrugs one off declares `statusResistance` (ADR 0016).
- Each ball keeps its own speed: the tick rescales every live ball to its cruise speed. An ability
  that changes speed declares `cruiseSpeed(state, stats)`, never sets velocity in hooks (ADR 0008).
- Turning another ball is the `steer` action (ADR 0026); passing through is `phasedOf(self)`
  (nothing touches it, but it is still aimed at and pulled, ADR 0049); summoned objects are minions
  (`src/sim/minions/`); aimed attacks pick with `nearestTarget`, which includes enemy minions and
  aims at a ball's `decoyOf` point (the Mirage's copy) through the hook context's `aimPointOf`
  (ADR 0077).
- Taking less of a hit is `incomingDamageOf(self, amount, tick)`, applied on both damage paths and
  shown by `hitReduced` (ADR 0045, 0047, 0049); it may also take more (the Balloon's shots, a
  damage event's `raised`), and an `unblockable` damage action skips it (the Banshee's wail, ADR
  0075). A held ball (the Kraken's `held` status) cruises at `HELD_SHARE`. Hitting harder is
  `contactDamageOf(self, stats)`, never a `damage` action on hit (ADR 0015); by how head-on it hit
  is `bumpTimesOf(directness)` (the Jouster's lance, a damage event's `times`, ADR 0077). A returning projectile
  uses `returnAfterTicks`; a zone an enemy can set off declares a swept `trigger` (ADR 0043).
- Every ball uses `STANDARD_BALL_RADIUS`; the listed exceptions go through `radiusOf`: the Titan
  grows, the Slime's halves are smaller (ADR 0008, 0034, 0060).
- A side can be more than one ball (a Slime's halves, ADR 0059): enemy checks read `sideOf`
  (`src/sim/side.ts`), never ball ids, and the client shows a side as one (`sideHealth`).
- The pass-through property (`pass-through.slow.test.ts`, closing speed below 0.6 of the
  detection limit) must not be loosened; past it, implement swept ball-to-ball collision.
- Sim tests share `src/sim/test-support.ts` (`run`, `withBalls`, `deepFreeze`, the ability-free
  fixture balls `red` and `blue`); test-only balls with hooks are declared in the test.
- World coordinates are world units (`ARENA_SIZE` = 1000), never pixels.

**Balance and counters**

- The targets are in `scripts/balance.ts` (`TARGETS`) and `scripts/counter-map.ts`, checked by `pnpm balance` (ADR 0045 group 4):
  every ball 45-55% overall, no matchup worse than 22/78, draws under 5%, median match 12-30 s,
  ±5% health moving win rates at most 15 (warn) / 20 (fail) points, Vampire healing ≥ 25% of max
  health, comebacks 10-20%, every pair inside its counter-map band, at most 6 strong wins and 6
  strong losses per ball, and 2+ of each for every ball added after ruleset 22 (`STRONG_LIMITS`,
  ADR 0076; no ball is allowed over by name since ruleset 23, ADR 0077).
- Three levels (ADR 0073), one rule from the full run: 65% or more is a strong counter (▲▲, pass
  68-75%, fail over 78%), 58% up to 65% an edge (▲, pass 59-64%), under 58% even (pass with no side
  over 55%). Each favoured map entry names its `level`; a pair outside its band is mislabelled
  (no grey zone, no NEAR in a full run; CI's 150 seeds keep a NEAR allowance). Inside the band but
  off its aim is a WARN. A full run counts the measured strong counters, CI's the map's.
- Shape, a warning (ADR 0076): every ball aims for 2-4 strong counters each way, the counts within
  1 (a fifth where one visible mechanic gives it, `FIFTH_FROM_ONE_MECHANIC`), edges not counted,
  except the even pick (`EVEN_PICKS`: the Brawler, beating nobody and losing only to Thorns, ADR
  0013, 0049). Balls off it are listed by the run, never excused by name (`docs/vision.md` has why).
- The bots read the levels (Normal ranks by them, Hard plays 70 / 60 / 50 / 40 / 30%). An older
  ruleset whose fights are today's (`SAME_FIGHTS_AS`) keeps its bots (`botFor(opponent, ruleset)`)
  so its series still verify; the first ruleset that changes a fight empties it (ADR 0073).
- Counters come from mechanics (ADR 0010): a new ball adds an entry with a mechanical reason for
  every pair (`src/sim/counter-map-*.ts`); measure what its mechanic moves before choosing its
  counters. Stats tune how strong a counter is, never whether it
  exists; a planned counter that never appears is replaced, not forced (ADR 0015). Identity rules
  are pinned in `identity.test.ts` and `ability-share.slow.test.ts`; breaking one is a design
  decision. Longer fights make matchups steeper (ADR 0004).
- No interaction rules (ADR 0045): every ability does one clear thing on any ball, and no rule
  exists only where two abilities meet. A counter must be guessable by watching.

**Tests**

- Tests sit next to the code as `*.test.ts`. A behaviour test is shown to fail with the behaviour
  disabled before it is trusted.
- A new screen state or format must pass `no-dead-end.test.ts` (ADR 0027); a new screen gets a key
  in `screenKeyOf` and a flow in `history-rules.test.ts` (ADR 0025).

**UI**

- Phone first (about 375 px), then a deliberate layout for larger screens (ADR 0020, 0031):
  re-arranged for the space, never the phone column centred. Desktop rules go in the one query
  `(min-width: 64rem) and (min-aspect-ratio: 5/4)` beside the phone rules. Between them, any
  landscape screen (a phone turned sideways) is the beside layout, `(min-aspect-ratio: 5/4)`
  verbatim: the court at full height, the panel beside it (ADR 0067, `layout-queries.test.ts`). Prefer the page scrolling to inner scroll boxes; keep sensible maximum widths (`--sheet-width`). Check every screen at 375×812, 1280×800, 1440×900 and
  1920×1080.
- The arena shows only when something fights; setup and reading screens take the whole phone
  screen and show no arena on a desktop, and start at the top; only the panel beside a match
  centres (ADR 0020, 0025, 0031, 0039).
- The phone arena is the screen (ADR 0039): the court as wide as the page allows; mid-fight the
  court, both health bars and speed fit with no scroll, also at 390 × 664. Anything opened
  mid-fight scrolls the page, never squeezes the court; measure a new part under the court against
  `phone-arena-flow.ts`. Respect the safe areas.
- No dead ends (ADR 0027): every screen state offers a way forward; a series screen renders only
  the actions of `seriesScreenOf`.
- Teach in the arena, once (ADR 0036): read from sim events (`ability.shownBy`, a damage event's
  `via`), shown once per device (`src/app/tips.ts`), switchable in settings. A ball with an ability
  to point at names it and its event. A `howItWorks` definition shows a folded "How it works" on
  its manual page, written from the ability's constants (ADR 0049).
- Show less by default (ADR 0025): information on a tap, a `<details>` or a "more" link; symbols
  over sentences where clear. Every symbol is understood without explanation or explained once in
  the legend (`symbol-legend.ts`), has words in its accessible name, comes from
  `src/ui/balls/marks.ts`, is named with `markSymbol`, and its meaning lives in `src/ui/symbols.ts`.
  A matchup mark names both balls and who has the edge (`matchupTip`); one a phone player must read
  is its own 44 px target beside the control; nothing relies on press-and-hold (ADR 0037).
- One look per screen state (ADR 0038, 0044): a part several screens show is one component
  (`match-story.ts`, the pick banner and rows, the series bar, `balls/pairing.ts`, the ready card
  centred on the court); `one-of-each.test.ts` fails on a copy, `look-checks.ts` on a context rule
  that restyles a shared part, and `src/flows/consistency-flow.ts` checks the legends at four sizes.
  The legend and settings are one info panel (`info-panel.css`, `.panel-close`). Escape only ever
  closes things.
- Home by opponent (ADR 0055): Play remembers only bot games (`PlaySetup`, saved by the vs Bot
  setup's Choose lineup) and opens that lineup in one tap; the opponent cards are data in
  `HOME_CARDS` (Ranked and Casual join later as a 2 × 2 grid); every setup is the one
  `rules-step.ts` screen, and its choices rewrite its own entry. A lineup's in-app Back without
  history goes to its setup. `?mode=bo3` links open the vs Bot setup; `?view=modes` opens home; a
  lineup URL's format is its own (none is Blind). The 16+ question comes first in the vs Friend
  flow, on a device without a guest. While a series is held (`held()`), home's Play is Resume
  series and New series forgets it (`forget()`).
- Settings (ADR 0040, 0044): one menu (`settings-menu.ts`) behind exactly one gear per screen, at
  the top right before any `?`. It floats by its gear, never moves the layout, closes on the gear,
  Close, Escape or a tap outside (focus back on the gear), keeps off the court where it can (else
  the arena holds an offline match until it closes; a live match never waits, so there it scrolls
  inside the room beside the court, ADR 0054), and holds only real per-device choices.
- Back follows one rule (ADR 0025, `src/app/history-rules.ts`): move with `navigation.go`, never by
  choosing push or replace. Leaving an undecided series holds it; Back never drops it.
- A series survives a reload (ADR 0042): the controller saves after every change through `keep`
  (`src/app/series-save.ts`, `localStorage`, never the URL); `restoreSeries` trusts a save only if
  `verifySeries` accepts it. Leave series and New series clear it; Back holds it; a fight under way
  restarts from its Fight! moment. Browser flows that reload use a frame
  (`src/flows/reload-support.ts`).
- A button that waits on the server is busy through `busyOnClick` / `holdBusy`
  (`src/ui/busy-button.ts`): a handler that returns a promise is a request. Never a second
  spinner or a disabled button for it. A button that moves to another online screen stays busy
  until that screen is read (`online-prime.ts`); no "Loading…" page between screens. A screen
  that loads on its own (a cold link, a reload) shows its skeleton (`skeleton.ts`, ADR 0054).
- A tap shows on what it presses (ADR 0070, `press.ts`): a finger marks the control
  `data-pressed`, styled exactly as its hover, and every hover sits in `(hover: hover)`
  (`press.test.ts`).
- A chosen option has one look (`choice.css`, ADR 0054): a control marks its options `.choice`
  and the chosen one with `aria-pressed` or `aria-checked`; no other stylesheet draws a chosen
  state (`choice.test.ts`).
- Colours, sizes and type come from roles in `src/styles/tokens.css`; renderer colours and sizes
  from `src/render/theme.ts`. The look is Sticker Pop (ADR 0032): one self-hosted family (Bricolage Grotesque, CSP `font-src 'self'`), calm
  platform screens, the energy in the arena. Every ball keeps 3:1 against the floor; text in a
  ball's colour goes through `readableOn` (4.5:1, `arena-contrast.test.ts`). A component's
  stylesheet sits beside it and is imported in `src/style.css` in cascade order (create the file
  before its `@import`).
- Ball and matchup text is read from the definitions and the counter map
  (`src/ui/balls/matchups.ts`, ADR 0024); it says "favoured", never a measured win rate.

**Sound (ADR 0064)**

- Sound is made in code (`src/sound/`), read from the arena's ticks like the effects: never from
  the sim, which never knows it exists. Fight sounds are made after their frame, never in it.
- A ball's ability has sounds of its own that say what kind of hit it is (`ball-sounds.ts`); a new
  ball adds its cues to `cue-names.ts`, a voice, a cue rule and a gate rule (`rules.ts`), and the
  tests fail until each is heard in a real fight and unlike every other ball's.
- Keep the style: sines and soft triangles on C major pentatonic (`voices/scale.ts`), square and
  sawtooth only through a low-pass, nothing but the series result over a second.
- Every control sounds once per tap (ADR 0070): key moments `tap` (`data-sound="tap"`), Back and
  Close `back`, a control with its own sound `own`, every other a soft `press`; walls are silent; the home demo is silent; a live
  fight caught up headlessly is silent.

**Code**

- Keep files under 300 lines (ESLint `max-lines`); split by responsibility first.
- Conventional Commits, small and single-purpose; the body explains why. Significant decisions
  become numbered ADRs in `docs/decisions/` (and a row in its README).
- Stop any dev server or background process you started, and check its port is free (the `vite`
  child can outlive `pnpm dev`).
