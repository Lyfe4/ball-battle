# BallBattle

Browser auto-battler: balls with different abilities bounce around a square arena with health
bars until one wins. No player control; you pick balls and watch. This is a portfolio piece, so
code quality matters as much as features.

Stack: TypeScript (strict), Vite, pnpm, Vitest, ESLint (flat config) + Prettier, Husky +
lint-staged, plain HTML Canvas 2D. No game engine, no physics library, no React.

## Commands

- `pnpm dev`: start the Vite dev server
- `pnpm build`: typecheck and build to `dist/`
- `pnpm test`: run Vitest once (`pnpm test:watch` to watch)
- `pnpm lint`: ESLint
- `pnpm typecheck`: `tsc -b` over every tsconfig project
- `pnpm format` / `pnpm format:check`: Prettier
- `pnpm balance [seeds]`: play seeds 0..N-1 headlessly and print win/draw rates and match length.
  Run it after changing any ball's stats or combat rules. Not part of CI.

CI runs `format:check`, `lint`, `typecheck`, `test` and `build`. All must pass.

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
   helpers that are not sim or rendering (the fixed-step clock, seed parsing) live in `src/app/`
   as small pure functions with tests; keep `main.ts` to wiring.
6. **Balls are data-driven definitions**, one file per ball in `src/sim/balls/`. A
   `BallDefinition` is plain data plus optional hooks (`BallHooks`). Runtime state (`BallState`)
   is kept separate from the definition. Hooks are not called yet.
7. **`step(world, definitions)` returns `{ world, events }`.** Definitions stay out of
   `WorldState` (they can hold functions); pass the same lookup every tick. Events are output
   only and never feed back into the sim: anything the sim must remember (health, contacts,
   match state) lives in `WorldState`. A finished match is returned unchanged with no events.

The reasoning is in `docs/decisions/0001-deterministic-simulation.md` and
`docs/decisions/0002-combat-core.md`.

## Conventions

- `step` is pure: it returns a new `WorldState` and never mutates its input. Sim types are
  `readonly`.
- Within a tick: move, collide, damage (new contacts only), defeat, match end. Events are emitted
  in that order.
- Sim tests share helpers from `src/sim/test-support.ts` (`run`, `withBalls`, `deepFreeze`).
- A behaviour test should be shown to fail with the behaviour disabled before it is trusted.
- World coordinates are in world units (`ARENA_SIZE` = 1000), never pixels. The renderer maps
  world units to the screen.
- Colours and sizes for the renderer come from `src/render/theme.ts`, not inline literals.
- Tests sit next to the code as `*.test.ts`.
- Keep files under 300 lines (ESLint `max-lines`); split by responsibility before that.
- Conventional Commits (`feat(sim): ...`, `chore: ...`), small and single-purpose. The commit body
  explains why.
- Record significant decisions as numbered ADRs in `docs/decisions/`.
