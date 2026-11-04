# BallBattle

[![CI](https://github.com/Lyfe4/ball-battle/actions/workflows/ci.yml/badge.svg)](https://github.com/Lyfe4/ball-battle/actions/workflows/ci.yml)

**Play it: [battle-ball.netlify.app](https://battle-ball.netlify.app/)**

A browser auto-battler. Balls with different abilities bounce around a square arena until one
wins. There is no player control: you pick the balls and watch.

Built with TypeScript, Vite and plain Canvas 2D. No game engine, no physics library, no
framework.

Pick two balls and watch them fight. They collide elastically and deal damage scaled by how hard
they hit; the match ends by knockout or at a 60-second time limit.

| Ball      | Ability                                                                          |
| --------- | -------------------------------------------------------------------------------- |
| Brawler   | None. Hits the hardest; the baseline every other ball is balanced against.       |
| Speedster | Fastest ball. Each wall bounce adds speed and bonus damage; a hit cashes it in.  |
| Vampire   | Heals for 40% of the damage it deals.                                            |
| Archer    | Lowest contact damage, but shoots an arrow where its enemy is heading every 2 s. |
| Storm     | Calls down lightning on its enemy every 2 s; the strike lands 0.8 s later.       |

Every ball is the same size and keeps its own speed through collisions; a hit's damage depends
on how directly it lands, not how fast. Counters are part of the design, but stay soft (no
matchup worse than 20/80): the **Speedster beats the Archer** by closing the distance, the
**Vampire beats the Speedster** by outlasting its burst, the **Speedster edges the Storm** by
outrunning its warnings, and the **Archer edges the Brawler and the Vampire**. Everything else is
close to even.

## Running it

Needs Node 24+ and pnpm 11 (`corepack enable` picks up the pinned version).

```bash
pnpm install
pnpm dev
```

Every match is in the URL, e.g. `?a=speedster&b=vampire&seed=42`: share or reload it to replay
the exact same fight. Unknown ball ids fall back to the defaults, and a missing seed gets a fresh
random one.

| Script           | What it does                                                                    |
| ---------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`       | Vite dev server                                                                 |
| `pnpm build`     | Typecheck and build to `dist/`                                                  |
| `pnpm preview`   | Serve `dist/` with the production security headers, to check the CSP            |
| `pnpm test`      | Run the tests once (`pnpm test:watch` to watch)                                 |
| `pnpm lint`      | ESLint                                                                          |
| `pnpm typecheck` | `tsc -b` across all tsconfig projects                                           |
| `pnpm format`    | Prettier (`pnpm format:check` to only check)                                    |
| `pnpm balance`   | Matchup matrix, ability impact and sensitivity (N seeds per order, default 500) |

## Architecture

```
src/
  sim/      pure, deterministic simulation (no DOM, no time, no Math.random)
  render/   draws sim state on a canvas; never changes it
  sim/balls/        one file per ball definition
  sim/abilities/    runs ability hooks and applies the actions they return
  ui/       plain-DOM picker and HUD: health, result, Replay / New match
  app/      browser-side helpers: fixed-step and presentation clocks, seed and matchup parsing
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
   ability triggered, projectiles, zones, defeat, match end) for effects, sound and replays;
   nothing feeds back in.
7. **Abilities return actions.** Hooks get a read-only view and return plain-data actions
   (damage, heal, change velocity, update own state, fire a projectile, mark a zone); the sim
   applies them in a fixed order.

Why: [ADR 0001: Deterministic, fixed-timestep simulation](docs/decisions/0001-deterministic-simulation.md)
, [ADR 0002: Combat core](docs/decisions/0002-combat-core.md)
, [ADR 0003: Ability system](docs/decisions/0003-ability-system.md)
, [ADR 0004: Wall-bounce variance](docs/decisions/0004-wall-bounce-variance.md)
, [ADR 0005: Projectiles](docs/decisions/0005-projectiles.md)
, [ADR 0006: Hazard zones](docs/decisions/0006-hazard-zones.md)
, [ADR 0007: Presentation clock and battle feel](docs/decisions/0007-presentation-clock.md)
and [ADR 0008: Uniform size, directness, cruise speed](docs/decisions/0008-size-directness-cruise-speed.md).
Full rules for contributors: [CLAUDE.md](CLAUDE.md).

Production bundle: 44.96 kB JS (16.24 kB gzipped), 3.43 kB CSS. First version baseline: 5.05 kB
JS (2.41 kB gzipped).

## License

[MIT](LICENSE)
