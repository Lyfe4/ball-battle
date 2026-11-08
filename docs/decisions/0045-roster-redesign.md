# 0045: The roster redesign

- Status: Accepted (group 1 of 4 shipped; this ADR is updated with each group)
- Date: 2026-11-08
- Amends: ADR 0009 (no shock), ADR 0010 and 0028 (two favoured bands), ADR 0016 (no numbed rage,
  no stagger), ADR 0028 and 0041 (no interaction rules, no spark)
- Design: `docs/roster-redesign.md` (approved 2026-11-08 with the decisions in its section 0)

## Context

Counter pass 2 (`docs/counter-pass-2-phase-2.md`) showed that only binary mechanics sharpen a
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
| Pairs outside the final bands            | 40        | 35                  |
| (every counter given the lenient band)   | 18        | 16                  |
| Comebacks (loser once led by 25+) 10-20% | 14.6%     | 15.0%               |

Pairs outside the final bands, per ball of the group (ruleset 7 → 8): Storm 3 → 1, Quake 4 → 3,
Berserker 2 → 2, Vampire 6 → 4, Archer 4 → 4, Sniper 5 → 4, Boomerang 5 → 3. No ball of the group
fails more pairs than before.

Most of the 35 are kind counters below 66% whose sharp side comes in a later group: Thorns
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
  its edges, so it keeps wall shockwaves. It now beats the Necromancer (59%, every shockwave clears
  the skulls) and the Speedster (56%, the fastest ball runs into the most shockwaves). "Punish
  brawlers" holds only for the Speedster's rush: the Brawler stays even by design, and the Magnet
  still beats it (57%, its pull drags the Quake away from the walls). Quake over the Magnet stays
  the other way round, as decision 2 allows.
- **Wrong-way and soft pairs marked even by measurement:** Storm vs Vampire, Thorns, Titan,
  Necromancer and Bloom; Quake vs Archer, Sniper, Boomerang and Frost; Berserker vs Venom, Guardian
  and Bloom; Archer vs Frost, Inferno and Bomber; Boomerang vs Inferno; Sniper vs Titan. Each has a
  reason that says why it is even.
- **New favoured pairs:** the Magnet over the Archer and the Boomerang (its pull drags the frail
  shooter into a brawl), the Quake over the Speedster.

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
