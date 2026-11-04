# 0005: Projectiles

- Status: Accepted
- Date: 2026-11-04

## Context

Abilities could damage, heal and change velocity (ADR 0003), but not create anything. The Archer
needs to shoot arrows, and later balls will want other things that fly across the arena. Arrows
are fast and small, so the discrete overlap test used for balls (ADR 0002) would let them skip
straight through a ball in one tick.

## Decision

### 1. Projectiles are world objects

`WorldState.projectiles` holds plain serialisable `ProjectileState`s: id, owner id, position,
velocity, radius, damage and remaining lifetime in ticks. Ids come from
`WorldState.nextProjectileId`, a counter in the world, so they are deterministic and a snapshot
still fully determines the future. Hooks can read `world.projectiles`.

A hook creates one with the `spawnProjectile` action (velocity, radius, damage, lifetime). It
spawns just outside its owner's edge along its velocity, so it never starts overlapping the ball
that fired it. If that spawn point is outside the arena (an Archer against a wall aiming into it),
nothing is added, but the projectile still takes an id and emits `projectileFired` followed by
`projectileExpired('wall')` in the same tick, so every fired projectile has a matching end.

### 2. Straight flight, swept collision

Projectiles fly straight. Each tick, each projectile's path is tested against each live enemy ball
as a segment against a circle, using their _relative_ motion over the tick: with
`f = P₀ − C₀`, `d = (P₁ − P₀) − (C₁ − C₀)` and `R = r_ball + r_projectile`, the first `s` in
`[0, 1]` with `|f + s·d| = R` is the hit time. The ball's start and end are its positions before
movement and after collisions. Only `+ − * /` and `Math.sqrt` are used (ADR 0001). This catches a
fast arrow crossing a ball within one tick, and a fast ball crossing a slow arrow.

The nearest hit along the path wins. A projectile never hits its owner or another projectile. It
is removed when it hits a ball, when its path reaches a wall (whichever comes first along the
path), or when its lifetime runs out, a safety net that keeps the count bounded.

Projectiles resolve one at a time in creation order, each hit applied before the next projectile
is checked. A ball brought to 0 health by an earlier projectile in the same tick counts as
defeated for later ones, which pass through it. Projectiles don't push balls, and a projectile
whose owner has been defeated keeps flying and can still hit.

### 3. Damage is ability damage

A projectile hit deals `cause: 'ability'` damage from its owner, through the same code path as
the `damage` action. It is not part of the contact lethal tiebreak (ADR 0002). Because
`onDamageDealt` runs for every damage event of the tick, the owner's `onDamageDealt` fires for
projectile damage, so a ball combining projectiles with lifesteal needs no special handling.

### 4. Tick order

1. Finished match: return unchanged.
2. `onTick` → apply (the Archer fires here).
3. Balls move and bounce, with the seeded turn (ADR 0004).
4. `onWallHit` → apply.
5. Ball collisions.
6. Contact damage for new contacts.
7. `onHitBall` → apply.
8. **Projectiles move and resolve.**
9. `onDamageDealt` for every damage event so far, contact and projectile → apply.
10. Defeats.
11. Contacts and match end.

Projectiles spawned in phases 2–7 move in the same tick they appear. Projectiles spawned by
`onDamageDealt` start moving on the next tick.

### 5. Events

`projectileFired` (id, owner, position, velocity), `projectileHit` (id, owner, target, point,
damage actually dealt; followed by that hit's `damage` event) and `projectileExpired` (id, owner,
reason `wall` or `lifetime`).

### 6. The Archer and its counters (intended design)

The Archer is the first projectile user: lowest contact damage, modest health, an arrow every
2 seconds. It leads its aim, shooting where its target will be if it keeps moving in a straight
line (a quadratic intercept, solved with arithmetic and `Math.sqrt`); it can't foresee wall
bounces.

Aiming at the target's current position was tried first. The Speedster closed in and won almost
every fight (about 91/9), and no stat change fixed that without the Archer crushing the slower
balls: its best and worst matchups were always 50-60 points apart. Leading the aim narrowed that
to about 45, and the balance targets now allow soft counters (no matchup worse than 20/80).

The resulting counters are deliberate:

- **Speedster beats Archer** (about 77/23): it closes the distance faster than arrows can stop it.
- **Archer beats Brawler** (about 68/32) and **Vampire** (about 63/37): big, slower targets are
  easy to hit before they arrive. The Vampire was made faster (760, still below the Speedster) so
  this counter stays soft.
- Brawler, Speedster and Vampire stay within about 42-58 of each other.

Every ball still wins 40-60% overall. A future change that turns one of these into a hard
counter (worse than 20/80), or removes one, is a design decision, not a tuning step.

## Consequences

- Positive: projectiles are data like everything else in the world, reproducible from a seed and
  testable headlessly. Swept collision means projectile speed is not limited by tick rate.
- Negative: two collision models now exist side by side (discrete for ball vs ball, swept for
  projectiles). Projectiles don't interact with each other or push balls; either would be a new
  decision.
