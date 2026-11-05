# 0018: An aimed start, behind an option

- Status: Accepted (the option); whether the game uses it is undecided
- Date: 2026-11-05

## Context

A proposed skill layer: at the start of each round both balls stand on fixed spots on opposite
sides of the arena, and each player chooses the direction their ball launches in (simultaneously
and blind in PvP). Everything after the launch plays out as today. Before any UI, the question is
whether this creates real skill without breaking the counter map (ADR 0010), which needs the sim to
start a match from a chosen direction, while every existing match, link and balance number stays
exactly as it is.

## Decision

`createWorld(seed, definitions, start?)` takes an optional `StartMode`:

- `{ kind: 'random' }`, the default (`RANDOM_START`): today's start, unchanged. Each ball gets a
  random spot in its own vertical strip and a random direction, from the seed.
- `{ kind: 'aimed', aims }`: exactly two balls, on fixed spots mirrored across the centre,
  `AIMED_STARTS` = (250, 500) and (750, 500), each launched at its definition speed towards its
  aim point.

Rules for the aimed start:

- **Aim points are whole arena coordinates**, 0 to `ARENA_SIZE` on both axes. A browser and a
  server then hold the exact same input, and a choice fits in a link as two small integers. A
  fractional, non-finite or out-of-arena point throws, and so does the ball's own spot (no
  direction).
- **The direction is normalised with `Math.sqrt` only** (`aimDirection`), so it is identical on
  every engine (ADR 0001). No angle ever reaches the sim; a UI that thinks in angles converts to an
  aim point first.
- **It draws nothing from the RNG**: the world's `rngState` is the seeded state, so the seed still
  decides everything after the launch (wall-bounce turns, ADR 0004; hook randomness, ADR 0003).
- Two balls only, since the spots are a pair.

## Proof that nothing changed

- The old and new `createWorld` give identical worlds for 2,000 seeds of every ordered pair of the
  roster (242,000 worlds), and a test pins seed 42.
- `pnpm balance 500` output is byte-identical before and after (same SHA-256).
- Tests cover determinism over a whole match, the launch pointing at the aim point, every kind of
  invalid aim, and no RNG draw; each was shown to fail with its behaviour broken.

## Consequences

- Positive: aiming can be measured with the real sim (`docs/aiming-measurements.md`) without
  touching the live game. A future series setup can carry aim points as plain integers.
- Negative: two start paths in `createWorld`. The aimed one is unused by the game until a UI
  exists.
- Whether aiming becomes part of the game is decided on the measurements, not here.
