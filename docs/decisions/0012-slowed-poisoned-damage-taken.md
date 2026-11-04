# 0012: Slowed, poisoned, onDamageTaken, and the Frost

- Status: Accepted
- Date: 2026-11-04

## Context

Batch 1 of new balls needs three mechanics the sim did not have. The Frost slows, the Venom
poisons, and Thorns reflects damage. Each counter has to come from a mechanic (ADR 0010), so the
mechanics come first and stats only tune how strong they are. All three statuses and hooks follow
ADR 0009: plain data on the ball, created only by actions, refreshed and never stacked.

## Decision

### 1. Slowed

`slowed` cuts a ball's cruise speed by `SLOW_FACTOR` (0.3, in `src/sim/status.ts`). It is applied
in `cruiseSpeedOf`, after the definition's own `cruiseSpeed`, so it works for every ball without
touching its definition. That includes the Speedster's stacked speed. The cruise-speed phase
already ends the tick (ADR 0008), so a slow lands on the tick it is applied, and the ball is back
at full speed on the tick the slow expires. Slowing only ever lowers speed, so the pass-through
bound in `balls.test.ts` is unchanged.

### 2. Poisoned

`poisoned` deals `POISON_DAMAGE` (2) of its source's ability damage every `POISON_INTERVAL_TICKS`
(30) while active.

- **Fixed rhythm.** `StatusState` gains `sinceTick`, the tick the status was first applied. A
  refresh keeps it, so poison ticks on `sinceTick + k × interval` (k ≥ 1) no matter how often it is
  refreshed. A refresh can extend poison but can neither reset nor speed up its rhythm. Rhythm
  timers on refresh would let a ball that re-applies often delay or speed up its ticks.
- **Source's damage.** Each tick goes through `dealAbilityDamage`, the path used by the `damage`
  action, arrows and lightning. So it is the poisoner's ability damage and fires the poisoner's
  `onDamageDealt`. Poison from a defeated source still ticks, like an arrow still in flight.
- **No tick on expiry.** A poison applied for exactly N intervals is removed at the start of its
  last due tick, so it deals N − 1 ticks. Its duration and interval are tuned together.

### 3. onDamageTaken

A new hook on the receiving side: `onDamageTaken({ attacker, amount, cause })`, once per damage
instance the ball took this tick (amount above 0).

- It runs after `onDamageDealt`, over every damage event of the tick so far, including damage from
  `onDamageDealt` actions.
- The invocations are collected **once, before the phase runs**. Damage dealt by its own actions
  fires neither `onDamageDealt` nor `onDamageTaken`. Two reflecting balls hitting each other
  reflect once each and stop (tested).
- Hooks only run for balls alive at the start of their phase (ADR 0003), so a ball knocked out by
  a hit does not react to it.

### 4. Tick order

1. Finished match: return unchanged.
2. Statuses due this tick expire.
3. `onTick` → apply.
4. Move and bounce, with the seeded turn (ADR 0004).
5. `onWallHit` → apply.
6. Ball collisions.
7. Contact damage for new contacts.
8. `onHitBall` → apply.
9. Projectiles move and resolve (ADR 0005).
10. Zones due this tick strike (ADR 0006, 0009).
11. **Poison ticks.**
12. `onDamageDealt` → apply.
13. **`onDamageTaken` → apply.**
14. Defeats.
15. Cruise speed, **reduced while slowed** (ADR 0008).
16. Contacts and match end.

### 5. The Frost

The slowest ball (speed 720, the identity rule) and sturdy (health 82, contact damage 22). Every
contact slows the ball it touches for `SLOW_TICKS` (180, 3 s).

| Pair                              | Intended       | Mechanical reason                                                                     |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| Frost vs Speedster                | Frost favoured | Slowed cuts both of the Speedster's weapons: speed and the bounces that build stacks. |
| Storm vs Frost                    | Storm favoured | The slowest ball is the least likely to leave a lightning warning.                    |
| Brawler, Vampire, Archer vs Frost | Even           | No mechanic favours either side.                                                      |

`pnpm balance`, 500 seeds per slot order, all six balls:

| Pair               | Intended | Result      | Check |
| ------------------ | -------- | ----------- | ----- |
| Frost vs Speedster | Frost    | 68.0 / 31.7 | WARN  |
| Storm vs Frost     | Storm    | 56.2 / 43.5 | NEAR  |
| Brawler vs Frost   | Even     | 44.7 / 54.7 | NEAR  |
| Frost vs Vampire   | Even     | 48.6 / 49.8 | ok    |
| Frost vs Archer    | Even     | 44.2 / 55.4 | NEAR  |

Per ball: Brawler 48.5%, Speedster 49.4%, Vampire 45.9% (heals 31.4% of max), Archer 50.9%,
Storm 52.2%, Frost 51.8%. Draws 0.4%, median 15.8 s, worst side 31.7%, worst ±5% sensitivity
8.3 points. Every target passes. The five original balls' matchups with each other are unchanged.

**What limits the fit.** The Storm's edge over the Frost and the Archer's evenness move together:
both are ranged, and a slow target is easier for both lightning and leading arrows. Across 72
configs (health 76-88, contact 21-24, speed 660-740, slow 180-300 ticks, slow factor 0.3 and
0.45), the Storm never beat the Frost by more than about 3 points more than the Archer did. So
Storm vs Frost sits just below its band and Frost vs Archer just outside the even band, both inside
the noise allowance. A slow factor of 0.45 made the gap slightly worse, so it stays at 0.3.

### 6. Venom and Thorns are not in this batch

Both were built and tuned against the same rules and did not fit; they stay out of the roster.

- **Venom vs Storm (intended Venom favoured) has no mechanical edge.** At its closest config
  (health 68, contact 15, speed 770, poison 180 ticks), Venom beat the Storm 51.2% and the
  Brawler 49.9%. Poison rewards long fights, but the Storm (74 health) is not tanky enough
  compared with the Brawler (64) for that to set it apart. Heavier poison (4 and 6 per tick) and
  poison as a share of max health (4% and 6%) raised Venom against everyone alike, and from 4 per
  tick up the Vampire stopped countering it. The poison mechanic is in the sim, tested, and unused.
- **Thorns vs Storm and Archer.** Reflection scales with the attacker's hit, so a Thorns even with
  the Brawler and Vampire has to be fragile (health 50), and then lightning and arrows, which
  are never reflected, beat it 65/35 and 73/27. Reflecting on-hit bonuses as well fixed the
  Brawler and Vampire pairs but not the ranged ones. Its redesign as the Brawler's counter is ADR 0013.

## Consequences

- Positive: two reusable statuses and a receiving-side hook, each with a fixed place in the tick
  and a no-loop guarantee. Matches without the Frost replay exactly as before.
- Positive: the Frost gives the Speedster a second bad matchup from a mechanic, not from stats.
- Negative: three of the Frost's pairs sit just outside their bands, inside the noise allowance.
  A fourth new Frost counter would need a mechanic that separates the Storm from the Archer.
- Negative: one more field per status (`sinceTick`) and two more tick phases.
