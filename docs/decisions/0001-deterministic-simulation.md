# 0001: Deterministic, fixed-timestep simulation

- Status: Accepted
- Date: 2026-11-01

## Context

BallBattle is an auto-battler: the player picks balls and watches; nothing they do changes the
outcome once a match starts. That makes the match a pure function of its inputs (the chosen balls
and a seed), and we want to keep it that way, because it buys several things:

- **Reproducible matches.** A seed in the URL replays the exact same fight, so a match can be
  shared, and a bug report becomes "seed 1234, tick 812" rather than "it glitched once".
- **Testable game logic.** Tests can run thousands of ticks headlessly and assert exact outcomes
  without mocking time or randomness.
- **Future features for free.** Replays, instant results (run the sim without rendering),
  balance testing across thousands of seeds, and save states are all straightforward once the
  simulation is deterministic, and very hard to retrofit.

The usual sources of non-determinism in a browser game are: variable frame times, wall-clock time,
unseeded randomness, and reading or mutating state from rendering code.

## Decision

1. **Isolate the simulation in `src/sim/`** with no access to the DOM, `Date`, `performance`,
   timers or `Math.random`. This is enforced, not just documented:
   - `tsconfig.sim.json` compiles the sim with only the ES lib and `types: []`, so DOM and Node
     globals are type errors.
   - ESLint bans `Math.random`, `Date`, timers, browser globals, and imports from `src/render` or
     `src/main.ts` inside `src/sim`.
2. **Fixed timestep.** The sim advances in ticks of exactly 1/60 s. `main.ts` accumulates real
   elapsed time and runs as many whole ticks as fit; rendering frequency never affects results.
   Elapsed time per frame is clamped, so a backgrounded tab pauses the match instead of
   fast-forwarding through a burst of ticks when it returns.
3. **Seeded PRNG.** All randomness comes from mulberry32 in `src/sim/rng.ts`. It uses only 32-bit
   integer operations (`Math.imul`, shifts, xor), which are exact in every engine. The generator
   state is a plain number stored in `WorldState`, so a snapshot of the world fully determines its
   future.
4. **Rendering is read-only.** `src/render` receives sim state and draws it; it never writes back.
5. **Restricted floating-point maths.** IEEE 754 requires `+ - * /` and `Math.sqrt` to be
   correctly rounded, so they give identical results on every engine and CPU. The ECMAScript spec
   leaves transcendental functions (`Math.sin`, `cos`, `tan`, `atan2`, `exp`, `log`, `pow`,
   `hypot`, `cbrt` and friends) and the `**` operator _implementation-approximated_: V8,
   SpiderMonkey and JavaScriptCore can return different last bits, and those differences compound
   over thousands of ticks. ESLint bans them in `src/sim`. If we need trigonometry later, we will
   either precompute tables or write a deterministic implementation from basic arithmetic, and
   record that in a new ADR.

## Consequences

- Positive: matches are reproducible from a seed across browsers and machines; game logic is unit
  testable at full speed; replays and headless balance runs need no extra design.
- Negative: no trig in the sim for now, so rotations and angles must be expressed with vectors.
  Developers must route every random choice through the PRNG and remember that the sim cannot
  see time or input except through its explicit inputs.
- Rendering shows the latest tick rather than interpolating between ticks. At 60 ticks/s this is
  smooth on 60 Hz displays; on 120 Hz+ displays motion can look slightly uneven. Interpolation can
  be added in the renderer later without touching the sim.
- Determinism is verified by tests: identical seeds produce `toStrictEqual` worlds after 1000
  ticks. Cross-engine determinism rests on the maths restrictions above. It was untested at
  first; since 2026-11-05 it is tested on every push (ADR 0023): 132 recorded matches come out
  bit-identical in Node, Chromium, Firefox and WebKit.
