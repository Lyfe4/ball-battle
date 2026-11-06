# 0034: Batch 4: Chrono, Titan, Inferno; rewind, growth, lasting zones

- Status: Accepted
- Date: 2026-11-06
- Amends: ADR 0002 (a knocked-out ball may still act), ADR 0006 (zones that last), ADR 0008 (one
  size exception), ADR 0010 (counter map)

## Context

Batch 4 adds three balls. The plan gave each a mechanic and intended counters:

| Ball    | Mechanic                                               | Intended favoured        | Intended unfavoured |
| ------- | ------------------------------------------------------ | ------------------------ | ------------------- |
| Chrono  | Once a match, rewinds its health and position on a KO  | vs Sniper, vs Storm      | vs Venom            |
| Titan   | Grows bigger and heavier over the match, up to a cap   | vs Speedster             | vs Archer, Sniper   |
| Inferno | Leaves short-lived burning patches that damage enemies | vs Frost, vs Necromancer | vs Speedster        |

Each needed something the sim couldn't do:

- move a ball back in time;
- change a ball's size during a match;
- keep a zone alive after its first strike.

As in batches 2 and 3 (ADR 0015, 0026), each ball was prototyped and measured before its counters
were chosen, and a planned counter the data didn't support was replaced.

## Decision

### 1. Rewind: `onKnockedOut` and the `rewind` action (the Chrono)

- **When it fires.** On the knockout itself, not at a health threshold. A threshold misses exactly
  the big hit the Chrono exists to undo: a strike or a shot that takes it from 30 to 0.
- **A new phase, 13b,** after `onDamageTaken` and before defeats. It runs `onKnockedOut` for each
  ball that was alive at the start of the tick and is at 0 now.
  - It is the one hook that runs for a ball at 0.
  - Its `rewind` action is the one action that acts on an owner at 0. It puts the ball back at an
    earlier position (kept in the arena), velocity and health.
  - A rewound ball is not defeated, and the match goes on.
  - It fires no other hooks, so nothing chains.
- **History** is plain data in the Chrono's ability state: a moment (tick, position, velocity,
  health) every 15 ticks, the last two kept. It rewinds to the older one, 15-29 ticks back.
- **Not rewound:** statuses, projectiles in flight, pending zones, and anything the enemy gained.
- **Collisions.** If the old spot overlaps the enemy now, the next tick's collision pass separates
  them like any overlap. This is tested, including a rewind straight onto the enemy.
- **Event:** `rewound` (from, to, health before and after), for the renderer.
- **Once per match:** its state records `used`.

### 2. Size: `radiusOf` (the Titan)

- A definition may declare `radiusOf(self, tick)`, a pure query like `cruiseSpeed`.
- It's applied at the end of each tick (step 15, after cruise speed), and the ball is kept inside
  the arena. An overlap the growth creates is separated by the next collision pass.
- Mass is already r² (`collision.ts`), so a bigger ball is heavier. Light balls bounce off it
  while it barely turns, and cruise speed still keeps every ball's speed (ADR 0008).
- The pass-through limit `(rA + rB) / DT` only grows as a ball grows. The 0.6 margin test is
  unchanged and passes.
- **The one size exception.** The identity test lists the Titan with its size over a match
  (standard at the start, 90 at its largest). Every other ball stays at `STANDARD_BALL_RADIUS`.

### 3. Lasting zones (the Inferno; reusable)

- `spawnZone` takes an optional `linger: { ticks, pulseEveryTicks }`. A lasting zone strikes on
  its strike tick, then again every `pulseEveryTicks` until `linger.ticks` later, then goes.
- Each pulse strikes exactly like a strike today: ability damage to every enemy ball inside, its
  status if it has one, and every enemy minion inside destroyed (ADR 0026).
- `zoneStruck` carries `pulse` (0, 1, 2, ...) for a lasting zone.
- Zones without `linger` are unchanged. Before the version bump, all 210 recorded ruleset-4
  matches (ADR 0023) replayed bit-identical under the new code, so no earlier fight changed.
- A later Gravity Well can reuse it with a pull in place of damage.

## What the measurements showed

Each ball was swept with `pnpm balance --ball <id>` (200-400 seeds), with its mechanic switched
off as a baseline once its stats were near 50%.

**Chrono.**

- With a 3 s rewind, the rewind was worth about +31 points against everyone. It helped most
  against contact finishers (Thorns +44, Magnet +40) and least against the Necromancer, Vampire
  and Archer. Storm and Sniper were average.
- A 3 s window undoes all recent damage, so a single big hit wasn't special. A **half-second
  window** undoes about one hit, which separates burst from drip:
  - burst balls lose most to it: the Speedster's stacked rush, the Storm's strike, the Sniper's
    shot;
  - drip balls lose least: poison keeps ticking on it, and what a Vampire drank stays drunk.
- Lighter hits with more health widened that spread further, but pushed the Vampire pair past
  75/25, so that was rejected.
- **Venom over the Chrono held**, at about 59%. At 3 s it didn't: Venom was then one of the
  Chrono's best matchups.

**Titan.**

- Growth on vs off, at the same stats: the bigger, heavier body meets its enemy more often, so
  every ball with light hits loses the trade (Speedster +9, Archer +16, Venom +15). Balls that make
  contact cost something gain on it: Thorns' spikes reflect more often, and Inferno's fire covers
  more of it (−13).
- **Archer over the Titan reversed.** Arrows land more often on a bigger target, but the Titan
  meets the Archer more often still, and the Archer hits the lightest in the game.
- **Sniper over the Titan didn't appear.** The shot always lands on its locked line anyway; the
  pair is even (54/45).
- At a cap of 110-120 the Titan beat Venom 75-77%, past the 25/75 limit. A cap of **90** keeps
  it at 70%.

**Inferno.**

- Burns did most at first, and its stats were too strong (60% at 70 health, 70% at 82).
- **Ability over stats:** its own hits went down to 7 and the fire up to 3 every 15 ticks.
  - Its edges sharpened both ways: it beats the Ghost (phasing doesn't stop fire), the
    Necromancer (skulls burn up), the Titan (the bigger body covers more fire) and Thorns
    (nothing to reflect).
  - The Speedster (it outruns the fire) and the Archer (it never has to cross it) beat it.
  - A patch catches 20 ticks after it's dropped, which is what lets a fast ball be through it
    first.
- **Inferno over the Frost didn't hold** (54/45). The Frost is only 7% slower than the field, too
  little to linger, and it hits hard enough to pay the fire back. Rarer, harder pulses didn't
  change that.

## Counter map for batch 4

| Pair                   | Intended | Mechanical reason (abridged; in full in `counter-map-batch-4.ts`)   |
| ---------------------- | -------- | ------------------------------------------------------------------- |
| Chrono vs Speedster    | Chrono   | Its stacked rush is one big hit, and the rewind undoes it.          |
| Chrono vs Storm        | Chrono   | A strike is one big hit, and the rewind undoes it.                  |
| Chrono vs Sniper       | Chrono   | A shot is one big hit, and the rewind undoes it.                    |
| Vampire vs Chrono      | Vampire  | The rewind gives back the Chrono's health, not what it drank.       |
| Venom vs Chrono        | Venom    | Poison isn't rewound: it keeps ticking.                             |
| Titan vs Speedster     | Titan    | It bounces off the growing body, and its light hits lose the trade. |
| Titan vs Archer        | Titan    | The growing body meets it more often; its light hits lose.          |
| Titan vs Venom         | Titan    | Poison only refreshes, so more meetings mean more heavy hits.       |
| Titan vs Necromancer   | Titan    | It meets it and its skulls often, and light hits lose the trade.    |
| Thorns vs Titan        | Thorns   | The growing body meets the spikes more often.                       |
| Inferno vs Titan       | Inferno  | The bigger the body, the more fire it covers.                       |
| Speedster vs Inferno   | Speedst. | It outruns the flames, and crosses a patch before it burns twice.   |
| Archer vs Inferno      | Archer   | It shoots from range and never has to cross the fire.               |
| Inferno vs Ghost       | Inferno  | Fire never needed contact: a phased ball still burns.               |
| Inferno vs Necromancer | Inferno  | The fire burns up the skulls, and the Necromancer behind them.      |
| Inferno vs Thorns      | Inferno  | Fire never touches the spikes, so there is nothing to reflect.      |
| All other new pairs    | Even     | The Brawler (safe pick) included.                                   |

Replaced from the plan:

- **Archer and Sniper > Titan** became **Titan > Archer** and Sniper even, with Thorns and Inferno
  as the Titan's counters.
- **Inferno > Frost** became even, with the Ghost, Titan and Thorns added.

No interaction rule was added. Every edge is the ball's own mechanic, visible on screen: the
rewind trail, the Titan's size, the fire. Poison still ticking after a rewind needs no rule, only
the rule that statuses aren't rewound. There are still three rules (`src/sim/rules.ts`).

## Results

`pnpm balance 500`, all seventeen balls. New pairs only, with the new ball's side:

| Check | Pair                   | Intended  | Result               |
| ----- | ---------------------- | --------- | -------------------- |
| WARN  | Brawler vs Chrono      | even      | 45.1% / 54.2%        |
| ok    | Brawler vs Titan       | even      | 47.6% / 51.7%        |
| ok    | Brawler vs Inferno     | even      | 47.9% / 51.6%        |
| WARN  | Chrono vs Speedster    | Chrono    | 70.2%                |
| WARN  | Chrono vs Storm        | Chrono    | 58.2% (below target) |
| NEAR  | Chrono vs Sniper       | Chrono    | 57.6%                |
| WARN  | Vampire vs Chrono      | Vampire   | 62.7%                |
| WARN  | Venom vs Chrono        | Venom     | 58.8% (below target) |
| ok    | Titan vs Speedster     | Titan     | 64.4%                |
| WARN  | Titan vs Archer        | Titan     | 63.4%                |
| WARN  | Titan vs Venom         | Titan     | 70.1%                |
| WARN  | Titan vs Necromancer   | Titan     | 60.7% (below target) |
| NEAR  | Thorns vs Titan        | Thorns    | 57.6%                |
| WARN  | Inferno vs Titan       | Inferno   | 61.2% (below target) |
| WARN  | Speedster vs Inferno   | Speedster | 62.6%                |
| WARN  | Archer vs Inferno      | Archer    | 58.9% (below target) |
| ok    | Inferno vs Ghost       | Inferno   | 66.7%                |
| WARN  | Inferno vs Necromancer | Inferno   | 62.8%                |
| NEAR  | Inferno vs Thorns      | Inferno   | 57.5%                |

The 27 even pairs: 8 ok, 17 WARN (13 of them below target) and 2 NEAR. The NEAR pairs are
Chrono vs Thorns (56.9 / 41.1) and Titan vs Quake (58.3 / 41.0). No pair misses: the target line
reads "every pair inside its counter-map floor: ok", with 51 pairs below target across the map (33
before). Pairs among the first fourteen balls are unchanged.

Stats:

- **Chrono:** speed 770, health 78, contact 20; a moment every 15 ticks, two kept.
- **Titan:** speed 740, health 85, contact 22; it grows 0.06 units a tick from 50 to 90 (full
  size at about 11 s).
- **Inferno:** speed 770, health 70, contact 7. It drops a patch every 20 ticks, of radius 55,
  that catches 20 ticks later and burns 3 every 15 ticks for 2 s.

Per ball: Chrono 51.8%, Titan 51.5%, Inferno 50.8% (72% of its damage is fire), and the first
fourteen at 45.6-52.3%.

Every hard rule passes:

- draws under 5%;
- median fight 18.1 s (target 12-30 s);
- worst side 28.6%;
- worst ±5% sensitivity 14.0 points;
- the Vampire heals 44.9% of its max health per match.

Mirror draws: Chrono 5.2%, Titan 4.4%, Inferno 1.4% (a drawn round is replayed, ADR 0017).

**What fell short.**

- Chrono over the Storm and Sniper sit at 58%, short of the 65% aimed for. Its edge over burst
  and Venom's edge over it pull its strength in opposite directions, and stats can only centre
  them.
- Several new favoured pairs are below the 62% target, and are listed under "Below target" in
  `docs/balance-summary.md`.
- Measured shapes warn for the Speedster (−5: it gains the Inferno as prey and the Chrono and
  Titan as predators) and the Necromancer (−6: the Titan and Inferno both beat it).

## Rendering

- **Chrono:** a brass clock face whose minute hand sweeps as the match runs. Once its rewind is
  spent the hands stop and the face fades, so a viewer can see it has no second chance. The rewind
  itself: a dotted gold trail from where it was knocked out to where it lands, and a fading ghost
  at the spot it left, for 0.9 s of effect time. Nothing moves, so reduced motion shows the same.
- **Titan:** a jade helm with a visor slit, a crest and rivets, drawn in fractions of its radius,
  so it grows with the ball.
- **Inferno:** a peach flame with a dark tongue and a pale heart; the tip flickers with the sim
  tick. Its patches sit under the balls: a small ember while a patch catches, then an orange disc
  that flares on every burn and fades as it burns out. A burn shows no flash or bolt (the design's
  strike style is `burn`).
- **Colours** were picked for distance from the fourteen in CIELAB, and all three keep 3:1 on the
  floor:
  - Chrono brass `#d4a373`: nearest is the Quake, ΔE 37;
  - Titan jade `#86efac`: nearest is Thorns, ΔE 32;
  - Inferno peach `#fdba74`: nearest are the Speedster and Berserker, ΔE 41-42.
- **At small size** (under 24 CSS px of radius) the Chrono drops its hour marks and thickens its
  hands, the Titan drops its rivets, and the Inferno drops its heart. All three were checked in
  the style guide's phone arena at 2× density.
- **The matchup chart's header icons** now shrink to the cell. With 17 balls a phone cell is about
  17 px, under the icons' 18, and the last column was clipped.
- **The link preview** shows the roster in two rows of nine.

### Performance

Measured with `scripts/frame-timing.ts` (new). It runs headless Chromium at 375 × 812, 2× density
and 4× CPU throttling, timing the frame callback over five matches of the new balls: Inferno vs
Necromancer, Titan vs Speedster, Chrono vs Storm (with a rewind), Inferno vs Titan and Chrono vs
Inferno.

| Refresh               | Frames | Median |    p95 |     Max | Over 16.7 ms |
| --------------------- | -----: | -----: | -----: | ------: | -----------: |
| 60 Hz (native rAF)    |  5,737 | 0.5 ms | 0.9 ms |  9.8 ms |            0 |
| 90 Hz (fixed driver)  |  8,001 | 0.5 ms | 0.9 ms | 10.2 ms |            0 |
| 120 Hz (fixed driver) |  8,473 | 0.4 ms | 0.7 ms |  9.3 ms |            0 |

In line with ADR 0028's table (median 0.6-0.9 ms, max 10.0-12.8 ms). Up to seven burning patches
and a growing Titan add no measurable cost: a patch is one filled and one stroked circle.

## Consequences

- **Positive:** three reusable mechanics, each tested on its own and shown failing with its
  behaviour switched off: a hook that can undo a knockout, a size that changes, and a zone that
  lasts. No rule was added; every new edge is visible in what the ball does.
- **Positive:** the planned counters that held are the reason each ball exists (the Chrono and
  burst, the Titan and light hitters, the Inferno and skulls). The ones that didn't were replaced
  with counters the data supports.
- **Negative:** the Chrono's designed counters sit at the floor rather than the target. The
  Speedster and the Necromancer gain weak matchups.
- **Negative:** a ball at 0 health partway through a tick may still come back (step 13b). Anything
  that treats 0 as out must wait for the defeat step, which matters for multi-ball matches.
- Every link from ruleset 4 shows the outdated notice (ADR 0022).
