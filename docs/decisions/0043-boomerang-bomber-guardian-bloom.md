# 0043: Batch 5: Boomerang, Bomber, Guardian, Bloom; returning projectiles, bombs, shields

- Status: Accepted
- Date: 2026-11-07
- Amends: ADR 0005 (a projectile that comes back), ADR 0006 (a zone that can be set off), ADR 0009
  (a `shielded` status), ADR 0010 (counter map)
- Amended by: ADR 0045 (the Guardian's armor and the Bloom's regrowth, group 2), ADR 0047 (the
  Guardian is replaced by the Spartan)

## Context

Batch 5 adds four balls. The brief gave each a starting idea and intended counters:

| Ball      | Starting idea                                                  | Intended favoured      | Intended unfavoured           |
| --------- | -------------------------------------------------------------- | ---------------------- | ----------------------------- |
| Boomerang | Throws a projectile that flies out and back, hitting both ways | (open)                 | (open)                        |
| Bomber    | Drops bombs that go off after a short, visible delay           | Speedster              | Guardian, Bloom               |
| Guardian  | A shield blocks the next hit completely, then regrows          | Sniper, Bomber, Chrono | Speedster, Venom, Necromancer |
| Bloom     | Regrows health while it isn't hit; any damage resets the timer | Sniper, Bomber, Archer | Speedster, Inferno, Storm     |

Three needed something the sim couldn't do: a projectile that comes back, a zone that goes off
when touched, and a hit that is taken by something other than health. As in batches 2-4, each
ball was prototyped and measured before its counters were chosen, and a planned counter the data
didn't support was replaced. A scratch sweep (one variant ball against the roster, 50-100 seeds a
slot order, every config in its own process) tested about 300 configurations before the full runs.

## The finding that shaped the batch

**Contact hits are rare in this game.** A median fight is about 18 s and a ball lands a contact hit
every 3-4 s, so nearly every ball "relies on a few big hits". Two of the starting ideas measure
very differently from how they read:

- **A full-block shield** with a 2.5 s regrow blocked almost every contact hit: the Guardian beat the
  Brawler 98%. With any regrow, a full block was worth the most against the hardest hitters (the
  Brawler, Ghost, Berserker, Vampire, Chrono and Frost were always its six best matchups), and
  nothing against poison, so its spread from Venom to the Brawler was 45-60 points. That fails the
  25/75 limit, makes the Guardian a second Brawler counter, and gives six existing balls a new loss.
  A shield that blocked only ability hits, or that cushioned a bump both ways, was worse.
- **Uncapped regrowth** made the Bloom beat every high-health ball in a long fight (Ghost 80-99%)
  and lose to every drip (Venom 90%+).

Both were capped (below), which keeps each idea readable and fits every hard rule.

## Decision

### 1. Returning projectiles (the Boomerang; reusable)

- `spawnProjectile` takes an optional `returnAfterTicks`. The projectile flies out, turns on that
  tick or at the first wall it reaches, then homes on its owner each tick (direction only, same
  speed) and is caught when it touches it (`projectileExpired`, reason `caught`).
- **A hit doesn't stop it.** It can hit each enemy ball once each way (`hitIds`, reset at the turn).
- **A minion stops it**, as it stops every projectile (ADR 0026). A defeated owner drops it.
- **Swept** like every projectile, against each ball's and minion's motion over the tick (ADR 0005),
  so no speed skips through it, out or back. It flies at 1,700 u/s, well above any ball, so it always
  gets home (an identity test).
- It lives in step 9b with the other projectiles (`projectiles/returning.ts`).

### 2. Zones that can be set off (the Bomber's bombs; reusable)

- `spawnZone` takes an optional `trigger: { radius, armTicks }`. From its arming tick, the first
  solid enemy ball whose swept path this tick touches the trigger circle makes the zone strike at
  once (`zoneStruck.triggeredBy`). Otherwise it strikes when its fuse runs out, like any zone.
- **Swept**, so a ball crossing a bomb inside one tick still sets it off. A unit test also checks
  the fastest ball moves less per tick than 0.6 of the reach of a bomb and a ball, so even an
  unswept test would catch it: the pass-through margin (ADR 0002) is untouched.
- **Balls only.** Minions pass over bombs, and so does a phased ball, which passes through balls and
  skulls alike (ADR 0026, 0028). The blast still catches both, and still clears skulls (ADR 0026).
  Letting skulls set bombs off was measured first: the skull died in the blast, which made the Bomber
  a Necromancer counter (5 points worse for the Necromancer), against the brief.
- It lives in step 10 with the other zones (`zones/trigger.ts`).

### 3. Shields (the Guardian; reusable)

- A new status, `shielded` (ADR 0009). While a ball has it, the next hit on it, **of any kind**
  (contact, projectile, strike, burn, skull, poison tick, a hook's damage), goes into the shield
  first. The shield soaks up to **10** of it and breaks; only the rest lands. A small hit is blocked
  whole; a big one is blunted.
- One rule in one place for both damage paths (`shield.ts`): contact damage in `combat.ts` and the
  `damage` action every other source goes through. The lethal-exchange tiebreak (ADR 0002) judges
  what is left of each hit.
- `shieldBroken` (ball, source, `soaked`) for the renderer; a status a strike would apply goes with
  a strike the shield took whole.
- The shield lasts until broken (a duration longer than any match). The Guardian's own `onTick` grows
  a new one 7.5 s after the last broke.
- **Why a soak and not a full block:** see above. Measured caps of 8, 10 and 12: 8 left the Guardian
  with no matchup it was favoured in; 12 made it a heavy-hitter counter again. 10 keeps the Brawler
  even (about 52%) and gives the shield a clear edge where it should have one.

### 4. Regrowth (the Bloom)

- Its own hooks only, no new sim mechanic: once it has gone 1.5 s without taking damage, it heals 2
  every 0.25 s, **up to 6 per rest**; any damage starts a new rest. The petals open while it regrows.
- A heal like any other, so **shock halves it** (the existing heal-cut rule, ADR 0009, 0028): the
  heal amount is even, so it halves exactly. The Bloom is named in the rule's cast, its description
  says so, and so does the Storm pair's reason.
- **Why a cap per rest:** without one, the Bloom out-healed every long fight. With it, it heals back
  a small hit whole and only a slice of a big one, which also sets it apart from the Guardian: the
  Guardian is weak to frequent hits, the Bloom to heavy ones.

### 5. The Boomerang and the Bomber, numbers chosen by measurement

- **Boomerang:** a boomerang every 130 ticks at the soonest, and only once the last one is home; led
  at the nearest target like an arrow; 6 a hit; turns after 22 ticks (about 620 units out).
  Staggered, it can't aim (the existing aim-held rule, ADR 0016): a due throw waits until the stagger
  ends, and the cue shows once. A faster boomerang (1,700, from 1,150) narrowed the gap between its
  worst matchup (the Speedster outruns slower throws) and the Brawler pair, which let both fit.
- **Bomber:** a bomb every 130 ticks where it is; arms after 18 ticks; a fuse of 3.5 s; a body of 36
  and a blast of 100; 11 a blast. A short fuse (1.5 s) made the blast hit whoever happened to be near,
  with no counter at all. A long fuse turns bombs into a field that lies in wait, so whoever covers
  the most ground runs into the most: the Speedster, as the brief wanted, and a bigger body sharpens
  it. The test that every ball has a counter then found one: the Archer, which needs to cross the
  bombs least.

## Counter map for batch 5

In full in `counter-map-batch-5.ts` (Boomerang, Bomber) and `counter-map-batch-5-defenders.ts`
(Guardian, Bloom and the new pairs). The favoured and unfavoured pairs:

| Pair                        | Favoured    | Mechanical reason (abridged)                                          |
| --------------------------- | ----------- | --------------------------------------------------------------------- |
| Speedster vs Boomerang      | Speedster   | It outruns the throw and closes in while the boomerang is away.       |
| Quake vs Boomerang          | Quake       | A shockwave staggers it: it can't aim, so it holds its throw.         |
| Titan vs Boomerang          | Titan       | The growing body meets it often; its light hits lose the trade.       |
| Necromancer vs Boomerang    | Necromancer | A nearer skull draws the throw, and a skull stops a boomerang.        |
| Boomerang vs Ghost          | Boomerang   | A boomerang in flight still hits it phased, and comes back.           |
| Boomerang vs Inferno        | Boomerang   | It throws from range and never has to cross the fire.                 |
| Bomber vs Speedster         | Bomber      | The fastest ball covers the most ground and runs into most bombs.     |
| Archer vs Bomber            | Archer      | It shoots from range, so it has the least need to cross the bombs.    |
| Guardian vs Vampire         | Guardian    | The shield soaks part of a heavy hit; lifesteal drinks what lands.    |
| Venom vs Guardian           | Venom       | The first poison tick breaks the shield, and the rest land.           |
| Thorns vs Guardian          | Thorns      | Its hard hits come back off the spikes.                               |
| Inferno vs Guardian         | Inferno     | The first burn breaks the shield, and the rest land.                  |
| Thorns vs Bloom             | Thorns      | Its hits come back off the spikes, and Thorns hits heavy.             |
| Venom vs Bloom              | Venom       | Poison ticks every half second, so it never rests to regrow.          |
| Bloom vs Boomerang          | Bloom       | Each boomerang hit is small, and it regrows it before the next.       |
| Bloom vs Necromancer        | Bloom       | Skulls come one at a time, and it regrows between them.               |
| Bloom vs Bomber             | Bloom       | Blasts come with gaps between, and it regrows in every gap.           |
| Boomerang, Bloom vs Vampire | Even        | Measured 56% for the Boomerang and the Vampire: inside the even band. |
| All other new pairs         | Even        | The Brawler (safe pick) included: even with all four.                 |

Replaced from the brief, because the measured mechanics said otherwise:

- **Guardian over Sniper, Bomber and Chrono; Speedster and Necromancer over the Guardian.** None
  appeared with any shield. The shield's real edge is against heavy hits that heal their owner (the
  Vampire) and its real counters are drips and reflections (Venom, Inferno, Thorns). The Speedster's
  bonus does land after the shield takes its hit, but that is about as much as every other ball
  gets back, so the pair is even.
- **Bloom over Sniper, Bomber and Archer; Speedster, Inferno and Storm over the Bloom.** Bloom over
  the Bomber held. A Sniper's or Archer's hit is bigger than a rest regrows, so those are even.
  Fire lets it rest between patches, so the Inferno is even. **The Storm is even (about 54%)**: shock
  does halve the Bloom's regrowth (the rule acts and is shown), but a rest only regrows 6, so halving
  it is worth little against a ball whose strikes are rare. Making regrowth a bigger share of the
  Bloom (so shock matters) pushed Venom over it past 75/25, so the brief's Storm counter was left
  even rather than forced with stats.
- **Bomber losing to the Guardian and the Bloom.** The Bloom held; the Guardian is even (a blast is
  bigger than the shield soaks).

No interaction rule was added. The Boomerang joins the aim-held rule's cast (a staggered ball can't
aim) and the Bloom joins the heal-cut rule's cast (shocked balls heal less); both rules were already
general. There are still three rules (`src/sim/rules.ts`).

### Existing balls

No existing ball's stats or ability changed. Net map changes per existing ball (new favoured, new
unfavoured): Speedster +1 −1, Necromancer +1 −1, Inferno +1 −1, Thorns +2, Venom +2, Archer +1,
Quake +1, Titan +1, Vampire −1, Ghost −1. Frost, the Storm and the Brawler are unchanged.

## Results

`pnpm balance 500`, all twenty-one balls. Every hard rule passes:

- every ball 46.0-52.6% (target 40-60%); the four new balls: Boomerang 47.4%, Bomber 48.5%,
  Guardian 48.0%, Bloom 51.9%;
- worst side 28.6% (unchanged), every pair inside its counter-map floor;
- draws 0.6%, median fight 18.1 s (both unchanged);
- worst ±5% sensitivity 14.0 points (unchanged);
- the Vampire heals 44.5% of its max health per match.

The designed pairs (the new ball's side unless named):

| Pair                     | Intended    | Result |
| ------------------------ | ----------- | -----: |
| Speedster vs Boomerang   | Speedster   |  70.8% |
| Quake vs Boomerang       | Quake       |  64.8% |
| Titan vs Boomerang       | Titan       |  64.5% |
| Necromancer vs Boomerang | Necromancer |  64.9% |
| Boomerang vs Ghost       | Boomerang   |  59.6% |
| Boomerang vs Inferno     | Boomerang   |  56.7% |
| Bomber vs Speedster      | Bomber      |  59.2% |
| Archer vs Bomber         | Archer      |  56.9% |
| Guardian vs Vampire      | Guardian    |  57.9% |
| Venom vs Guardian        | Venom       |  67.2% |
| Thorns vs Guardian       | Thorns      |  61.1% |
| Inferno vs Guardian      | Inferno     |  61.5% |
| Venom vs Bloom           | Venom       |  68.6% |
| Thorns vs Bloom          | Thorns      |  60.6% |
| Bloom vs Boomerang       | Bloom       |  69.0% |
| Bloom vs Necromancer     | Bloom       |  62.9% |
| Bloom vs Bomber          | Bloom       |  61.7% |

The Brawler's four new pairs: 54.6% / 51.2% / 52.3% / 47.3% for the new ball, all even.

**What fell short.**

- Five designed pairs sit between the floor and the target (58-62%) or within 2 points under the
  floor (passing as NEAR): Boomerang over the Ghost and the Inferno, Bomber over the Speedster,
  Archer over the Bomber, Guardian over the Vampire. None is a miss, but none reaches the 65-72%
  the brief aimed for. Each ball's spread had to fit inside the 25/75 limit with its designed
  losses, which kept its wins small.
- The Bomber and the Guardian have one favoured matchup each. Measured shapes warn for the
  Guardian (−4) and the Bloom (+6: it wins nine pairs by more than 55% and the map names three).
- Existing balls: no stats changed, but three shapes moved the wrong way by one matchup. The
  Vampire loses to the Guardian, the Ghost to the Boomerang, and the Necromancer gains a win (the
  Boomerang) and a loss (the Bloom), so its measured gap goes from −6 to −8. The Speedster gains
  the Boomerang and loses to the Bomber. Thorns, Venom, Archer, Quake, Titan and Inferno each gain
  a win.

## Rendering

- **Colours**, picked for CIELAB distance from the seventeen (all keep 3:1 on the floor, a mirror's
  lighter ball B too): Boomerang teal `#2dd4bf` (nearest the Titan, ΔE 26), Bomber magenta `#f91fce`
  (the Vampire, ΔE 40), Guardian cream `#fef3c7` (the Chrono, ΔE 31), Bloom pink `#f472b6` (the Ghost,
  ΔE 45).
- **Boomerang:** a bent bar. Its boomerang in flight is the same bar, outlined, spinning a full turn
  every 10 ticks.
- **Bomber:** a bomb with a flickering fuse spark. Its bombs lie under the balls: a dark body ringed
  in its colour (dim until armed), a gold fuse arc that burns down to the blast, and a faint dashed
  circle for the blast's reach. A blast is a warm flash with a ring sweeping out (strike style
  `blast`).
- **Guardian:** a heater shield with a pale band. Its shield is a bright gold ring hugging the ball,
  inside the status rings; when it breaks, its six pieces fly out and fade (they fade in place with
  reduced motion).
- **Bloom:** a flower whose five petals open wide while it rests and regrows and close into a bud
  the moment it is hit, so a viewer can see when it heals.
- **At small size** (under 24 CSS px of radius) the boomerang's bar thickens, the bomb's fuse
  thickens and its spark holds still, the shield's band goes, and the petals grow.

### Performance

Measured with `scripts/frame-timing.ts` (375 × 812, 2× density, 4× CPU throttling in headless
Chromium), now over the new balls' busiest fights: Bomber vs Speedster, Boomerang vs Necromancer,
Guardian vs Venom, Bloom vs Storm and Bomber vs Boomerang.

| Refresh               | Frames | Median |    p95 |    Max | Over 16.7 ms |
| --------------------- | -----: | -----: | -----: | -----: | -----------: |
| 60 Hz (native rAF)    |  5,819 | 0.1 ms | 0.2 ms | 2.4 ms |            0 |
| 90 Hz (fixed driver)  |  7,112 | 0.0 ms | 0.2 ms | 2.7 ms |            0 |
| 120 Hz (fixed driver) |  7,412 | 0.0 ms | 0.2 ms | 2.4 ms |            0 |

Lower than ADR 0034's table on the same script; timings depend on the machine and its load, so
the comparison that matters is no frame over budget at any rate. A bomb is three circles and an
arc, a shield one ring, a boomerang two strokes.

## Consequences

- **Positive:** three reusable mechanics (a projectile that comes back, a zone that can be set off, a
  status that takes a hit), each tested on its own and shown failing with its behaviour switched off.
  No interaction rule added; two general rules gained a ball each.
- **Positive:** the Brawler is even with all four new balls, and no existing ball's stats changed.
- **Negative:** the Guardian and the Bloom are milder than their briefs: a soak, not a full block,
  and a capped regrowth. A full block hard-countered every heavy hitter in a game where every hit is
  heavy.
- **Negative:** the brief's Storm counter to the Bloom is even, and the Guardian's Speedster and
  Necromancer counters didn't appear.
- Every link from ruleset 6 shows the outdated notice (ADR 0022).
