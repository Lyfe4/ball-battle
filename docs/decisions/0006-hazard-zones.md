# 0006: Hazard zones

- Status: Accepted
- Date: 2026-11-04

## Context

Abilities can damage, heal, change velocity and fire projectiles (ADR 0003, 0005), but nothing
acts on an area or after a delay. The Storm calls down lightning: a strike that is announced
first, so a ball that reads it can move out of the way. That needs a new kind of world object
whose effect is decided at a known future tick, not on contact.

## Decision

### 1. Zones are world objects

`WorldState.zones` holds plain serialisable `ZoneState`s: id, owner id, position, radius, damage,
the tick it was spawned and the tick it strikes. Ids come from `WorldState.nextZoneId`, a counter
in the world like `nextProjectileId`, so a snapshot still fully determines the future. Hooks can
read `world.zones`.

A hook creates one with the `spawnZone` action (position, radius, damage, `delayTicks`). The delay
is relative and must be a whole number of at least 1. The sim stores the absolute
`strikeTick = tick + delayTicks`, so a hook can't schedule a strike in the past, and a zone never
strikes on the tick it appears. Invalid values (non-finite numbers, a radius of 0 or one too big
to fit in the arena, a delay below 1 or not whole) throw, because only a bug can produce them. A
defeated owner spawns nothing, like any other action from a defeated ball.

### 2. Clamped inside the arena

The requested centre is clamped on each axis to `[radius, size − radius]`, so the whole circle is
always inside the arena. A zone aimed at a ball in a corner sits as close to it as it can, and it
still covers the corner.

### 3. A telegraphed strike, once

A zone does nothing until its strike tick. On that tick it damages every ball that:

- is alive at that moment,
- is not its owner, and
- strictly overlaps it: `dx² + dy² < (r_zone + r_ball)²`. This is the same strict test as ball
  collisions, and comparing squares needs no `sqrt`, so it is exact (ADR 0001).

Positions are the balls' positions after this tick's movement and collisions, so a ball that
leaves before the strike takes no damage, however long it was inside. The zone is then removed.
Every zone strikes exactly once, so the zone count is bounded by how often balls spawn them.

Zones striking on the same tick resolve in spawn order, each hit applied before the next zone is
checked. A ball brought to 0 health by an earlier zone is not hit again. A zone whose owner has
been defeated still strikes, like an arrow still in flight (ADR 0005). If the match ends first,
pending zones stay in the frozen world and never strike.

### 4. Damage is ability damage

A zone hit deals `cause: 'ability'` damage from its owner, through the same code path as the
`damage` action and projectile hits. It is not part of the contact lethal tiebreak (ADR 0002).
Zones resolve before `onDamageDealt`, so the owner's `onDamageDealt` fires for every zone hit in
the same tick.

### 5. Tick order

1. Finished match: return unchanged.
2. `onTick` → apply (the Storm spawns its zones here).
3. Balls move and bounce, with the seeded turn (ADR 0004).
4. `onWallHit` → apply.
5. Ball collisions.
6. Contact damage for new contacts.
7. `onHitBall` → apply.
8. Projectiles move and resolve (ADR 0005).
9. **Zones whose strike tick is this tick strike.**
10. `onDamageDealt` for every damage event so far: contact, projectile and zone → apply.
11. Defeats.
12. Contacts and match end.

Zones strike after projectiles because both use the balls' final positions for the tick, and the
order between them only matters when both hit the same ball on the same tick. Projectiles came
first in ADR 0005, so they keep that place.

### 6. Events

- `zoneSpawned` (id, owner, clamped position, radius, strike tick): the warning starts.
- `zoneStruck` (id, owner, position, radius, `hitIds`), followed by one `damage` event per ball
  hit, in `hitIds` order. A miss is a `zoneStruck` with `hitIds: []`. There is no separate expiry
  event, so every zone has exactly one `zoneSpawned` and one `zoneStruck`.

### 7. Rendering

A zone is drawn under the balls as a circle in its owner's colour that fills from the centre as
the strike tick approaches, so a viewer can read when it will hit. The strike is a short flash
and a lightning bolt, driven by the `zoneStruck` event in the render layer. The bolt's jagged
shape is random, but its seed comes from the zone id, so a replay looks identical. The
randomness lives only in the renderer and never touches the sim.

### 8. The Storm and its counters

The Storm is the first zone user. Every 130 ticks (about 2.2 s, the first on tick 60) it marks a
zone of radius 170 around the nearest enemy's **current** position, off by a seeded random amount
of up to 60 units (uniform in a disk, from `ctx.random`). The zone strikes 48 ticks (0.8 s) later
for 26 damage, the biggest single ability hit in the roster. Otherwise its stats are moderate:
radius 50, speed 720, health 68, contact damage 13.

The warning time is the main balance lever, and it doesn't work the obvious way. With a 0.6 s
warning, speed decided everything: fast balls walked out of almost every zone and slow ones
almost never did (Speedster vs Storm about 86/14 while the Storm crushed the Vampire). With a
longer warning every ball escapes more often, which narrows the gap between fast and slow
targets. Damage then moved from contact into the zone, so the ability still provides at least
40% of the Storm's damage (45% measured). Measured zone hit rates: Brawler 17%, Vampire 21%,
Archer 12%, Speedster 10%.

Lowering the Speedster's health also fixed Speedster vs Storm, but it moved Vampire vs Speedster
from 58/42 to 68/32, breaking the near-even trio ADR 0005 describes, so it was reverted. The
other four balls are unchanged, and their matchups with each other are exactly as before.

The resulting counters are deliberate and soft (`pnpm balance`, 500 seeds per slot order):

- **Speedster beats Storm** (about 67/33): it outruns the warning.
- **Storm beats Brawler** (about 63/37) and **Vampire** (about 63/37): big, slower targets are
  easier to catch in a zone.
- **Archer edges the Storm** (about 60/40): it out-damages it from range, and it is small and
  quick enough to dodge often.

Every ball wins 40-60% overall (Storm 49.5%). Turning one of these into a hard counter (worse than
20/80), or removing one, is a design decision, not a tuning step.

## Consequences

- Positive: area and delayed effects are plain data like everything else, reproducible from a
  seed and testable headlessly. Escaping a strike rewards movement, which is visible and readable.
- Negative: a third object list in the world, threaded through hook phases like projectiles.
  Zones don't interact with projectiles or with each other, and they don't push balls; any of
  that would be a new decision.
