# 0015: Batch 2: Berserker, Sniper, Quake, and contactDamageOf

- Status: Accepted
- Date: 2026-11-06

## Context

Batch 2 adds three balls. The plan gave each a mechanic and an intended counter map:

| Ball      | Mechanic                                                             | Intended favoured | Intended unfavoured |
| --------- | -------------------------------------------------------------------- | ----------------- | ------------------- |
| Berserker | On hitting a ball, bonus ability damage scaled by its missing health | vs Venom          | vs Sniper           |
| Sniper    | Locks its aim, shows a laser, then fires one heavy shot, no leading  | vs Berserker      | vs Speedster        |
| Quake     | Every wall bounce sets off a short-warning shockwave zone            | vs Frost          | vs Archer           |

It also suggested links between the new balls where they fit naturally: Sniper favoured against
the Frost (the slowest ball can't leave the locked line) and Thorns favoured against the Berserker
(rage hits bounce straight back). Everything else even, the Brawler included.

ADR 0010's rule applies: a counter needs a mechanical reason, and stats only tune its strength.
So each ball was first played against the roster across a sweep of its stats to see which
matchups its mechanic moves on its own. The counters below come from those measurements. Where an
intended counter never appeared, it was replaced rather than forced with stats.

## Decision

### 1. contactDamageOf: rage is contact damage

A new optional query on `BallDefinition`, beside `cruiseSpeed`:
`contactDamageOf(self, stats) => number`, the base contact damage a ball deals in its current
state. `applyContactDamage` reads it from the ball as it was before the exchange, then scales it by
directness as before (ADR 0008). It defaults to `contactDamage`, so no other ball changes, and it
throws for a non-finite or negative value.

The plan made rage an on-hit ability damage action. Measured that way it had two problems:

- **Draws.** Berserker vs Speedster drew 11-28% of its games: both balls' on-hit bonuses land in
  the same `onHitBall` phase, outside the lethal-exchange tiebreak, so two low balls knocked each
  other out together.
- **Thorns can't reflect it.** Thorns reflects contact damage only (ADR 0013), so "rage hits bounce
  straight back" was false for an ability bonus.

As contact damage, rage goes through the tiebreak (the larger raw hit survives) and Thorns
reflects it. The Speedster pair now draws 0.4%.

### 2. Berserker

Contact damage 16, plus `RAGE_DAMAGE` (8) times the share of max health it has lost: 24 at the
edge of defeat, still below the Brawler's 26. Health 93, the most in the roster, and speed 780.

What the measurements showed:

- **Rage alone barely separates matchups.** At 64-74 health, with rage up to 22, the Berserker's
  results moved against every opponent together, apart from a weak Thorns effect. What separates
  them is the large health pool the rage needs in order to matter.
- **Berserker favoured vs Venom did not fit.** In both versions of rage, Venom did as well against
  the Berserker as the Brawler did, or better: poison wears it down between contacts, where rage
  has nothing to hit. Only at 96-106 health did Venom fall 2-7 points behind the Brawler, and
  there the Vampire won about two thirds of its games against the Berserker.
- **Sniper favoured vs Berserker did not fit.** Against the Sniper the Berserker did between 3
  points worse and 6 points better than its own average, better at most configs.
- **Thorns favoured vs Berserker** appeared only at low health (about 10 points at 74), and
  vanished once the Berserker had the health to reach 50% overall.

What does appear, at every health from 88 up:

| Pair                   | Intended           | Mechanical reason                                                                  |
| ---------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Berserker vs Speedster | Berserker favoured | Its huge health soaks the burst, and every hit it soaks makes its own hits harder. |
| Vampire vs Berserker   | Vampire favoured   | The biggest health pool gives lifesteal the most to drink.                         |

The Vampire's edge is steep in health (57% against the final 93-health Berserker, 67-69% against
a 98-health one), so health is the lever for that pair.

### 3. Sniper

Health 76, contact damage 9, speed 780. Every 105 ticks after a shot it locks its aim on the
nearest enemy's position at that moment, holds it for 18 ticks (0.3 s) with a laser showing, then
fires one shot along the locked line: 27 damage at 2400 units per second, below the Storm's 28 so
the Storm keeps the biggest single ability hit. No leading and no spread.

- **Speedster favoured vs Sniper** appeared at every config, 10-15 points below the Sniper's
  average. Its stacks take it well past every other ball's speed, so it is off the line by the
  time the shot comes.
- **Sniper favoured vs Thorns** appeared everywhere, and grew as the Sniper's contact damage fell
  (3-6 points above its average at 14 contact, 12-15 at 9): shots never touch the spikes, and light
  contact hits leave little to reflect. The same reason as the Archer, Storm and Venom.
- **Sniper favoured vs Frost did not fit.** It ran 0-6 points _below_ the Sniper's average. Speeds
  differ by about 10% outside the Speedster's stacks, which is too little to change how often a
  ball leaves the line, and the Frost is sturdy.

### 4. Quake

Health 72, contact damage 15, speed 760. A wall bounce spawns a zone at the impact point (the sim
clamps it into the arena): radius 180, 13 damage, striking 12 ticks (0.2 s) later. Then 30 ticks
before the next one, so a corner can't chain.

- **Quake favoured vs Frost reversed.** The Quake did 5-14 points worse than its average against
  the Frost in every config (about 10 at the final one):
  slowed, the Quake reaches the walls less often, and every shockwave needs a wall. That is a clear
  mechanic, so the pair is kept the other way round: **Frost favoured vs Quake**.
- **Archer favoured vs Quake did not fit.** Against the Archer the Quake did between 4 points
  worse and 6 points better than its average, mostly within a point or two. Arrows are ranged, but the Archer bounces around the arena like everyone else,
  so it is not kept away from the Quake's walls.
- **Quake favoured vs Speedster** appeared instead, and the warning sweep shows why: the edge was
  7 points at a 10-tick warning, 3 at 24 and 1 at 40 (and 5 at 1 tick, within noise of 10). The longer the warning, the more often the
  fastest ball gets out; at 12 ticks speed buys it almost nothing.
- Venom tracked the Speedster at a 45-tick cooldown (both about 7 points above average). A 30-tick
  cooldown with less damage per shockwave brought Venom to the edge of the even band (55.7, NEAR)
  and kept the other two edges.

### 5. Counter map for batch 2

| Pair                   | Intended           | Mechanical reason                                                                  |
| ---------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Berserker vs Speedster | Berserker favoured | Its huge health soaks the burst, and every hit it soaks makes its own hits harder. |
| Vampire vs Berserker   | Vampire favoured   | The biggest health pool gives lifesteal the most to drink.                         |
| Speedster vs Sniper    | Speedster favoured | The fastest ball, faster with stacks, is off the locked line before the shot.      |
| Sniper vs Thorns       | Sniper favoured    | Shots never touch the spikes, and its light contact hits leave little to reflect.  |
| Quake vs Speedster     | Quake favoured     | The warning is too short to outrun, so speed buys the Speedster nothing.           |
| Frost vs Quake         | Frost favoured     | Slowed, the Quake reaches the walls less often, and every shockwave needs a wall.  |
| All other new pairs    | Even               | Including the Brawler (the safe pick) and the three new balls with each other.     |

Each pair's reason is in `src/sim/counter-map-batch-2.ts` (moved from `scripts/` by ADR 0019).

### 6. Results

`pnpm balance`, 500 seeds per slot order, all eleven balls. Batch 2 pairs (first ball's rate
first):

| Pair                   | Intended  | Result      | Check |
| ---------------------- | --------- | ----------- | ----- |
| Berserker vs Speedster | Berserker | 58.5 / 41.1 | WARN  |
| Vampire vs Berserker   | Vampire   | 57.3 / 40.5 | NEAR  |
| Speedster vs Sniper    | Speedster | 65.3 / 34.5 | ok    |
| Sniper vs Thorns       | Sniper    | 64.2 / 35.5 | ok    |
| Quake vs Speedster     | Quake     | 61.1 / 36.6 | ok    |
| Frost vs Quake         | Frost     | 58.4 / 40.9 | WARN  |
| Brawler vs Berserker   | Even      | 48.7 / 50.1 | ok    |
| Brawler vs Sniper      | Even      | 47.0 / 52.8 | WARN  |
| Brawler vs Quake       | Even      | 46.8 / 52.6 | WARN  |
| Berserker vs Archer    | Even      | 54.9 / 44.4 | NEAR  |
| Berserker vs Venom     | Even      | 55.1 / 44.5 | NEAR  |
| Quake vs Venom         | Even      | 55.7 / 44.0 | NEAR  |
| Berserker vs Sniper    | Even      | 52.3 / 47.0 | WARN  |
| Berserker vs Quake     | Even      | 51.9 / 47.5 | ok    |
| Sniper vs Quake        | Even      | 50.3 / 49.6 | ok    |

The other 12 new pairs are even and `ok` or `WARN`. Pairs among the first eight balls are
unchanged.

Per ball: Brawler 46.4%, Speedster 48.7%, Vampire 49.8% (heals 36.3% of max), Archer 51.4%,
Storm 52.2%, Frost 52.1%, Thorns 46.3%, Venom 48.9%, Berserker 51.2%, Sniper 49.3% (60.5% of its
damage from shots), Quake 50.6% (40.2% from shockwaves). Draws 0.6%, median 18.3 s, worst side
31.3%, worst ±5% sensitivity 13.7 points. Every target passes, with four new NEAR pairs inside the
noise allowance.

### 7. Rendering

- **Berserker:** dark cracks run in from the edge, more and heavier as its health drops.
- **Sniper:** a scope crosshair whose centre turns laser red while the aim is locked. A thin laser
  runs from its edge to the wall along the locked line, brightening as the shot nears.
- **Quake:** two rock strata broken by a fault where one side has slipped. Its zones strike as a
  clean ring sweeping out to the zone's edge instead of a flash and a bolt. A design chooses this
  with a new optional `strike` field, and strikes now carry their owner's id.

## Consequences

- Positive: every new counter comes from a mechanic and was measured before it was kept. Where the
  plan's guess did not hold, the ADR says why rather than tuning stats until it looked right.
- Positive: `contactDamageOf` gives any future ball a state-dependent hit that plays by the
  contact rules: directness, the lethal tiebreak and reflection.
- Positive: the Speedster gains two unfavoured matchups (Berserker, Quake) and one favoured
  (Sniper), so it is no longer the ball with the most favoured pairs.
- Negative: the Berserker's identity rests on its health pool as much as on its rage, and its
  fights are the longest in the roster (Frost vs Berserker median 31 s, Berserker mirror 32 s).
- Negative: three of the six planned counters are not in the map (Berserker > Venom,
  Sniper > Berserker, Archer > Quake) and one is reversed (Frost > Quake). The Venom, Sniper and
  Frost links suggested for batch 2 are even.
- Negative: four new pairs sit just outside the even band (NEAR), and Venom is on the low side in
  two of them. Mirror draws: Sniper 5.2%, Venom 10.6%, Thorns 11.2%, Speedster 17%. Mirrors are
  outside the draw target and covered by the replay decision in `docs/vision.md`.
