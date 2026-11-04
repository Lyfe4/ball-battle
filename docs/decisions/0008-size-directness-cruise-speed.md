# 0008: Uniform size, damage from directness, cruise speed

- Status: Accepted
- Date: 2026-11-04

## Context

Two properties of a ball quietly did much more than they appeared to:

- **Radius** was mass (bigger balls shove smaller ones), target size (for other balls, arrows and
  zones) and a share of the arena all at once. Radii ranged from 38 to 60, so every matchup was
  partly a size matchup, which the ball's description never mentioned.
- **Collision speed** was damage. ADR 0002 §4a scaled each hit by the attacker's approach speed
  over its definition speed, up to 2×. Elastic collisions also traded speed between balls, so a
  ball's speed drifted away from its definition during a match, and with it its damage.

Both made balance opaque: a stat change moved several hidden things at once. And both made a
ball's identity less readable, because its speed and size during a fight were not what its
definition said.

## Decision

### 1. One standard size

Every current ball uses `STANDARD_BALL_RADIUS` (50 world units, mid-roster and the Storm's
existing size). `radius` stays on `BallDefinition`, so a future size-themed ball (a Titan, a Tiny)
can differ. The roster's identity tests require the standard radius for every ball, except ids
listed explicitly with their radius, so a size exception is a deliberate design decision.

With equal radii, all balls have equal mass, so an elastic collision simply exchanges the two
balls' velocity components along the normal. The collision code still supports unequal masses
(the core test fixtures use them).

### 2. Contact damage from directness

Each ball's contact hit is scaled by how **directly** it was moving at the other ball, not how
fast:

```
directness = approachSpeed / |velocity|        (before the impulse)
multiplier = clamp(directness, MIN_IMPACT_MULTIPLIER, 1)
damage     = max(1, round(contactDamage × multiplier))
```

`approachSpeed` is the ball's velocity along the collision normal towards the other ball, so
directness is the cosine of the angle between its heading and the line between the centres:
head-on is 1, a 60° approach is 0.5, and a ball moving away or standing still deals the minimum
(0.25). Speed magnitude no longer matters. It becomes damage only through an ability (the
Speedster's stack bonus).

This keeps what ADR 0002 §4a was for: with a flat damage per hit the winner would be a pure
function of the stats, while the angle of each hit varies from collision to collision. The
lethal-exchange tiebreak (ADR 0002 §4b) is unchanged: it still compares each side's rounded raw
damage, which now comes from directness.

Directness is computed in `resolvePair`, the only place that sees the velocities before the
impulse, and reported on the contact.

### 3. Every ball keeps its cruise speed

Collisions change direction, but at the end of every tick each live ball's velocity is rescaled
to its **cruise speed**, keeping its direction. By default that is the definition's `speed`. A
definition can declare `cruiseSpeed(abilityState, stats)`, a pure function of its own ability
state, for an ability that changes how fast it travels. The Speedster's is its stacked speed, so
it no longer sets its velocity from hooks at all: its hooks only change stacks, and its speed
follows. A zero velocity has no direction and is left alone; a non-finite or non-positive cruise
speed throws, because only a bug can produce one.

The `scaleVelocity` action is removed. Normalisation would undo it at the end of the same tick,
and an action that silently does nothing is a trap. `setVelocity` stays, for changing direction.

Collisions remain pure, momentum-conserving physics, tested at the collision level.
Normalisation is a separate phase afterwards, so momentum over a whole tick is not conserved, by
design: balls are self-propelled.

### 4. Tick order

1. Finished match: return unchanged.
2. `onTick` → apply.
3. Move and bounce, with the seeded turn (ADR 0004).
4. `onWallHit` → apply.
5. Ball collisions (separation, elastic impulse, directness).
6. Contact damage for new contacts, scaled by directness.
7. `onHitBall` → apply.
8. Projectiles move and resolve (ADR 0005).
9. Zones due this tick strike (ADR 0006).
10. `onDamageDealt` → apply.
11. Defeats.
12. **Cruise speed: every live ball's velocity is rescaled to its cruise speed.**
13. Contacts and match end.

Cruise speed runs last because it reads ability state after every hook of the tick has run, so it
never fights a hook, and velocities only matter at the next tick's move.

### 5. Pass-through guard

With equal radii and fixed speeds, the fastest two balls can close is the sum of their highest
cruise speeds. A test computes that bound from the roster and keeps it under the frozen 0.6 margin
of the `(rA + rB) / DT` detection limit, alongside the measured property test.

## Consequences

- Positive: a ball's size and speed during a fight are what its definition says; matchups are
  about abilities and stats, not hidden size and momentum effects. Balance levers each do one
  thing. Damage reads from the picture: a head-on hit hurts more than a graze.
- Negative: every seed replays differently from before (there are no external users yet), and all
  balance numbers changed. Size can no longer differentiate balls unless a ball is an explicit,
  tested exception.

## Retune and counters

With the old stats under the new rules, every target already passed except the overall win-rate
range: the Vampire won 61.9% (lifesteal on a smaller body outlasted everyone) and the Storm 37.9%.
The retune changed three numbers: Vampire health 66 → 60, Storm health 68 → 74 and zone damage
26 → 28, and Archer health 44 → 50 (it grew from radius 38 to 50, so it is easier to hit). The
Brawler and Speedster are unchanged, and the Speedster's stack bonus did not need raising.

The field is flatter than before (`pnpm balance`, 500 seeds per slot order): every ball wins
47.8-53.3% overall, the worst matchup is 32.8/67.2 (was 22.5/77.5), the worst ±5% health swing
is 7.3 points (was 10.5) and the worst closing speed is 0.373 of the pass-through limit (was
0.504). The remaining counters, all soft:

- **Speedster beats Archer** (about 67/33): it still closes the distance fastest.
- **Vampire beats Speedster** (about 60/40): lifesteal outlasts the Speedster's burst now that
  speed no longer adds contact damage.
- **Speedster edges Storm** (about 58/42): it outruns more warnings than anyone.
- **Archer edges Brawler and Vampire** (about 57/43 each).

These replace the counters recorded in ADR 0005 §6 and ADR 0006 §8.
