# 0016: Counter density: status resistance, numbed rage, staggered

- Status: Accepted
- Date: 2026-11-05
- Amends: ADR 0012 (Frost), 0014 (Venom), 0015 (Berserker, Sniper, Quake)
- Amended by: ADR 0045 (numbed rage and stagger are removed with every interaction rule)

## Context

After batch 2 the counter map was uneven (`pnpm balance 500`):

| Ball      | Favoured               | Unfavoured                       |
| --------- | ---------------------- | -------------------------------- |
| Speedster | Archer, Storm, Sniper  | Vampire, Frost, Berserker, Quake |
| Thorns    | Brawler                | Archer, Storm, Venom, Sniper     |
| Archer    | Vampire, Thorns        | Speedster                        |
| Storm     | Vampire, Frost, Thorns | Speedster                        |
| Frost     | Speedster, Quake       | Storm                            |
| Venom     | Thorns                 | Vampire                          |
| Berserker | Speedster              | Vampire                          |
| Sniper    | Thorns                 | Speedster                        |
| Quake     | Speedster              | Frost                            |

The goal for a best-of-3 guessing game: every ball but the Brawler has at least two favoured and
two unfavoured matchups, mostly among the thin balls; then ease the Speedster hub and the Thorns
imbalance. ADR 0010 and 0015 apply: a counter needs a mechanical reason; stats only tune its
strength.

## What the measurements showed

Four pairs already leaned (Berserker vs Archer 54.9, Quake vs Venom 55.7, Berserker vs Venom 55.1,
Archer vs Sniper 53.6). Each was checked for a mechanism before promoting it:

- **Ablation** (each ball's mechanic switched off, stats kept, 500 seeds against the roster) was
  mostly uninformative: a ball without its ability loses almost everything, so the differences
  sit on the flat end of the win-rate curve.
- **Per-opponent mechanics** (a one-off diagnostic: ability hit rate, contacts per second and
  damage per second against each opponent) were clearer. The Quake's shockwaves hit 13% of the
  time against every ball, Venom included; its edge over Venom is a small damage-per-second
  advantage stretched by Venom's long fights (longer fights make small edges steeper, ADR 0004).
  The Berserker's edge over the Archer is its health pool, and rage helps it _less_ against the
  Archer than on average. Neither is a mechanic specific to the pair, so **neither was
  promoted**, and Archer vs Sniper (arrows lead, shots don't, against every target alike) wasn't
  either.
- Arrows land most often on the slowest ball (75% against the Frost, 72-74% against most, 65%
  against the Speedster), the effect ADR 0012 already noted for the Storm and the Archer. That one
  is a mechanism.

So most new counters needed small, pair-specific mechanics, in the pattern of ADR 0009 (shock cuts
heals, and only the Vampire heals): one ball's effect meets one other ball's mechanic, so only
that pair moves. Every such change was prototyped and measured on its pair before it was built.

## Decision

### 1. Status resistance (a definition field)

`BallDefinition.statusResistance` is the share of a status's duration a ball keeps, per kind: 0.8
wears it off 20% sooner, 0 makes the ball immune (nothing is applied and no event is emitted).
It is read in the `applyStatus` action, the one path every status takes (zones included, ADR 0009),
so it can't be bypassed. The requested duration is still validated first; a resisted duration is
rounded but never below 1 tick; a share outside 0-1 throws.

- **The Berserker can't be slowed** (`slowed: 0`): rage burns off the cold. Only the Frost slows,
  so this moves exactly one pair: **Berserker over the Frost**.
- **The cold wears poison off the Frost sooner** (`poisoned: 0.8`): Venom's eight poison ticks
  become six. Only Venom poisons: **Frost over Venom**. (0.9 gave seven ticks and 57.8%, 0.6 gave
  85%; 0.8 is the step that lands in band.)

### 2. Poison numbs rage

A poisoned Berserker keeps only 20% of its rage bonus (`POISON_NUMB` 0.8, in its
`contactDamageOf`). Only Venom poisons and only the Berserker rages: **Venom over the Berserker**.
The bonus is cut, never the base hit. Measured: numb 0.5 → 54%, 0.7 → 58%, 0.8 → 60%, 1 → 66%.

### 3. Staggered: shockwaves stop a ball aiming

A new status kind, `staggered`. Every ball a Quake shockwave hits is staggered for 210 ticks
(3.5 s; shockwaves hit about once every 9 s, so a short stagger did nothing). A staggered ball
can't aim:

- the **Archer** holds a due arrow, the **Storm** holds a due strike (a zone already called still
  strikes), until the stagger ends;
- the **Sniper**'s lock in progress breaks without a shot, and it locks again once the stagger
  ends.

Balls that don't aim ignore it. So it moves exactly three pairs: **Quake over the Archer, the Storm
and the Sniper**. It is drawn as a broken ring of pale-stone arcs, outside the other status rings.
Measured against stagger length (300 seeds): Quake vs Sniper 59 / 65 / 68 at 60 / 180 / 240
ticks, vs Archer 52 / 60 / 62, vs Storm 49 / 54 / 59. Sniper shots staggering as well was
measured and dropped: shots hit 16% of the time, too rarely to matter.

Considered and rejected: Thorns immune to slow (Thorns vs Frost only +3.7), Thorns reflecting
contact statuses (Thorns beat Venom 99.8%), a longer Quake warning to make Quake vs Speedster even
(it weakened the stagger and broke four other Quake pairs), rage stopped by stagger (it leaked into
Quake vs Berserker), poison immunity for any ball (Venom then never wins).

### 4. Stat tuning

Three numbers changed, each to tune a counter's strength:

- **Quake health 72 → 71.** The stagger made the Quake stronger (55% overall in the prototype at
  72). At 70 Quake vs Speedster fell to 57.7 and Berserker vs Quake to 56.0 / 43.4; at 71 both stay
  in band.
- **Frost health 82 → 80.** Berserker over the Frost was 55.7 at 82 (a miss); at 80 it is 58.3, and
  Frost over Venom drops from 69.8 to 67.0, away from the band's top. This also moved **Archer vs
  Frost** from 55.4 to 57.6: the arrow mechanism above, now outweighing the Frost's sturdiness, so
  that pair is mapped as **Archer favoured**.
- **`POISON_NUMB` 0.7 → 0.8** for Venom over the Berserker (57.9 → 60.2).

### 5. Counter map

| Pair               | Intended        | Mechanical reason                                                   |
| ------------------ | --------------- | ------------------------------------------------------------------- |
| Venom vs Berserker | Venom favoured  | Poison numbs its rage, so it never hits hard while poisoned.        |
| Berserker vs Frost | Berserker       | Rage burns off the cold: it can never be slowed.                    |
| Frost vs Venom     | Frost favoured  | The cold wears poison off sooner; it hits Venom hard and slows it.  |
| Archer vs Frost    | Archer favoured | Leading arrows land most on the slowest ball; it rarely touches it. |
| Quake vs Archer    | Quake favoured  | A shockwave staggers the Archer: it can't aim, so it loses arrows.  |
| Quake vs Storm     | Quake favoured  | A shockwave staggers the Storm: it calls less lightning.            |
| Quake vs Sniper    | Quake favoured  | A shockwave breaks the Sniper's lock without a shot.                |

### 6. Results

`pnpm balance 500`, the pairs that moved by more than 1.5 points (first ball's rate first):

| Pair               | Before      | After       | Check           |
| ------------------ | ----------- | ----------- | --------------- |
| Venom vs Berserker | 44.5 / 55.1 | 60.2 / 39.5 | ok (new)        |
| Frost vs Berserker | 51.3 / 46.4 | 39.2 / 58.3 | WARN (new)      |
| Frost vs Venom     | 51.2 / 48.5 | 67.0 / 32.7 | ok (new)        |
| Archer vs Frost    | 55.4 / 44.2 | 57.6 / 41.9 | NEAR (new)      |
| Archer vs Quake    | 47.5 / 52.2 | 38.7 / 61.3 | ok (new)        |
| Storm vs Quake     | 49.0 / 50.3 | 41.9 / 57.5 | NEAR (new)      |
| Sniper vs Quake    | 50.3 / 49.6 | 33.8 / 66.1 | ok (new)        |
| Speedster vs Frost | 31.7 / 68.0 | 35.2 / 64.5 | ok (was WARN)   |
| Speedster vs Quake | 36.6 / 61.1 | 38.9 / 59.3 | WARN            |
| Storm vs Frost     | 56.2 / 43.5 | 58.1 / 41.7 | WARN (was NEAR) |
| Brawler vs Frost   | 44.7 / 54.7 | 46.5 / 52.9 | WARN (was NEAR) |
| Vampire vs Frost   | 49.8 / 48.6 | 52.0 / 46.1 | ok              |
| Frost vs Thorns    | 50.1 / 48.1 | 47.1 / 51.4 | ok              |
| Frost vs Sniper    | 51.2 / 48.6 | 49.2 / 50.6 | ok              |
| Thorns vs Quake    | 49.9 / 49.4 | 51.6 / 47.9 | ok              |
| Berserker vs Quake | 51.9 / 47.5 | 54.4 / 45.0 | WARN (was ok)   |

Frost vs Quake (Frost favoured) went from 58.4 to 57.1 (NEAR). Per ball: Brawler 46.7%,
Speedster 49.3%, Vampire 50.1%, Archer 50.7%, Storm 51.6%, Frost 50.7%, Thorns 46.8%, Venom
49.0%, Berserker 51.1%, Sniper 47.9%, Quake 53.0%. Draws 0.6%, median 18.3 s, worst side 31.3%,
worst ±5% sensitivity 13.7 points. Every target passes.

Counter counts now (favoured / unfavoured): Speedster 3/4, Vampire 3/2, Archer 3/2, Storm 3/2,
Frost 3/3, Venom 2/2, Berserker 2/2, Quake 4/1, Sniper 1/2, Thorns 1/4, Brawler 0/1 (safe pick,
unchanged: even against all but Thorns).

### 7. Still short

- **Sniper (1 favoured).** Its shot is a heavy hit on a target that holds a line, and no ball holds
  a line better than another (speeds differ by 10% outside the Speedster's stacks, ADR 0015). Shots
  hit 13-18% of the time against everyone, so any on-hit effect is rare. A future ball that is
  slow or stops (a turret, an anchor) would be its natural prey.
- **Quake (1 unfavoured).** Only the Frost exploits its need for walls. The stagger made it
  stronger against three balls, so it now leans on the high side overall (53.0%).
- **Thorns (1 favoured, 4 unfavoured).** Its spikes only punish contact damage, and the balls that
  hit hardest by contact are the Brawler (already its prey) and the Berserker, whose rage feeds
  on every reflection (rage moves Thorns vs Berserker 9 points towards the Berserker). Making it
  immune to slow gained 3.7 points against the Frost, not enough.
- **Speedster (7 relationships).** The cleanest lever, the Quake's warning length, also weakens the
  stagger and broke four Quake pairs; every other Speedster counter is the one favoured or
  unfavoured matchup of a ball that needs it.

## Consequences

- Positive: six of the ten balls with counters reach two favoured and two unfavoured (seven with
  the Speedster), and every new counter is a rule a viewer can see: poison numbs rage, rage
  ignores the cold, the cold shortens poison, shockwaves stop a ball aiming.
- Positive: each mechanic moves only its own pairs, so the rest of the matrix moved only through
  the two health changes.
- Negative: two more definition-level concepts (a status resistance field, a fourth status kind),
  and three balls read `staggered` in their hooks.
- Negative: three of the seven new counters sit in WARN or NEAR (Berserker > Frost 58.3, Archer >
  Frost 57.6, Quake > Storm 57.5, and Frost > Quake fell to 57.1). The Quake is the strongest ball
  overall at 53.0%.
- Every seed with a Frost, Quake, or a Berserker against Venom replays differently.

## Addendum: rules versus new balls (2026-11-05)

The run that built this ADR asked whether interaction rules are the way to keep making counters.
Answer: **about one counter-creating rule per ball, each visible on screen, and new balls rather
than more rules for the remaining gaps** (CLAUDE.md, Conventions). The Berserker, Frost and Venom
are already in two rules each and get no third. Of today's rules, the stagger and the slow and
poison rings show on screen; a numbed rage did not at first; since 2026-11-05 the Berserker's cracks
fade while it is poisoned, and an immune or resisted status shows only by its ring being absent or ending
early. The picker descriptions of the Berserker and the Quake were updated to name their rules
("can't be slowed", "stops its enemy aiming"). Still open: the Quake is the strongest ball at
53.0% with four favoured matchups; whether the next balance pass trims it is undecided.

## Amended by ADR 0028 (2026-11-06)

Two of these rules are removed: **rage can't be slowed** (the Berserker's `slowed: 0`) and **the
cold wears poison off the Frost** (`poisoned: 0.8`). Both showed only as an absence (a ring that
never appears or ends early) and each was its ball's second rule. Berserker vs Frost and Frost vs
Venom are even again. `statusResistance` stays in the engine, unused. Poison numbs rage and the
stagger stay, and now show the rule cue the moment they act.
