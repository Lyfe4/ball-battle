# BallBattle

Browser auto-battler: balls with different abilities bounce around a square arena with health
bars until one wins. No player control; you pick balls and watch. This is a portfolio piece, so
code quality matters as much as features.

Where it's heading (PvP best-of-3 with blind lineups, soft counters): `docs/vision.md`. Best of 3
against a bot is built (ADR 0017), with three draft formats (blind, reveal with turns showing
first, loser-picks-next; ADR 0019, 0021): the rules are pure sim code in `src/sim/series.ts`, the same functions
a server would run to verify a series, so keep them deterministic and DOM-free.

Stack: TypeScript (strict), Vite, pnpm, Vitest, ESLint (flat config) + Prettier, Husky +
lint-staged, plain HTML Canvas 2D. No game engine, no physics library, no React.

## Commands

- `pnpm dev`: start the Vite dev server on http://localhost:5199. `/styleguide.html` shows every
  ball design in each ability state, large and at phone size, and the shared UI parts (dev only,
  not in the build); `?only=ui` shows just the UI parts, `?only=phone-arena` the phone arena
- `pnpm build`: typecheck and build to `dist/`
- `pnpm preview`: serve `dist/` on http://localhost:4199 with the production security headers
  from `scripts/security-headers.ts` (Netlify serves the same set from `netlify.toml`; a test keeps
  them in step). Check the console for CSP errors after any change that loads something new.
- `pnpm test`: run the fast unit suite once (`pnpm test:watch` to watch)
- `pnpm test:slow`: the slow suite (`*.slow.test.ts`): roster-wide tests that play every matchup for
  whole matches (determinism, the measured pass-through margin, identity rules). Run it after
  changing any ball or the combat rules. Roster-wide tests that play whole matches go here.
- `pnpm lint`: ESLint
- `pnpm typecheck`: `tsc -b` over every tsconfig project
- `pnpm format` / `pnpm format:check`: Prettier
- `pnpm balance [seeds] [--ball <id>] [--serial]`: play every matchup (both slot orders, seeds
  0..N-1) headlessly across all CPU cores and print the matchup matrix and whether the balance
  targets are met. Run it after changing any ball's stats, ability or the combat rules.
  `--ball <id>` plays only that ball's matchups and mirror (for a new ball); `--serial` runs on one
  thread and gives byte-identical output. The elapsed time goes to stderr. Not part of CI.

CI runs `format:check`, `lint`, `typecheck`, `test` and `build` in one job and `test:slow` in
another. All must pass.

## Architecture rules

1. **`src/sim/` is a pure, deterministic simulation**: no DOM, no `Date`, no `Math.random`, no
   timers. Enforced by `tsconfig.sim.json` (no DOM lib, no ambient `@types`) and ESLint rules in
   `eslint.config.js` that also ban transcendental `Math` functions (`sin`, `cos`, `atan2`, `pow`,
   `exp`, `log`, ...) and the `**` operator, because their results can differ between JS engines.
   `+ - * /` and `Math.sqrt` are exact under IEEE 754 and safe. `src/sim` must not import from
   `src/render` or `src/main.ts`.
2. **Fixed timestep**: the simulation advances in ticks of exactly `DT = 1 / 60` seconds. Same
   inputs + same seed = identical result, bit for bit.
3. **Randomness only from the seeded PRNG** (mulberry32) in `src/sim/rng.ts`. Its state lives in
   `WorldState.rngState`, so a world snapshot fully determines the future.
4. **`src/render/` only reads sim state and draws it.** Rendering never mutates state. Transient
   effects (like the damage flash) are driven by sim events and kept in the render layer
   (`src/render/effects.ts`), never in `WorldState`. `src/ui/` is the plain-DOM HUD, under the
   same read-only rule.
5. **`src/main.ts` wires it together** with a `requestAnimationFrame` loop that uses an
   accumulator to run the fixed timestep independently of display refresh rate. Browser-side
   helpers that are not sim or rendering (the fixed-step clock, the presentation clock and frame
   driver, seed and matchup parsing, routes) live in `src/app/` as small pure functions with tests;
   keep `main.ts` to wiring. The match on screen and the frame loop are `src/arena.ts`; history is
   `src/app/navigation.ts` (given `window`, so it is tested with a fake history). Each screen's wiring has its own module: `home-controller.ts`,
   `quick-controller.ts`, `series-setup.ts` and `series-controller.ts` (joined in
   `series-screens.ts`), `manual-screen.ts`. A new screen gets its own module like them, a route in
   `src/app/route.ts` (ADR 0020) and a test for its link.
6. **Balls are data-driven definitions**, one file per ball in `src/sim/balls/`, created with
   `defineBall` and listed in `src/sim/balls/index.ts`. A `BallDefinition` is plain data plus
   optional hooks. Runtime state (`BallState`) is kept separate from the definition.
7. **Abilities are hooks that return actions** (ADR 0003). Hooks (`onTick`, `onWallHit`,
   `onHitBall`, `onDamageDealt`, `onDamageTaken`) get a read-only context and return `AbilityAction`s; `step`
   applies them. Hooks never mutate anything and never use `Math.random`: randomness comes from
   `ctx.random()`. A ball's own ability state is typed per definition and declared as
   `type XState = Readonly<{ ... }>` (an interface won't satisfy the serialisable index signature).
   New action kinds go in the `AbilityAction` union and the exhaustive switch in
   `src/sim/abilities/apply-actions.ts`.
8. **`step(world, definitions)` returns `{ world, events }`.** Definitions stay out of
   `WorldState` (they can hold functions); pass the same lookup every tick. Events are output
   only and never feed back into the sim: anything the sim must remember (health, contacts,
   match state) lives in `WorldState`. A finished match is returned unchanged with no events.
9. **Battle feel bends presentation time, never sim time** (ADR 0007). Hit-stop, slow-mo and the
   intro change when ticks run, never which ticks run. Effects run on effect time, are driven by
   sim events, and respect `prefers-reduced-motion`. `src/sim` must not change for feel work.

The reasoning is in `docs/decisions/0001-deterministic-simulation.md`,
`docs/decisions/0002-combat-core.md`, `docs/decisions/0003-ability-system.md`,
`docs/decisions/0004-wall-bounce-variance.md`, `docs/decisions/0005-projectiles.md`,
`docs/decisions/0006-hazard-zones.md`, `docs/decisions/0007-presentation-clock.md`,
`docs/decisions/0008-size-directness-cruise-speed.md`, `docs/decisions/0009-status-effects.md`,
`docs/decisions/0010-counter-map.md`, `docs/decisions/0011-roster-scaling.md`,
`docs/decisions/0012-slowed-poisoned-damage-taken.md`, `docs/decisions/0013-thorns-brawler-counter.md`,
`docs/decisions/0014-venom-thorns-counter.md`, `docs/decisions/0015-berserker-sniper-quake.md`,
`docs/decisions/0016-counter-density.md`, `docs/decisions/0017-best-of-3-series.md` and
`docs/decisions/0018-aimed-start.md` (the aimed start is measured in `docs/aiming-measurements.md`;
the game does not use it), `docs/decisions/0019-draft-formats.md`,
`docs/decisions/0020-screens.md` and `docs/decisions/0021-reveal-take-turns.md` (measured in
`docs/reveal-measurements.md`).

## Conventions

- `step` is pure: it returns a new `WorldState` and never mutates its input. Sim types are
  `readonly`.
- Within a tick: statuses due this tick expire (ADR 0009), onTick, move (with a seeded turn on wall
  bounces, ADR 0004), onWallHit, collide, contact damage (new contacts only, scaled by directness,
  ADR 0008), onHitBall, projectiles move and resolve (ADR 0005), zones due this tick strike and
  apply their status (ADR 0006, 0009), poison ticks (ADR 0012), onDamageDealt, onDamageTaken
  (ADR 0012; damage from its actions fires no further hooks), defeat, cruise speed (ADR 0008,
  reduced while slowed), match end. Events are emitted in that order. Every hook in a phase sees the
  same snapshot; actions are applied afterwards. The full order is documented on `step`.
- Status effects (ADR 0009) live on `BallState.statuses`, come only from the `applyStatus` action
  or a zone's `status`, refresh rather than stack, and expire at the start of their expiry tick.
  A new kind extends `StatusKind` in `src/sim/status.ts`. A ball that shrugs a status off declares
  `statusResistance` (the share of the duration it keeps, 0 for immune; ADR 0016) rather than
  checking for it in hooks.
- Every ball keeps its own speed: the tick ends by rescaling each live ball's velocity to its
  cruise speed, so collisions only change direction. An ability that changes how fast a ball goes
  declares `cruiseSpeed(state, stats)` on its definition instead of setting velocity in hooks.
- An ability that changes how hard a ball hits declares `contactDamageOf(self, stats)` (ADR 0015)
  rather than adding a `damage` action on hit: contact damage goes through directness, the
  lethal-exchange tiebreak and Thorns' reflection; an on-hit ability bonus skips all three.
- Every ball uses `STANDARD_BALL_RADIUS`; a different size is a design decision listed as an
  explicit exception in the roster's identity tests (ADR 0008).
- Sim tests share helpers from `src/sim/test-support.ts` (`run`, `withBalls`, `deepFreeze`) and
  its fixture balls `red` and `blue`, which have no abilities and fixed stats, so core tests don't
  change when real balls are rebalanced. Test-only balls with hooks are declared in the test.
- Balance targets (`pnpm balance`): every ball wins 40-60% overall, no matchup worse than 20/80 (soft counters are fine),
  draws under 5%, median match 12-30 s, win rates move at most 15 points (warning) or 20 points
  (failure) for ±5% max health, since the measurement has ±2-3 points of noise,
  Vampire heals at least 25% of max health per match, no matchup worse than 25/75, and every pair
  in its counter-map band (`scripts/counter-map.ts`: favoured side 58-70%, even 45-55%, within 2
  points outside a band passes as NEAR; ADR 0010). Re-check after any stat or ability change.
- Counters come from mechanics (ADR 0010): a new ball adds an entry for every pair (in the
  `src/sim/counter-map-*.ts` data file for its batch; the bands are checked in
  `scripts/counter-map.ts`), and each
  favoured or unfavoured matchup needs a mechanical reason in that entry. Stats tune how strong a
  counter is, never whether it exists. Measure what a ball's mechanic moves before choosing its
  counters; a planned counter that never appears is replaced, not forced with stats (ADR 0015). The Brawler is the only safe pick: even against all
  except Thorns, its one designed counter (ADR 0013).
  Ball identity rules are pinned in `src/sim/balls/roster.slow.test.ts`; breaking one is a design
  decision, not a tuning step. Longer fights make matchups steeper (ADR 0004).
- Interaction rules that exist to create a counter (one ball's effect meeting another ball's
  mechanic, like "poison numbs rage" or "rage can't be slowed", ADR 0016) are limited to about one
  per ball, and every such rule must be visible on screen (a status ring, a change in the ball's
  design, or similar), so a viewer can tell why a ball won or lost. Fill counter gaps with new
  balls rather than more rules. Today the Berserker, Frost and Venom are each in two such rules
  (ADR 0016); don't add a third to any of them.
- The pass-through property test in `src/sim/balls/roster.slow.test.ts` (closing speed below 0.6 of the
  `(rA + rB) / DT` detection limit) must not be loosened again. If a ball pushes past it, implement
  swept ball-to-ball collision instead.
- A behaviour test should be shown to fail with the behaviour disabled before it is trusted.
- World coordinates are in world units (`ARENA_SIZE` = 1000), never pixels. The renderer maps
  world units to the screen.
- Colours and sizes for the renderer come from `src/render/theme.ts`, not inline literals.
- **Phone first.** Every screen is designed for a phone (about 375 px wide) first: one clear job
  per screen and as few controls as possible. Desktop adapts from the phone design, never the
  other way round. Check every screen at 375×812 before calling it done. The arena shows only
  when something is fighting; setup and reading screens take the whole phone screen (ADR 0020).
- Page colours, sizes and type come from roles in `src/styles/tokens.css`, never palette names or
  literals. A component's stylesheet sits next to it and is listed in `src/style.css` in cascade
  order; create the file before adding its `@import` (the dev server caches a missing import).
- Ball and matchup text in the UI is read from the definitions and the counter map
  (`src/ui/balls/matchups.ts`); it says "favoured", never a measured win rate.
- Tests sit next to the code as `*.test.ts`.
- Keep files under 300 lines (ESLint `max-lines`); split by responsibility before that.
- Conventional Commits (`feat(sim): ...`, `chore: ...`), small and single-purpose. The commit body
  explains why.
- Record significant decisions as numbered ADRs in `docs/decisions/`.
- Stop any dev server or other background process you started before finishing a task. Check the
  port is actually free afterwards: stopping the `pnpm dev` wrapper can leave the `vite` child
  process running and holding the port.
