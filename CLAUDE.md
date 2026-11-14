# BallBattle

Browser auto-battler: balls with different abilities bounce around a square arena with health
bars until one wins. No player control; you pick balls and watch. This is a portfolio piece, so
code quality matters as much as features.

Where it's heading (PvP best of 3 with blind lineups, soft counters, then a backend):
`docs/vision.md`. Built today: Best of 3 and Best of 5 against a bot (ADR 0017, 0048), three draft
formats (blind, reveal, showdown; ADR 0019, 0021, 0029, 0035) and three bot levels (ADR 0035).
Reveal is the main mode: home's Play opens its lineup in one tap, every other way to play is on
Other modes (ADR 0046, `src/app/modes.ts`). The series rules and bots are pure sim code
(`src/sim/series.ts`, `src/sim/bot.ts`), the same functions a server would run, so keep them
deterministic and DOM-free. Every decision is an ADR in `docs/decisions/` (indexed in its
README, with status); the last audit is `docs/audit-2026-11.md`.

Stack: TypeScript (strict), Vite, pnpm, Vitest, ESLint (flat config) + Prettier, Husky +
lint-staged, plain HTML Canvas 2D. No game engine, no physics library, no React.

## Commands

- `pnpm dev`: the dev server on http://localhost:5199. Dev only: `/styleguide.html` (every ball
  design in each ability state, large and at phone size, and the shared UI parts; `?only=ui`,
  `?only=phone-arena`) and `/brand.html` (icons and link-preview image drawn by the game's
  renderer; save each canvas as the `public/` file it names and commit it).
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
  0037), `iphone` 390 x 844 and `safari` 390 x 664 (ADR 0039). Never resize the viewport in a
  test. Browser tests never use a random seed: each file starts as a fresh device on a pinned
  seed (`src/flows/browser-setup.ts`, `fixed-seed.ts`; a flow pins its own with `pinSeed`), and
  every wait names what it waits for (`waitFor`, `until`). Locally, one engine at a time is what
  CI runs (`--project "browsers* (chromium)"`); all three at once can overload a machine. Needs
  `pnpm exec playwright install chromium firefox webkit` once.
- `pnpm lint`, `pnpm typecheck` (`tsc -b`), `pnpm format` / `pnpm format:check`.
- `pnpm balance [seeds] [--ball <id>] [--serial]`: every matchup (both slot orders) across all
  cores; prints the matrix, each ball's shape and whether the targets are met; exits 1 on any
  MISS. Run after any change to a ball's stats or ability or the combat rules; `--ball` plays one
  ball's matchups (a new ball), `--serial` one thread with byte-identical output. `pnpm balance:summary` also rewrites `docs/balance-summary.md` (commit it after such a change);
  `pnpm balance:ci` is CI's reduced run (150 seeds, map shape, ADR 0011 addendum).
- `pnpm golden`: rewrite `src/golden/golden-matches.json` after a `RULESET_VERSION` bump. It
  refuses otherwise: results that move without a bump are a bug.

CI runs format, lint, typecheck, unit tests and build in one job, `test:slow` and `balance:ci` in
their own, and the browser suite in two jobs per engine (phones, the rest). All must pass.

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
merge a red pull request: fix it on the branch.

Merging doesn't publish. Production is the `release` branch (Netlify's Free plan charges 15 of 300
monthly credits per production deploy, ADR 0052): publish a batch of merges with the Publish
workflow (`gh workflow run publish.yml`), which fast-forwards `release` to a `main` commit whose CI
passed. Publish only when the user asks.

## Conventions

Each line is a rule; its ADR has the reasoning.

**Rulesets and series**

- Bump `RULESET_VERSION` (`src/sim/ruleset.ts`) in the same commit as anything that can change a
  fight, a bot's choice or a series: stats, abilities, combat rules, counter-map sides, the roster
  or its order, seeds and salts. Add the new fingerprint to `ruleset.test.ts` (never edit an old
  one), then `pnpm golden` (ADR 0022, 0023).
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
  (`src/sim/minions/`); aimed attacks pick with `nearestTarget`, which includes enemy minions.
- Taking less of a hit is `incomingDamageOf(self, amount, tick)`, applied on both damage paths and
  shown by `hitReduced` (ADR 0045, 0047, 0049). Hitting harder is `contactDamageOf(self, stats)`,
  never a `damage` action on hit (ADR 0015). A returning projectile uses `returnAfterTicks`; a zone
  an enemy can set off declares a swept `trigger` (ADR 0043).
- Every ball uses `STANDARD_BALL_RADIUS`; the Titan, growing through `radiusOf`, is the one listed
  exception (ADR 0008, 0034).
- The pass-through property (`pass-through.slow.test.ts`, closing speed below 0.6 of the
  detection limit) must not be loosened; past it, implement swept ball-to-ball collision.
- Sim tests share `src/sim/test-support.ts` (`run`, `withBalls`, `deepFreeze`, the ability-free
  fixture balls `red` and `blue`); test-only balls with hooks are declared in the test.
- World coordinates are world units (`ARENA_SIZE` = 1000), never pixels.

**Balance and counters**

- The targets are in `scripts/balance.ts` (`TARGETS`) and `scripts/counter-map.ts`, checked by `pnpm balance` (ADR 0045 group 4):
  every ball 45-55% overall, no matchup worse than 22/78, draws under 5%, median match 12-30 s,
  ±5% health moving win rates at most 15 (warn) / 20 (fail) points, Vampire healing ≥ 25% of max
  health, comebacks 10-20%, every pair inside its counter-map band, every ball's shape.
- A counter (▲▼) wins 62% or more (target 65-72%); even is 45-55% with no side above 62% (58-62%
  is the grey zone, warned). Between target and floor is a WARN, within 2 points outside the floor
  NEAR (passes), further out a MISS. The map is labelled from the full run; a designed counter
  that measures under 62% is marked even. A full run judges the measured shape, CI's the map's.
- Shape: every ball 2-4 counters each way, the counts within 1, except the even picks
  (`EVEN_PICKS`: Brawler and Magnet, beating nobody and losing only to Thorns, ADR 0013, 0049) and
  the known gaps (`SHAPE_EXCEPTIONS`, each allowed exactly its gap today, `docs/vision.md`).
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
  `(min-width: 64rem) and (min-aspect-ratio: 5/4)` beside the phone rules. Prefer the page scrolling to inner scroll boxes; keep sensible maximum widths (`--sheet-width`). Check every screen at 375×812, 1280×800, 1440×900 and
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
- One tap to the main mode (ADR 0046, 0048): home's Play opens Reveal's lineup against the
  remembered bot level; every other mode is data in `OTHER_MODE_SECTIONS`; the series section
  remembers Best of 3 / 5. A lineup's in-app Back without history goes to `lineupParentOf`.
  `?mode=bo3` links open the rules step; a lineup URL's format is its own (none is Blind). While a
  series is held (`held()`), home's Play is Resume series and New series forgets it (`forget()`).
- Settings (ADR 0040, 0044): one menu (`settings-menu.ts`) behind exactly one gear per screen, at
  the top right before any `?`. It floats by its gear, never moves the layout, closes on the gear,
  Close, Escape or a tap outside (focus back on the gear), keeps off the court where it can (else
  the arena holds the match until it closes), and holds only real per-device choices.
- Back follows one rule (ADR 0025, `src/app/history-rules.ts`): move with `navigation.go`, never by
  choosing push or replace. Leaving an undecided series holds it; Back never drops it.
- A series survives a reload (ADR 0042): the controller saves after every change through `keep`
  (`src/app/series-save.ts`, `localStorage`, never the URL); `restoreSeries` trusts a save only if
  `verifySeries` accepts it. Leave series and New series clear it; Back holds it; a fight under way
  restarts from its Fight! moment. Browser flows that reload use a frame
  (`src/flows/reload-support.ts`).
- Colours, sizes and type come from roles in `src/styles/tokens.css`; renderer colours and sizes
  from `src/render/theme.ts`. The look is Sticker Pop (ADR 0032): one self-hosted family (Bricolage Grotesque, CSP `font-src 'self'`), calm
  platform screens, the energy in the arena. Every ball keeps 3:1 against the floor; text in a
  ball's colour goes through `readableOn` (4.5:1, `arena-contrast.test.ts`). A component's
  stylesheet sits beside it and is imported in `src/style.css` in cascade order (create the file
  before its `@import`).
- Ball and matchup text is read from the definitions and the counter map
  (`src/ui/balls/matchups.ts`, ADR 0024); it says "favoured", never a measured win rate.

**Code**

- Keep files under 300 lines (ESLint `max-lines`); split by responsibility first.
- Conventional Commits, small and single-purpose; the body explains why. Significant decisions
  become numbered ADRs in `docs/decisions/` (and a row in its README).
- Stop any dev server or background process you started, and check its port is free (the `vite`
  child can outlive `pnpm dev`).
