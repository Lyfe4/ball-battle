# 0004: Seeded variance on wall bounces

- Status: Accepted
- Date: 2026-11-04

## Context

The simulation was deterministic and also nearly chaotic-free: from a given start, two balls
bounced off walls like ideal billiard balls, and the only randomness was the starting position
and launch direction. Over a match of ten or more hits, small differences averaged out, so the
seed barely changed who won.

Balancing in step 3a showed what that does (ADR 0003 balance work, `pnpm balance`):

- Once a matchup leaned one way, nearly every seed went the same way. Small stat changes flipped a
  matchup from 0/100 to 100/0 with almost nothing in between.
- A random search over health and damage found no slope to follow; only pairwise bisection
  worked, and only to land on a knife edge.
- To get every matchup inside 25/75, the abilities had to be weakened until they barely mattered:
  the Speedster's stack bonus dropped from 4 to 1 per stack, the Vampire's lifesteal from 50% to
  35%.

A game you watch should have outcomes that depend on how the fight plays out, with stats that
shift the odds gradually rather than deciding the result outright.

## Decision

Every time a ball bounces off a wall, its reflected velocity is rotated by a small random angle
drawn from the world's seeded RNG, at most `BOUNCE_MAX_ANGLE_DEGREES` (8°) either way. Bounces are
frequent, so this decorrelates trajectories quickly while each individual bounce still looks
natural.

- **Seeded and stored.** The angle comes from `world.rngState` (one draw per bouncing ball per
  tick, in ball order) and the advanced state is stored back in `WorldState`, so a snapshot still
  fully determines the future and the same seed still replays the same match.
- **No trigonometry** (ADR 0001). With `t` drawn uniformly from `[-T, T]` where
  `T = tan(BOUNCE_MAX_ANGLE / 2)` is a precomputed constant, the rational parametrisation

  ```
  cos = (1 - t²) / (1 + t²)
  sin = 2t / (1 + t²)
  ```

  gives an exact rotation by `2·atan(t)` using only `+ − * /`. Speed is preserved to within a
  rounding error. The angle is not perfectly uniform (because `atan` is not linear), but over ±4°
  half-angle it is within 0.2% of uniform, which does not matter here.

- **Once per tick, after movement, before `onWallHit`.** A corner hit (two bounces in one tick)
  rotates once. Running before `onWallHit` means abilities see the final direction.
- **Never back into the wall.** If the rotated velocity would point back towards a wall the ball
  just bounced off, the rotation is mirrored (`-t`). If both directions would, which can only
  happen on a near-parallel graze into a corner, the bounce is left unrotated. Only the velocity
  changes, never the position, so balls stay inside the arena.

## Consequences

- Positive: win rates change smoothly with stats, so balance can be tuned by measuring slopes
  (`pnpm balance` reports win-rate sensitivity to ±5% damage per matchup), and abilities can be
  strong enough to matter.
- Negative: links and seeds shared before this change replay differently, because the RNG stream
  now advances during a match. There are no external users yet. The hook random substreams
  (ADR 0003) are seeded from `world.rngState`, so they change too, but stay deterministic.
- Ball-vs-ball collisions stay perfectly elastic and unrandomised: variance lives only at walls,
  where it can't change the physics of a hit.
