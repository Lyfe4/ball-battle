# 0045: The roster redesign

- Status: Accepted (all four groups shipped; group 4 with named gaps, see below)
- Date: 2026-11-08
- Amends: ADR 0009 (no shock), ADR 0010 and 0028 (one counter band, group 4), ADR 0016 (no numbed rage,
  no stagger), ADR 0028 and 0041 (no interaction rules, no spark)
- Design: `docs/roster-redesign.md` (approved 2026-11-08 with the decisions in its section 0)
- Amended by: ADR 0047 (the Guardian replaced by the Spartan, the Bloom's regrowth pauses after a
  hit, the known gaps)

## Context

Counter pass 2 (`docs/experiments/counter-pass-2-phase-2.md`) showed that only binary mechanics sharpen a
counter without dragging its even neighbours along, and that pair rules (shock against healers,
stagger against aimers, poison against rage) were the only binary mechanics the roster had. Each
rule was one more thing a player had to be told rather than could see. The redesign
(`docs/roster-redesign.md`) instead gives every ball one clear thing that works the same on any ball,
a kind of hit or a kind of movement, so counters are what two balls already do.

Approved with six decisions (the design doc's section 0): two favoured bands, wrong-way counters
made to work or marked even, nothing above 80 or under 20, true and obvious reasons, real edges for
the Berserker, Bomber and Quake from their own ability, and plain descriptions. It ships in four
groups, one pull request each, each gated on: every hard rule from today for the whole roster,
fewer pairs outside the new bands than ruleset 7 with no ball of the group worse than before, and
comebacks of 10-20%.

## Decision: the two bands

Every favoured pair in the map names its band (`band` on `CounterEntry`, checked by a test):

- **kind** (a kind of hit decides it: spikes against bumps, a rewind against a big hit, lifesteal
  against shots, a phased ball against a projectile already flying): target 72-78%, floor 66-80%;
- **movement** (speed, size, range, a pull, minions in the way): target 62-72%, floor 58-76%;
- **even**: target 45-55%, floor 42-58%, both sides.

`pnpm balance` checks movement and even pairs against these floors now. A kind counter's floor stays
at 58-80% (`KIND_FLOOR_DURING_REDESIGN`) until group 4, because many kind counters need a ball from a
later group (the Chrono's repeatable rewind, the Guardian's armor, the Ghost's fade) before they can
reach 66%. The run also prints how many pairs are outside the final bands, the count each group must
bring down, and checks comebacks (the ball once behind by a quarter of its health wins 10-20% of
games), which `pnpm balance` did not measure before.

Ruleset 7 is the baseline, labelled the same way: its rule counters (shock, stagger, numbed rage,
phasing), spikes, rewind, shield and regrowth pairs are kind; the rest movement.

## Group 1: rules out (ruleset 8)

The Storm, Quake, Berserker, Vampire, Archer, Sniper and Boomerang: every ball that applied,
suffered or named one of the three rules. The rules go with them: the `shocked` and `staggered`
statuses, the `ruleApplied` action and event, the `healReduced` event, `src/sim/rules.ts`, the spark
(the rule cue), its legend line, its hints and its words in "How it was won", the shock and stagger
rings, and the Berserker's "numbed rage" look. No rule remains, so the spark has nothing to mark and
is gone rather than kept for later.

### What each ball does now

| Ball      | Now                                                                | Was (ruleset 7)                                                               |
| --------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Storm     | One big strike (36, radius 140) every 1.75 s after a 0.9 s warning | 31 every 2.2 s (radius 170, 0.8 s); strike and touch shocked; stagger held it |
| Quake     | Every wall hit sends a shockwave (11, radius 200) that only hurts  | Shockwave (12, radius 180) staggered: no aim for 4.5 s                        |
| Berserker | 86 health, bumps 18, up to 7 more as it is hurt; nothing numbs it  | 93 health, bumps 16 plus up to 9; poison numbed rage                          |
| Vampire   | Heals half of what its bumps deal; 54 health                       | 45% of all it dealt, cut in half while shocked; 58                            |
| Archer    | Unchanged arrows; 48 health; a hit never delays its aim            | 50 health; stagger held its arrow                                             |
| Sniper    | Unchanged shot; a hit never breaks its lock                        | Stagger broke the lock                                                        |
| Boomerang | Unchanged throw; a hit never delays it                             | Stagger held its throw                                                        |

The Storm hits harder and more often but in a smaller circle with a longer warning, so the fastest
balls leave it and the slowest and biggest don't: its edge is now movement, not a rule.

### Measured (500 seeds per slot order, whole roster)

| Gate                                     | Ruleset 7 | Ruleset 8 (group 1) |
| ---------------------------------------- | --------- | ------------------- |
| Each ball 40-60%                         | 46.0-52.6 | 46.3-53.0           |
| No side of any pair under 25%            | 28.6      | 28.6                |
| Median fight 12-30 s                     | 18.1 s    | 18.0 s              |
| Draws under 5%                           | 0.6%      | 0.6%                |
| Sensitivity (±5% health), fail above 20  | -         | 14.0 pts            |
| Pairs outside the final bands            | 40        | 34                  |
| (every counter given the lenient band)   | 18        | 15                  |
| Comebacks (loser once led by 25+) 10-20% | 14.6%     | 15.0%               |

Pairs outside the final bands, per ball of the group (ruleset 7 → 8): Storm 3 → 1, Quake 4 → 2,
Berserker 2 → 2, Vampire 6 → 4, Archer 4 → 4, Sniper 5 → 4, Boomerang 5 → 3. No ball of the group
fails more pairs than before.

Most of the 34 are kind counters below 66% whose sharp side comes in a later group: Thorns
(group 3) against the Berserker, Titan and others; the Chrono's repeatable rewind (group 2) against
the Storm and Sniper; the Ghost's fade and the Guardian's armor (group 2).

### What did not work, and what is left

- **The Berserker's "burst beats sustain" is not reachable against today's Guardian and Bloom.**
  A bigger rage share (bumps 13, rage 12) made it lose to them harder (25% and 31%): rage needs the
  Berserker hurt first, and a sustain ball keeps it at full rage longer than it can use. A heavier
  base hit (18, rage 7) brings it level with the Vampire (45/55, was 40/60) and the Bloom and
  Guardian (46-47%), but no setting made it win them. They stay even in the map until group 2 gives
  the Guardian armor (a big hit loses only a little to it) and the Bloom steady regrowth, where the
  pair is tuned again.
- **Thorns over the Berserker** ("its raging bumps hurt it back") is the Berserker's only designed
  weakness and measures 53.2%: below the 58% floor `pnpm balance` checks while the redesign ships,
  so the full run reports one MISS (the CI run's noise allowance passes it). Thorns is tuned in
  group 3; a slower Berserker only moved its losses to the shooters.
- **The Quake:** shockwaves from bumps as well as walls ("every bounce") were measured and blurred
  its edges, so it keeps wall shockwaves. It beats the Necromancer (59%, every shockwave clears the
  skulls). "Punish brawlers" did not come true: the Speedster's rush runs into the most shockwaves,
  but only to 56%, so the pair is even (a favoured Quake also gave the Speedster an eighth Weak vs
  row, more than a manual entry fits on a laptop); the Brawler stays even by design, and the
  Magnet still beats the Quake (57%, its pull drags it away from the walls). Quake over the Magnet
  stays the other way round, as decision 2 allows. Group 4 revisits the Quake with the Magnet and
  Speedster.
- **Wrong-way and soft pairs marked even by measurement:** Storm vs Vampire, Thorns, Titan,
  Necromancer and Bloom; Quake vs Speedster, Archer, Sniper, Boomerang and Frost; Berserker vs Venom, Guardian
  and Bloom; Archer vs Frost, Inferno and Bomber; Boomerang vs Inferno; Sniper vs Titan. Each has a
  reason that says why it is even.
- **New favoured pairs:** the Magnet over the Archer and the Boomerang (its pull drags the frail
  shooter into a brawl).

### Other effects

- `pnpm balance` labels each favoured pair with its band, counts the pairs outside the final
  bands, and checks comebacks.
- The bot reads the map, so its picks change with it (ruleset 8).
- Phone frame timing (`scripts/frame-timing.ts`: 375 × 812, 2× density, 4× CPU throttling in
  headless Chromium, over Storm vs Necromancer, Quake vs Bomber, Boomerang vs Necromancer, Archer
  vs Inferno and Sniper vs Bomber): no frame over 16.7 ms at 60, 90 or 120 Hz.

  | Refresh               | Frames | Median |    p95 |    Max | Over 16.7 ms |
  | --------------------- | -----: | -----: | -----: | -----: | -----------: |
  | 60 Hz (native rAF)    |  5,465 | 0.0 ms | 0.1 ms | 2.3 ms |            0 |
  | 90 Hz (fixed driver)  |  6,707 | 0.0 ms | 0.1 ms | 2.2 ms |            0 |
  | 120 Hz (fixed driver) |  6,912 | 0.0 ms | 0.1 ms | 2.2 ms |            0 |

- Series measurements (`docs/series-measurements.md`) moved by about a point at most with measured
  odds; with the map's odds, fewer favoured pairs make choices matter a little less against the Easy
  and Hard bots in Showdown.

## Group 2: the kind-of-hit defenders (ruleset 9)

The Chrono, Guardian, Ghost, Bloom and Venom. One universal definition query replaces the shield:
`incomingDamageOf(self, amount, tick)` ("what a hit does to me"), applied on both damage paths
(`src/sim/defence.ts`) and shown by a `hitReduced` event. The `shielded` status, `SHIELD_SOAK`,
`shield.ts` and the `shieldBroken` event are gone. Timed phasing stays in the engine (`phasedOf`,
tested with a test-only ball) though no roster ball phases now.

### What each ball does now

| Ball     | Now                                                                                     | Was (ruleset 8)                                 |
| -------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Chrono   | Rewinds an ability hit of 20+ (a shot, a strike) or a knockout, then recharges 10 s; 61 | Rewinds one knockout a match; 78 health         |
| Guardian | Armor: every hit does 1 less (never under half); 74 health, bumps 22                    | A shield soaks up to 10 of a hit, regrows 7.5 s |
| Ghost    | Fades 56 ticks after a hit, at most once every 205; nothing hurts it then; 67, bumps 24 | Phases 1 s in 4; spectral hit                   |
| Bloom    | Heals 1 every 26 ticks, all match; 48 health, bumps 21                                  | Regrows up to 6 after 1.5 s without a hit; 68   |
| Venom    | Bumps poison: 3 ticks of 5, 34 ticks apart; 73 health                                   | 2 every 30 ticks for 4.5 s; 76 health           |

On screen: a gold ring bursts in pieces whenever a hit glances off a defence (armor took part of it,
or a fade took all of it); a faded Ghost is see-through with a broken outline; the Chrono's clock
stops and dims while it recharges; the Bloom's flower stays open and every regrowth is the heal
pulse; poison keeps its ring of dots. Hints read "Armor!", "Fade!", "Rewind!", "Regrowth!".

### Why the fade has a wait

A fade on every hit was all or nothing against a steady rhythm: longer than the poison's interval
it missed every other tick (Ghost vs Venom 95-99%), shorter it missed none (about 50%). The fade
waits 205 ticks before it can come again, so it misses about one tick in six of a steady drip and
the counter lands in the band (72%). The same wait keeps the Inferno's overlapping burns from
crushing it (Ghost vs Inferno 64%, 84% in the prototype). Venom's poison became fewer, bigger
ticks (5 every 34) so armor takes a share (a fifth) rather than half of each.

### Measured (500 seeds per slot order, whole roster)

| Gate                                     | Ruleset 8 | Ruleset 9 (group 2) |
| ---------------------------------------- | --------- | ------------------- |
| Each ball 40-60%                         | 46.3-53.0 | 47.0-53.5           |
| No side of any pair under 25%            | 28.6      | 25.1                |
| Median fight 12-30 s                     | 18.0 s    | 17.0 s              |
| Draws under 5%                           | 0.6%      | 0.6%                |
| Sensitivity (±5% health), fail above 20  | 14.0 pts  | 15.6 pts            |
| Pairs outside the final bands            | 34        | 30                  |
| Comebacks (loser once led by 25+) 10-20% | 15.0%     | 16.6%               |

Pairs outside the final bands, per ball of the group (ruleset 8 → 9): Chrono 5 → 5, Guardian
3 → 4, Ghost 8 → 5, Bloom 5 → 4, Venom 2 → 1. **The Guardian fails one pair more than before**, which
misses the per-ball gate strictly. Its fourth pair sits on the line (Boomerang vs Guardian 58.0%
against an even floor of 58); one less health moved a different pair over it (Berserker vs Guardian
41.5%), and its shape always leaves one pair near an edge. Merged by the owner's decision: the miss is
within noise, the roster fails fewer pairs overall (34 to 30) and every hard rule passes.

### What did not work

- **Berserker's "burst beats sustain" (decision 5) is not reachable with simple numbers.** Inside its
  identity (the most health, softer than the Brawler even at the edge of defeat) it loses to the new
  Bloom (33%); a glass-cannon Berserker (66 health, bumps 19 + rage 16) only reached even (Bloom
  53%, Guardian 56%) and broke both identity rules. It keeps ruleset 8's numbers; Berserker vs
  Guardian and vs Bloom are even.
- **Poison and fire beating rewind, and regrowth beating chip, reach only partway.** A Bloom sharp
  enough to beat Venom 66%+ beat the Inferno past the 25% hard floor (79%), so Bloom vs Venom is even
  (55%). Chrono's small-hitter pairs sit at 58-64%; only Venom (67%) and Inferno (69%) reach the
  kind band, while the Storm (73%) and Sniper (75%) are in it.
- **New honest edges by measurement:** the Guardian over the Speedster (armor takes a bit off both
  its bump and its speed hit), the Titan over the Bomber (needed so the Bomber keeps a weak
  matchup), the Ghost over the Quake and Boomerang (the next shockwave, the return, misses), the
  Berserker over the Ghost (each raging hit lands whole). The Vampire's one edge was over the old once-a-match Chrono; against the
  rechargeable rewind it measures 51% (48% in CI's 150 seeds, a clear miss), so Vampire vs Chrono is
  even and the Vampire's edge is now over the Titan (55%, a movement counter by size: a bigger
  target, so more of its bumps land and heal it). Thorns over the Berserker stays a full-run MISS
  (53%) inside CI's allowance, as in group 1.

## Group 3: chip and hazards (ruleset 10)

The Inferno, Necromancer, Bomber, Frost and Thorns, and a new rule for the whole counter map.

### The counter rule: a counter has to win enough

A pair counts as a counter only if it actually wins enough. A kind counter is held to its final floor
of 66-80% now (`KIND_FLOOR_DURING_REDESIGN` is gone), a movement counter to 58-76%. A designed counter
that measures 58% or less is marked even: no ▲▼, an even reason, and the bot reads it as even. One
stuck between 58% and its floor is pushed into its band or tuned to even. Applied to the whole map
first, it turned 21 favoured pairs even (among them Vampire over Titan 55% and Thorns over Berserker
53%). Under it ruleset 9 fails 24 pairs, not 30.

Five pairs with no ball of this group land in no band at all, too high to be even and too low to be
a kind counter: Archer vs Vampire 62.7%, Guardian vs Speedster 62.1%, Boomerang vs Chrono 62.1%,
Bloom vs Guardian 61.1% and Ghost vs Boomerang 60.8%. They are marked even and left failing for group
4's whole-map pass, by the owner's decision.

Balls left without a counter on one side are listed in `scripts/counter-map.ts`
(`WITHOUT_FAVOURED`, `WITHOUT_UNFAVOURED`), so losing a ball's last counter is a decision: no
favoured matchup for the Vampire, Storm, Berserker, Quake and Boomerang; no unfavoured one for the
Vampire, Frost, Berserker, Ghost, Titan and Guardian. With fewer counters, choices move the odds in
fewer lineups: the reveal analysis now expects three quarters of lineup pairs to move by 3 points or
more, not four fifths (79% and 76% measured).

### What each ball does now

| Ball        | Now                                                                           | Was (ruleset 9)                             |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| Inferno     | A patch every 26 ticks, radius 62, burns 3 every 13 for 130; never stacks; 75 | Every 20, radius 55, 3 every 15 for 120; 70 |
| Necromancer | One skull, back within 55 ticks of popping; health 70                         | One skull, every 88 ticks; 66               |
| Bomber      | Bomb body 44, blast 12; bumps 11, health 69                                   | Body 36, blast 11; bumps 13, health 70      |
| Frost       | A slowed ball loses 45% of its speed                                          | 30%                                         |
| Thorns      | Reflects 36% of a bump; bumps 18, health 78                                   | 35%; bumps 19, health 77                    |

**One owner's fire never stacks.** The Inferno's trail overlapped up to six patches, each burning on
its own rhythm, so a ball inside several took several burns, and that capped how strong armor, fade
and regrowth could be (group 2). Now one owner's lasting zones never stack: a ball they all overlap on
a tick is burned once (`src/sim/zones/resolve.ts`, a rule of lasting zones, not of two balls), and
the Inferno drops a patch every two burns so the whole trail burns on one beat. On screen the trail
flares together, and a ball in the fire takes one burn per beat however much fire it stands in. The
steady drip makes the defenders' counters land: the Guardian 71.9% and the Bloom 67.4% (both kind).

**The Necromancer's skull is nearly always out.** A skull that pops or is shot is soon back, so it
draws aimed attacks all match: it beats the Archer 73.3%, the Boomerang 69.4% and the Sniper 60.5%.
Two skulls at once crushed the Archer (85-98%); one skull that comes back quickly keeps the shooters
inside the movement band. It loses to the Magnet (61.2%), the Inferno (65.0%) and the Bloom (64.5%,
kind, near the floor).

**The Frost's slow bites.** A slowed ball crawls, which cuts what speed feeds: it beats the Speedster
67.5% and the Quake 61.4% (a new counter: slowed, it hits fewer walls, so it sends fewer
shockwaves). Frost vs Magnet is even (57.5% / 40.9%), with plain wording.

**Thorns** beats the Brawler 68.5% and the Magnet 67.3%, and loses to the Archer (64.2%, near), the
Sniper 66.3%, the Venom 70.1% and the Inferno (65.5%, near): everything that never touches it.

### What did not work

- **Thorns over the Titan and the Berserker** (aim 2): reflection scales with the hit, and the Titan,
  Frost, Guardian and Chrono all bump for about 22, so the spikes lift them together. Either the
  Titan and Berserker stay under 66% or the Frost and Guardian go over 58%; both pairs are even. The
  five balls that never touch Thorns sit within a few points of each other, so no setting puts the
  Archer above 64% and the Boomerang under 60% (59.9%, a full-run MISS as an even pair).
- **Bomber over the Necromancer** (decision 2): a blast clears the skull, but it is soon back, and
  skulls setting off bombs added only 2 points. It measures about 52-55%: even. The Bomber keeps one
  edge (Speedster 58.4%) and one weakness (Titan 60.4%).
- **The Berserker has no real edge** (aim 4). Its best pairs with this group, the Necromancer (57.9%)
  and the Speedster (60.7%), are below a kind counter's floor. Rage 6 instead of 7 removed one
  failing pair but sent Berserker vs Bloom to 68% in CI's sample, so it keeps ruleset 9's numbers.
- **The Inferno's other pairs:** the Ghost's fade misses only part of a steady drip (60.5%, even, a
  full-run MISS as in ruleset 9). Over the Titan (56.3%) and under the Speedster (57.8%) the fire's
  edges are 58% or less: even. Over the Thorns (65.5%) is near the kind floor.
- **A config with 23 failing pairs** (one under ruleset 9) had the Inferno's fire reach less far and
  the Berserker's rage at 6, but in CI's 150 seeds the Inferno fell to 22.7% against the Bloom (under
  the 25% hard floor) and the Berserker to 31.7%. The shipped config fails 25 pairs; the owner
  accepted it as within noise of 24, since every hard rule and CI's balance check pass.

### Measured (500 seeds per slot order, whole roster)

| Gate                                     | Ruleset 9 | Ruleset 10 (group 3) |
| ---------------------------------------- | --------- | -------------------- |
| Each ball 40-60%                         | 47.0-53.5 | 47.0-53.5            |
| No side of any pair under 25%            | 25.1      | 25.1                 |
| Median fight 12-30 s                     | 17.0 s    | 17.3 s               |
| Draws under 5%                           | 0.6%      | 0.6%                 |
| Sensitivity (±5% health), fail above 20  | 15.6 pts  | 15.6 pts             |
| Pairs failing the bands, new rule        | 24        | 25                   |
| Favoured pairs (inside their target)     | 59        | 38 (16)              |
| Comebacks (loser once led by 25+) 10-20% | 16.6%     | 16.5%                |
| CI's balance check (150 seeds)           | passes    | passes               |

Pairs failing the bands under the new rule, per ball of the group (ruleset 9 → 10): Inferno 1 → 2,
Necromancer 1 → 1, Bomber 0 → 1, Frost 2 → 2, Thorns 5 → 3, Berserker 3 → 3. The Inferno's second is
over the Thorns at 65.5% (0.5 under the floor) and the Bomber's is vs the Chrono at 58.3% (0.3 over):
both within a point of the line.

### Other effects

- `pnpm balance` holds kind counters to 66%; the summary's below-target section says so.
- The bot reads the map, so its picks change with it (ruleset 10); `docs/series-measurements.md`.
- Phone frame timing (`scripts/frame-timing.ts`, over Inferno vs Necromancer, Bomber vs
  Necromancer, Frost vs Speedster, Thorns vs Brawler and Inferno vs Bloom): no frame over 16.7 ms.

  | Refresh               | Frames | Median |    p95 |    Max | Over 16.7 ms |
  | --------------------- | -----: | -----: | -----: | -----: | -----------: |
  | 60 Hz (native rAF)    |  7,035 | 0.0 ms | 0.2 ms | 2.5 ms |            0 |
  | 90 Hz (fixed driver)  |  8,489 | 0.0 ms | 0.1 ms | 2.3 ms |            0 |
  | 120 Hz (fixed driver) |  8,731 | 0.0 ms | 0.2 ms | 2.4 ms |            0 |

## Group 4: the last reworks and the final counter rule (ruleset 11)

The Berserker, Titan, Quake, Bomber and Vampire become kinds of hit of their own; Venom, Brawler,
Magnet and the defenders are retuned; and the whole map is held to one final counter rule. Proposal
and prototype: `docs/experiments/roster-redesign-group-4.md`, approved 2026-11-09 with the decisions below.

### The final counter rule

- **A counter (▲ ▼) wins 62% or more**, aiming for 65-72%, never above 78%. The kind and movement
  bands are gone: one band for every counter.
- **58-62% is the grey zone**: shown as even, no ▲ ▼ and no counter reason. `pnpm balance` counts
  and warns about it, never fails it: a 4-point band in the busiest part of the spread catches about
  a sixth of the pairs whatever the numbers are.
- **Even is everything else**, ideally 45-55%.
- **Every ball wins 45-55% overall; no side of any pair under 22%.**
- **Shape:** every ball has 2-4 counters it wins and 2-4 it loses, the counts within 1, except the
  even picks and the known gaps below. `pnpm balance` enforces it by name
  (`SHAPE`, `EVEN_PICKS`, `SHAPE_EXCEPTIONS` in `scripts/counter-map.ts`): any other ball going
  off-shape fails, and so does a named one beyond its allowance. A full run judges the measured
  shape; CI's 150-seed run, too noisy to call a pair near 62%, judges the map's.

The map is labelled from the full run: every pair at 62% or more is a counter, everything else even.

### What each ball does now

| Ball      | Now                                                                                               | Was (ruleset 10)                                   |
| --------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Berserker | Every hit it takes stores a rage (up to 3); its next bump lets out 3 a rage. 86 health, bump 18.2 | Bumps 18 plus up to 7 as it lost health; 86 health |
| Titan     | Grows as before; its bumps grow with it, from 14.5 to 1.85 times that at full size. 77 health     | Grew bigger and heavier, bumps 22; 85 health       |
| Quake     | A small, wide shockwave (6, radius 250) on a wall hit, at most every 0.2 s; 71 health             | 11, radius 200, at most every 0.5 s; 70 health     |
| Bomber    | One big bomb (blast 26) every 3.7 s; 62 health                                                    | Blast 12 every 2.2 s; 69 health                    |
| Vampire   | Heals 90% of what its bumps deal; 39 health, bump 23                                              | Half; 54 health, bump 22                           |
| Venom     | Bumps 11 on 66 health (poison unchanged)                                                          | Bumps 8 on 73 health                               |
| Guardian  | Armor 3 (still never under half a hit); 59 health                                                 | Armor 1; 74 health                                 |
| Ghost     | Fades at most every 145 ticks; 63 health                                                          | Every 205; 67 health                               |
| Frost     | Slow lasts 4.5 s; 79 health                                                                       | 3 s; 80 health                                     |
| Thorns    | Reflects 37%; 80 health                                                                           | 36%; 78 health                                     |
| Storm     | Strike 40; 74 health                                                                              | 36; 79 health                                      |
| Others    | Boomerang hits 7 on 52 health; Magnet 68 (pull 0.025); Bloom 49 health                            | 6 on 57; 69 (0.03); 48                             |

The Brawler is unchanged and now has the hardest plain bump only: a raging Berserker and a grown
Titan can hit harder (an identity rule, changed by the owner's decision). The Chrono now rewinds the
Bomber's blast, a big hit.

On screen: the Berserker's cracks show its stored rage (one when calm, more and heavier with every
hit it takes, closing again when its bump lets the rage out) and its hint reads "Rage!" when it does;
the Titan's visor widens as it grows and hits harder; the Quake's rings are thinner and come often;
the Bomber's blast flashes brighter with a wider ring.

### Why Venom bumps harder

Armor and rage both feed on many small hits, so Venom's poison ticks made the Guardian (80%) and the
Berserker (78%) crush it. Fewer, bigger ticks were tried and failed: the Ghost's fade then swallowed
both ticks after a bump (83%). Moving its damage into the bump instead (11, not 8) cut both to 74%
while poison stays its edge over the rewind.

### The known gaps (exceptions to the shape, by the owner's decision)

Numbers alone could not give every ball 2-4 counters each way. 210 pairs spread continuously, many
sit at 60-62%, and every tuning step that pushed one ball's pair over 62% pushed a neighbour's
back (three optimizer runs and four coordinated rounds plateaued at 5-8 balls off-shape). The owner
accepted the closest config with these named exceptions, each a gap for a future ball to fill
(`docs/vision.md`, "Gaps for future balls"):

- **The Storm, Titan and Bomber have one counter on a side.** Only the rewind blunts one big strike
  or blast, and only spikes and fire hold the grown Titan.
- **Venom has one win** (the Chrono): poison's small ticks beat only what can't answer small hits.
- **The Berserker and Bloom beat up to five balls:** both beat nearly everything that deals many
  small hits.
- **The Brawler and Magnet are the even picks:** the Brawler beats only the Ghost (a fade can't save
  it from a plain heavy bump) and loses only to Thorns; the Magnet loses only to Thorns. The Magnet
  is the candidate to replace when balls are next added.

### Measured (500 seeds per slot order, whole roster)

| Gate                                     | Ruleset 7 | Ruleset 10 (group 3) | Ruleset 11 (group 4) |
| ---------------------------------------- | --------- | -------------------- | -------------------- |
| Each ball overall                        | 46.0-52.6 | 47.0-53.5            | 45.6-53.5 (45-55)    |
| Weakest side of any pair                 | 28.6      | 25.1                 | 24.4 (22)            |
| Median fight 12-30 s                     | 18.1 s    | 17.3 s               | 16.2 s               |
| Draws under 5%                           | 0.6%      | 0.6%                 | 0.5%                 |
| Sensitivity (±5% health), fail above 20  | -         | 15.6 pts             | 11.7 pts             |
| Counters (62% or more)                   | -         | 31                   | 51                   |
| Balls missing a side (no win or no loss) | -         | 9                    | 1 (the Magnet)       |
| Grey-zone pairs (58-62%, warned)         | -         | -                    | 34                   |
| Every ball's shape (with the gaps)       | -         | -                    | passes               |
| Comebacks (loser once led by 25+) 10-20% | 14.6%     | 16.5%                | 18.6%                |
| Reveal analysis (choices move the odds)  | 80%+      | 79% / 76%            | 89% / 87% (80)       |

The reveal analysis's two thresholds are back at four fifths. Each ball's counters with their win
rates are in `docs/balance-summary.md`.

### What did not work

- **Fewer, bigger poison ticks** for Venom (2 of 8): the Ghost's fade covered both ticks after a
  bump (83%), so Venom's damage moved into its bump instead.
- **A longer, rarer fade** for the Ghost, to sharpen it against drips and soften it against heavy
  bumps: all or nothing against Venom again (78-87%), or no wins at all.
- **A longer Storm warning**, so fast balls leave the circle: balls don't steer, so no ball
  systematically gets out; the Storm keeps its one loss to the rewind.
- **A bigger blast to make the Guardian beat the Bomber:** a big blast loses little to armor, so
  the Bomber beats the Guardian instead and keeps its one loss to the rewind.
- **Thorns over the Berserker:** reflection lifts every bumper together (as in group 3); the pair
  sits in the grey zone (61%).

### Other effects

- The bot reads the map, so its picks change with it (ruleset 11). Series measurements
  (`docs/series-measurements.md`): with measured odds the player's choices are worth more than at
  ruleset 10 (Reveal gaps 11-12 points, from 9-10); with the map's odds Showdown against the Easy
  and Hard bots moves fewer lineup pairs (46%, from 61%).
- Phone frame timing (`scripts/frame-timing.ts`, over Berserker vs Venom, Titan vs Bloom, Quake vs
  Chrono, Bomber vs Speedster and Vampire vs Storm): no frame over 16.7 ms.

  | Refresh               | Frames | Median |    p95 |    Max | Over 16.7 ms |
  | --------------------- | -----: | -----: | -----: | -----: | -----------: |
  | 60 Hz (native rAF)    |  5,730 | 0.0 ms | 0.2 ms | 2.4 ms |            0 |
  | 90 Hz (fixed driver)  |  6,853 | 0.0 ms | 0.2 ms | 2.3 ms |            0 |
  | 120 Hz (fixed driver) |  7,049 | 0.0 ms | 0.2 ms | 2.5 ms |            0 |

- "How it was won" now always ends with the finish, also when the knockout is the round's biggest
  hit (a bug the Storm's bigger strike showed).
