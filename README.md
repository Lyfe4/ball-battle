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
| Brawler   | None. Hits the hardest. The safe pick: even against every ball but Thorns.       |
| Speedster | Fastest ball. Each wall bounce adds speed and bonus damage; a hit cashes it in.  |
| Vampire   | Heals for 40% of the damage it deals.                                            |
| Archer    | Lowest contact damage, but shoots an arrow where its enemy is heading every 2 s. |
| Storm     | Lightning every 2 s, landing 0.8 s later. Its strikes and touch cut healing.     |
| Frost     | Slowest and sturdiest. Every hit slows its enemy for 3 s.                        |
| Thorns    | Spiked: every contact hit it takes hurts the attacker back by 35%.               |
| Venom     | Light hits that poison its enemy for over 4 s, chipping away between contacts.   |
| Berserker | The most health, and it hits harder the more of it it has lost.                  |
| Sniper    | Locks onto its enemy with a laser, then fires one heavy shot down the line.      |
| Quake     | Every wall it hits sends out a shockwave a moment later.                         |

Every ball is the same size and keeps its own speed through collisions; a hit's damage depends
on how directly it lands, not how fast. Counters are part of the design, soft (favoured, never
decided) and each with a mechanical reason: the **Speedster beats the Archer** by closing the
distance, the **Archer beats the Vampire** from range, the **Vampire beats the Speedster** by
outlasting its burst, the **Storm beats the Vampire** by shocking it so it heals less, and the
**Speedster beats the Storm** by outrunning its warnings. The **Frost beats the Speedster** by
slowing it, and the **Storm beats the Frost**, which is too slow to leave its warnings. **Thorns beats the Brawler**, whose hard
hits bounce back the most, and the **Archer and Storm beat Thorns**, since ranged attacks never
touch its spikes. **Venom** and the **Sniper** beat Thorns too (poison and shots never touch the
spikes), and the **Vampire** out-heals Venom's poison. The **Berserker** soaks the Speedster's burst
but feeds the Vampire's lifesteal; the **Speedster** leaves the Sniper's locked line before the
shot, but can't outrun the **Quake**'s short warning, and the **Frost** slows the Quake off the
walls it needs. The **Brawler** is the safe pick, even against everyone except Thorns. The map is checked by `pnpm balance` ([ADR 0010](docs/decisions/0010-counter-map.md)).

## Running it

Needs Node 24+ and pnpm 11 (`corepack enable` picks up the pinned version).

```bash
pnpm install
pnpm dev
```

Every match is in the URL, e.g. `?a=speedster&b=vampire&seed=42`: share or reload it to replay
the exact same fight. Unknown ball ids fall back to the defaults, and a missing seed gets a fresh
random one.

| Script           | What it does                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`       | Vite dev server                                                              |
| `pnpm build`     | Typecheck and build to `dist/`                                               |
| `pnpm preview`   | Serve `dist/` with the production security headers, to check the CSP         |
| `pnpm test`      | Run the fast tests once (`pnpm test:watch` to watch)                         |
| `pnpm test:slow` | Roster-wide tests that play every matchup (a separate CI job)                |
| `pnpm lint`      | ESLint                                                                       |
| `pnpm typecheck` | `tsc -b` across all tsconfig projects                                        |
| `pnpm format`    | Prettier (`pnpm format:check` to only check)                                 |
| `pnpm balance`   | Matchup matrix, ability impact and sensitivity, on all cores (`--ball <id>`) |

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
, [ADR 0008: Uniform size, directness, cruise speed](docs/decisions/0008-size-directness-cruise-speed.md)
, [ADR 0009: Status effects](docs/decisions/0009-status-effects.md)
, [ADR 0010: Counter map](docs/decisions/0010-counter-map.md)
, [ADR 0011: Roster scaling](docs/decisions/0011-roster-scaling.md)
, [ADR 0012: Slowed, poisoned, onDamageTaken](docs/decisions/0012-slowed-poisoned-damage-taken.md)
, [ADR 0013: Thorns, the Brawler's counter](docs/decisions/0013-thorns-brawler-counter.md)
, [ADR 0014: Venom, Thorns' counter](docs/decisions/0014-venom-thorns-counter.md)
and [ADR 0015: Berserker, Sniper, Quake](docs/decisions/0015-berserker-sniper-quake.md).
Full rules for contributors: [CLAUDE.md](CLAUDE.md).

Production bundle: 60.30 kB JS (20.86 kB gzipped), 5.14 kB CSS. First version baseline: 5.05 kB
JS (2.41 kB gzipped).

## License

[MIT](LICENSE)
