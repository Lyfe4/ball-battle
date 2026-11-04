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
natural. (The expected balance benefit did not show up in measurement; see "Measured effect"
below.)

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
  just bounced off, the rotation is mirrored (`-t`). A turn can only flip an axis whose component
  is smaller than `|v|·sin(8°)`, and both components can't be that small at once, so one of the
  two directions always works for a moving ball; leaving the bounce unturned is only a guard for
  a zero velocity. Only the velocity changes, never the position, so balls stay inside the
  arena.

## Measured effect

Once `pnpm balance` could measure it (win-rate swing for ±5% contact damage, per matchup, on the
same seeds), the variance turned out **not** to be what fixed the cliffs:

| Stats           | Bounce variance | Worst swing for ±5% damage | Median match  |
| --------------- | --------------- | -------------------------- | ------------- |
| Step 3a final   | off             | 17.5 pts                   | 23.5 s        |
| Step 3a final   | 8°              | 17.2 pts                   | 23.6 s        |
| Step 3a-2 final | off             | 15.0 pts                   | 15.2 s        |
| Step 3a-2 final | 8°              | 14.7 pts                   | 15.1 s        |
| Step 3a-2 final | 12° / 15°       | 17.1 / 14.6 pts            | 15.3 / 15.1 s |

(300-500 seeds per slot order; the swing has about ±2-3 points of noise.) The differences are
within noise. The 0/100 cliffs seen while tuning step 3a came from large moves through stat space
and from hit-count thresholds (a health value exactly equal to a few of the opponent's hits), not
from a lack of randomness at ±5%.

What actually flattened the slope was fight length: longer fights mean more hits, so luck
averages out and a small stat edge decides the match more reliably. Brawler vs Vampire, stretched
by lifesteal, was always the steepest. Raising damage and lowering health brought the worst swing
under 15 points, at the cost of the median sitting near its 15-second floor.

The variance is kept: it is cheap, seeded, preserves speed, makes each bounce look less
mechanical and keeps trajectories from repeating, and it costs nothing in balance. It is not a
balance tool, and the angle should not be raised in the hope that it will be.

## Consequences

- Positive: trajectories now depend on the seed throughout a match, not just at the start, and
  `pnpm balance` can measure how steep each matchup is before tuning.
- Negative: links and seeds shared before this change replay differently, because the RNG stream
  now advances during a match. There are no external users yet. The hook random substreams
  (ADR 0003) are seeded from `world.rngState`, so they change too, but stay deterministic.
- Ball-vs-ball collisions stay perfectly elastic and unrandomised: variance lives only at walls,
  where it can't change the physics of a hit.
