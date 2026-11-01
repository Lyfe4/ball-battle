# BallBattle

[![CI](https://github.com/Lyfe4/ball-battle/actions/workflows/ci.yml/badge.svg)](https://github.com/Lyfe4/ball-battle/actions/workflows/ci.yml)

A browser auto-battler. Balls with different abilities bounce around a square arena until one
wins. There is no player control: you pick the balls and watch.

Built with TypeScript, Vite and plain Canvas 2D. No game engine, no physics library, no
framework.

Pick two balls and watch them fight. They collide elastically and deal damage scaled by how hard
they hit; the match ends by knockout or at a 60-second time limit.

| Ball      | Ability                                                                  |
| --------- | ------------------------------------------------------------------------ |
| Brawler   | None. The baseline every other ball is balanced against.                 |
| Speedster | Each wall bounce adds a stack of speed and damage; a hit cashes them in. |
| Vampire   | Heals for part of every hit it lands.                                    |

## Running it

Needs Node 24+ and pnpm 11 (`corepack enable` picks up the pinned version).

```bash
pnpm install
pnpm dev
```

Every match is in the URL, e.g. `?a=speedster&b=vampire&seed=42`: share or reload it to replay
the exact same fight. Unknown ball ids fall back to the defaults, and a missing seed gets a fresh
random one.

| Script           | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev`       | Vite dev server                                          |
| `pnpm build`     | Typecheck and build to `dist/`                           |
| `pnpm test`      | Run the tests once (`pnpm test:watch` to watch)          |
| `pnpm lint`      | ESLint                                                   |
| `pnpm typecheck` | `tsc -b` across all tsconfig projects                    |
| `pnpm format`    | Prettier (`pnpm format:check` to only check)             |
| `pnpm balance`   | Matchup matrix over N seeds per slot order (default 500) |

## Architecture

```
src/
  sim/      pure, deterministic simulation (no DOM, no time, no Math.random)
  render/   draws sim state on a canvas; never changes it
  sim/balls/        one file per ball definition
  sim/abilities/    runs ability hooks and applies the actions they return
  ui/       plain-DOM picker and HUD: health, result, Replay / New match
  app/      browser-side helpers: fixed-step clock, seed and matchup parsing
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
6. **The sim reports, it doesn't listen.** Each tick returns events (collision, damage, heal,
   ability triggered, defeat, match end) for effects, sound and replays; nothing feeds back in.
7. **Abilities return actions.** Hooks get a read-only view and return plain-data actions
   (damage, heal, change velocity, update own state); the sim applies them in a fixed order.

Why: [ADR 0001: Deterministic, fixed-timestep simulation](docs/decisions/0001-deterministic-simulation.md)
, [ADR 0002: Combat core](docs/decisions/0002-combat-core.md)
and [ADR 0003: Ability system](docs/decisions/0003-ability-system.md).
Full rules for contributors: [CLAUDE.md](CLAUDE.md).

Production bundle: 12.31 kB JS (5.22 kB gzipped), 2.41 kB CSS. First version baseline: 5.05 kB
JS (2.41 kB gzipped).

## License

[MIT](LICENSE)
