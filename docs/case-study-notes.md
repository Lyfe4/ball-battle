# Case study notes

Raw material for a write-up of BallBattle. Facts only, each checked against the repo on
2026-11-06 (ruleset 4, 14 balls). Links point to where each fact is recorded.

## The project in one paragraph

BallBattle is a browser auto-battler. You pick balls, set their order, and watch them fight: balls
with different abilities bounce around a square arena until one wins. Nothing is controlled once a
fight starts, so all the skill is in picking. It is a portfolio piece, so code quality was treated
as part of the product. Live at https://battle-ball.netlify.app/.

## Goal and constraints

- **Goal:** a game you watch rather than steer, where picks matter but no fight is decided before
  it starts. The longer-term direction is asynchronous player vs player: blind lineups, best of 3,
  and soft counters, with a server that re-simulates results to verify them
  ([vision](vision.md)).
- **Constraints chosen up front** (from day one, [CLAUDE.md](../CLAUDE.md)):
  - TypeScript strict, Vite, plain Canvas 2D and plain DOM.
  - No game engine, no physics library, no UI framework.
  - A pure, deterministic simulation that is kept apart from rendering.
  - Every significant decision recorded as a numbered ADR.
- **Platform:** phone first, then a deliberate desktop layout. A static site on Netlify with a
  strict CSP: no third-party scripts or fonts, and one runtime dependency (the self-hosted font).

## Timeline

- First commit 2026-11-01. Latest at time of writing 2026-11-06.
- 270 commits on `main` and 8 merged pull requests. At least 257 commit subjects follow Conventional Commits.
- 33 ADRs in [docs/decisions](decisions/).

Rough arc, by ADR:

1. Deterministic sim, combat core and ability system (0001-0003).
2. Projectiles, zones, statuses and the first counters (0004-0012).
3. Counter-making balls and rules (0013-0016).
4. Best of 3 and draft formats (0017-0021).
5. Ruleset versioning and cross-engine golden results (0022-0023).
6. Screens, "show less" and Back (0020, 0024-0025).
7. Batch 3 balls (0026).
8. Phone fixes, the counter pass, the coin toss and tooltips (0027-0030).
9. Desktop layouts and the Sticker Pop restyle (0031-0033).

## Key decisions and why

- **The sim is a pure function of seed and inputs**
  ([ADR 0001](decisions/0001-deterministic-simulation.md)). Fixed 60 Hz ticks, a seeded mulberry32
  PRNG stored in the world, no DOM or timers. ESLint bans `Math.sin`, `cos`, `atan2`, `pow`, `exp`,
  `log` and the `**` operator, because their results can differ between JS engines; `+ - * /` and
  `Math.sqrt` are exact under IEEE 754. Why: a link can replay a fight exactly, tests can play
  thousands of matches headlessly, and a server can verify a result.
- **Abilities are hooks that return plain-data actions**
  ([ADR 0003](decisions/0003-ability-system.md)). Hooks never mutate; `step` applies the actions in
  a documented order. New effects (projectiles, zones, statuses, steering, minions) were added as
  new action kinds without touching existing balls.
- **Uniform size, and damage from how directly a ball hits, not how fast**
  ([ADR 0008](decisions/0008-size-directness-cruise-speed.md)). Radius had quietly been mass,
  target size and arena share at once, and collision speed had been damage. Making every ball the
  same size, with a cruise speed it keeps, made each stat do one thing.
- **Counters come from mechanics, not stats** ([ADR 0010](decisions/0010-counter-map.md)). Every
  pair's intended result is data with a written mechanical reason, checked by `pnpm balance`. The
  Brawler is the one designed "safe pick": even against all but Thorns, its one designed counter
  ([ADR 0013](decisions/0013-thorns-brawler-counter.md)).
- **Interaction rules are capped and visible**
  ([ADR 0016](decisions/0016-counter-density.md), [ADR 0028](decisions/0028-counter-pass.md)).
  About one rule per ball. Each is a general rule about a kind of ball ("a shocked ball heals
  less"), and each shows a spark on screen the moment it acts. Today there are three.
- **Ruleset versioning**
  ([ADR 0022](decisions/0022-ruleset-version-and-verified-series.md)). Every replay link records
  `v=`. A behaviour fingerprint test (every pair played, the bot asked every choice, a series in
  every format) fails until the version is bumped. Old links show a notice instead of silently
  replaying a different fight. One function, `verifySeries`, decides whether a series is valid, for
  the browser and a future server alike.
- **Known results checked in every engine**
  ([ADR 0023](decisions/0023-known-match-results-across-engines.md)). 210 recorded matches must
  come out bit-identical in Node, Chromium, Firefox and WebKit on every push.
- **Battle feel bends presentation time, never sim time**
  ([ADR 0007](decisions/0007-presentation-clock.md)). Hit-stop, slow-mo and the intro change when
  ticks run, never which ticks run. Motion is interpolated between ticks, so it stays smooth at
  90 and 120 Hz.
- **Screens: phone first, show less, no dead ends, one rule for Back** (ADR 0020, 0025, 0027,
  0031). Each is a standing rule in CLAUDE.md with a test behind it. For example,
  `no-dead-end.test.ts` walks every format, outcome order and pick.

## Things that didn't work, and what we learned

- **Stats can't create counters.** Two rounds of searching found no stat fit for the first counter
  map: 26 single-lever changes, 20 combinations, and a linear model over all 12 placements of the
  Storm. Every stat moves all of a ball's matchups together. The fix was a pair-specific mechanic
  (shocked balls heal less), which moved Storm vs Vampire from 54.5% to 63.2% and left every other
  pair unchanged ([ADR 0010 §3](decisions/0010-counter-map.md)).
- **Aiming the launch was measured, then removed**
  ([measurements](aiming-measurements.md), [ADR 0018](decisions/0018-aimed-start.md)). One side's
  best angle gained a median of only +1.7 points. Only 20 of 121 matchups gained 5 or more.
  Solved play broke 8 counter pairs and the 25/75 limit (Speedster vs Archer 81.0 / 18.6). Lesson:
  a single input at tick 0 is washed out by an 18-second fight, and what remained was a second
  blind guess, not a skill.
- **Bigger balls were measured, then rejected** ([write-up](bigger-balls-experiment.md)). At
  radius 65, 28 of 55 counter pairs left their bands, the Archer fell to 35.7% and the 25/75 limit
  broke; at 80 there were 37 misses and the median match fell to 11.8 s. Aiming was not rescued
  either. Lesson: the cheaper lever for phone readability is in the renderer, not the sim.
- **Reveal-then-order gave the player's order no value against the bot**
  ([ADR 0019 addendum](decisions/0019-draft-formats.md)). It was redesigned as taking turns showing
  first ([ADR 0021](decisions/0021-reveal-take-turns.md)), then a coin toss decided who shows
  first ([ADR 0029](decisions/0029-reveal-coin-toss.md)). Measured: good play is worth about 12.5
  points of series chance over bad play ([measurements](reveal-measurements.md)).
- **Planned counters that the data didn't support were replaced, not forced**
  ([ADR 0015](decisions/0015-berserker-sniper-quake.md),
  [ADR 0026](decisions/0026-magnet-ghost-necromancer.md)).
  - Ghost over Berserker never appeared; Ghost over Speedster did.
  - Quake over Frost reversed.
  - The Magnet's first, one-sided pull handed its enemy head-on hits, and it won 14% overall. The
    pull became mutual.
- **Invisible rules were removed** ([ADR 0028](decisions/0028-counter-pass.md)). "Rage can't be
  slowed" and "the cold shortens poison" showed only as an absence, so a viewer couldn't see why a
  fight went the way it did. They went.
- **A check that always fails gets ignored** ([ADR 0028 addendum](decisions/0028-counter-pass.md)).
  After raising the favoured band to 62-72%, 14 pairs missed and `pnpm balance` failed on every
  run. Each band now has a target and a floor: below target is a visible warning, and only outside
  the floor fails. The distance to the target is listed in
  [balance-summary.md](balance-summary.md) (33 pairs at ruleset 4).
- **Rejected tuning, with numbers** ([ADR 0028](decisions/0028-counter-pass.md)):
  - two Necromancer minions at once took Necromancer vs Archer to 80-94%;
  - 25% more health for every ball steepened the leans that already existed, not the counters.

## Workflow

- **Roles.** Calvin directed the design and reviewed the work: what each ball should do, the
  counters wanted, the standing rules, and the look. Implementation was AI-assisted with Claude
  Code. 262 commits carry a `Co-Authored-By: Claude` trailer.
- **Plans before code.** Larger work (each batch of balls, the counter pass, the screens) started
  as a plan that was reviewed before building. The plan's guesses were then measured,
  and the ADRs record where the build deviated from the plan and why.
- **Standing rules in [CLAUDE.md](../CLAUDE.md).** Architecture rules, conventions, balance
  targets, the UI rules (phone first, show less, no dead ends, Back), and the workflow itself:
  branch, pull request, merge only when every CI check passes.
- **Tests as the contract.** A behaviour test should be shown to fail with the behaviour disabled
  before it is trusted (a CLAUDE.md rule). Golden results, the ruleset fingerprint and the balance
  bands make regressions loud.
- **Independent audits.** A read-only audit of `main` found gaps that later became ADRs: links
  without a ruleset version (ADR 0022), single-engine determinism (ADR 0023), a slow test file
  (ADR 0011 addendum) and dead code (ADR 0018 addendum).
- **Local gates.** Husky and lint-staged run ESLint and Prettier on every commit.

## Hard numbers

| What                   | Number                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Balls                  | 14                                                                                             |
| Unit tests             | 664 tests in 92 files, about 4-7 s                                                             |
| Slow roster tests      | 11 tests in 4 files (determinism, pass-through margin, measured identity rules, minion cap)    |
| Browser tests          | 30 tests in 24 files, in Chromium, Firefox and WebKit through Vitest's Playwright provider     |
| Known match results    | 210, bit-identical in Node, Chromium, Firefox and WebKit                                       |
| CI jobs                | 4: lint/typecheck/unit/build, slow tests, balance check (150 seeds), browsers                  |
| Balance run            | every ordered pair, 500 seeds per slot order by default, on all CPU cores                      |
| Overall win rates      | every ball 47.1-53.0% (target 40-60%)                                                          |
| Draws, fight length    | draws 0.6% (target under 5%); median fight 18.0 s (target 12-30 s)                             |
| Counter bands          | favoured 62-72% (floor 58%); even 45-55% (floor 42-58%); no side worse than 25/75              |
| Interaction rules      | 3, each with an on-screen cue                                                                  |
| Ruleset versions       | 4                                                                                              |
| Production bundle      | 141.20 kB JS (46.90 kB gzipped), 31.92 kB CSS (6.34 kB gzipped), 41.34 kB font (Latin subset)  |
| First version baseline | 5.05 kB JS (2.41 kB gzipped)                                                                   |
| Runtime dependencies   | 1 (the self-hosted Bricolage Grotesque font)                                                   |
| TypeScript             | about 17,100 lines outside tests, 10,400 in tests (`src` and `scripts`)                        |
| Frame cost (ADR 0028)  | median 0.6-0.9 ms, no frame over 16.7 ms, at 60, 90 and 120 Hz on a 4x-throttled phone profile |

Sources: `pnpm test`, `pnpm test:slow`, `pnpm test:browsers` and `pnpm build` run on 2026-11-06;
`src/golden/golden-matches.json`; `.github/workflows/ci.yml`;
[balance-summary.md](balance-summary.md) and [ADR 0028](decisions/0028-counter-pass.md) for the
balance figures.
