# BallBattle

[![CI](https://github.com/Lyfe4/ball-battle/actions/workflows/ci.yml/badge.svg)](https://github.com/Lyfe4/ball-battle/actions/workflows/ci.yml)

A browser auto-battler. Balls with different abilities bounce around a square arena until one
wins. There is no player control: you pick the balls and watch.

Built with TypeScript, Vite and plain Canvas 2D. No game engine, no physics library, no
framework.

> Early days: the simulation, renderer and tooling are in place, with two balls bouncing off the
> walls. Collisions, health and abilities come next.

## Running it

Needs Node 24+ and pnpm 11 (`corepack enable` picks up the pinned version).

```bash
pnpm install
pnpm dev
```

Add `?seed=1234` to the URL to replay a specific match. Without one, a random seed is picked and
written into the URL so you can share or reload the same match.

| Script           | What it does                                    |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Vite dev server                                 |
| `pnpm build`     | Typecheck and build to `dist/`                  |
| `pnpm test`      | Run the tests once (`pnpm test:watch` to watch) |
| `pnpm lint`      | ESLint                                          |
| `pnpm typecheck` | `tsc -b` across all tsconfig projects           |
| `pnpm format`    | Prettier (`pnpm format:check` to only check)    |

## Architecture

```
src/
  sim/      pure, deterministic simulation (no DOM, no time, no Math.random)
  render/   draws sim state on a canvas; never changes it
  app/      browser-side helpers: fixed-step clock, seed parsing
  main.ts   wires it together with a requestAnimationFrame loop
```

The rules, in brief:

1. **The simulation is pure and deterministic.** `src/sim` cannot touch the DOM, the clock,
   timers or `Math.random`. A separate `tsconfig.sim.json` without the DOM lib and ESLint rules
   enforce this; transcendental `Math` functions are banned too, because they can differ between
   browsers.
2. **Fixed timestep.** The sim runs at exactly 60 ticks per second regardless of frame rate. The
   same balls and seed always produce the same match.
3. **Seeded randomness** comes only from a mulberry32 PRNG whose state is part of the world.
4. **Rendering only reads.** The renderer draws the current state and never writes to it.
5. **Balls are data.** Each ball is a definition file (plain data plus optional hooks) in
   `src/sim/balls/`.

Why: [ADR 0001: Deterministic, fixed-timestep simulation](docs/decisions/0001-deterministic-simulation.md).
Full rules for contributors: [CLAUDE.md](CLAUDE.md).

Production bundle baseline (first version): 5.05 kB JS (2.41 kB gzipped), 0.62 kB CSS.

## License

[MIT](LICENSE)
