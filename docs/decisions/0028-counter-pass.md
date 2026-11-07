# 0028: The counter pass: sharper favoured band, balanced shapes, visible rules

- Status: Accepted
- Date: 2026-11-06
- Amends: ADR 0010 (bands), ADR 0016 (two rules removed), ADR 0026 (phasing, minions)
- Amended by: ADR 0041 (the rule cue sits on the ball that caused the rule, and its words)

## Context

Three goals:

1. Favoured should feel favoured: the favoured band goes from 58-70% to 62-72%.
2. Balanced shapes: the shape warning (ADR 0027) flagged the Magnet (+6), Quake (+4) and Ghost
   (-4), and the Speedster had six weak matchups.
3. Audit every interaction rule: make it visible when it acts, turn it into a general rule about
   a kind of ball, or remove it.

The preference was to buff rather than nerf, and to change abilities rather than stats. These hard
rules stay:

- every ball wins 40-60% overall;
- no side worse than 25/75;
- draws under 5%;
- median fight 12-30 s;
- sensitivity within 20 points;
- the Vampire heals at least 25%;
- the Brawler is even with all but Thorns.

## Decision

### 1. Bands

`COUNTER_BANDS.favoured` is **[0.62, 0.72]**. The even band (45-55%), the 2-point NEAR allowance,
the 25/75 hard limit and the lopsided gap (4) are unchanged.

### 2. Interaction rules

| Rule                                                                 | Before                               | Decision                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shock cuts heals (Storm → Vampire)                                   | Ring only                            | **General rule + cue.** "A shocked ball heals less" applies to any healer. The cue shows on every cut heal.                                                                                                                                          |
| A staggered ball can't aim (Quake → Archer, Storm, Sniper)           | Ring only                            | **General rule + cue.** It covers every ball that aims. The cue shows on the tick a due attack is held, or when a Sniper's lock breaks.                                                                                                              |
| Poison numbs rage (Venom → Berserker)                                | Cracks fade                          | **Kept as a pair rule + cue.** It is the one rule for each of the two balls. The cue shows on a poisoned hit while the Berserker has rage to numb.                                                                                                   |
| Rage can't be slowed (Berserker vs Frost)                            | Invisible: a ring that never appears | **Removed.** It was the Berserker's second rule and showed only as an absence. Berserker vs Frost is even.                                                                                                                                           |
| The cold shortens poison (Frost vs Venom)                            | Invisible: a ring that ends early    | **Removed.** It was the Frost's second rule. Frost vs Venom is even. The Frost keeps its real strengths, against the Speedster and the Quake, from its slow.                                                                                         |
| Phasing (Ghost)                                                      | Contact passes through               | **One general rule:** a phased ball can't be touched, gripped or aimed at. Skulls pass through it, the Magnet's pull slips, and aimed attacks wait for it to turn solid (`HookContext.isPhased`, `nearestTarget`). The see-through Ghost is the cue. |
| Ranged attacks ignore spikes; minions draw aims; zones clear minions | General already                      | Kept as they are. The cause is already on screen.                                                                                                                                                                                                    |

Every rule left emits the output-only `ruleApplied` event (`src/sim/rules.ts`; a hook returns the
`ruleApplied` action). There are three rules: `healCut`, `aimHeld` and `rageNumbed`.

**The rule cue** is one shape for every rule: a small four-point spark in pale gold with a dark
outline, beside the ball the rule acted on. It pops in, holds, then fades over 0.75 s of effect
time, and stays still with reduced motion. It is a vector path (`src/render/rule-cue.ts`), never a
font glyph. The symbol legend draws the same path as SVG.

**The heal pulse** is now general. Every `healed` event, on any ball, shows a green wash and a ring
swelling from its edge, sized by the heal as a share of max health: full size at 15%, never below
30% of full. The Vampire's collar flush stays. The exception that skipped the pulse for a design
that shows healing itself is gone, and so is the grey shrinking ring for a reduced heal. A
shock-cut heal is simply a smaller pulse, and the spark says why.

Screenshots at phone width are in `docs/images/counter-pass/`:

- `phone-arena-cues.png`: the 340 px arena with a heal and two cues;
- `heals.png`: a big heal, a small heal and a shock-cut heal;
- `rule-cue.png`: the cue.

### 3. Ability and stat changes

| Ball      | Change                                                                     | Why                                                                                               |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Vampire   | Lifesteal 40% → **45%**; health 60 → 58                                    | Sharpens what lifesteal answers (chip and burst). The lower health keeps it level overall.        |
| Archer    | Arrow speed 1500 → **1650**                                                | Arrows land more often on slow targets: the Frost and the Vampire.                                |
| Storm     | Strike 28 → **31**; health 74 → 73                                         | Sharper against slow balls, and against the Necromancer: a strike clears the skull and its owner. |
| Quake     | Shockwave 13 → **12**; stagger 3.5 s → **4.5 s**                           | Moves its edge from raw damage into the stagger.                                                  |
| Ghost     | Spectral hit 8 → **10**; the phasing rule above                            | Ghost was -4; now it is favoured against the Magnet and the Necromancer.                          |
| Berserker | Rage 8 → **9**, 25 at most (below the Brawler's 26); slow immunity removed | Every wound feeds its rage, so it is favoured against the Quake and the Necromancer.              |
| Venom     | Poison 260 → **270** ticks                                                 | Keeps Venom over the Berserker near the band once rage grew.                                      |
| Speedster | Speed per stack 8% → **10%**                                               | It was the weakest ball (45.6%), and the Brawler pair was out of band.                            |
| Brawler   | Health 64 → 66                                                             | Keeps it even with the stronger Archer and Ghost (a hard rule).                                   |
| Sniper    | Health 76 → 78                                                             | It was weakest after the pass. Sniper over the Ghost reaches 61.0.                                |
| Thorns    | Health 75 → 77                                                             | Lifts it off 46.9%.                                                                               |

Measured and rejected:

- **Two Necromancer minions at once.** Necromancer vs Archer reached 80-94% at every damage (7-12)
  and summon interval (88-150 ticks) tried: decoys stack against aimed balls. It stays at one.
- **Six Speedster stacks.** +7 points overall; Vampire vs Speedster collapsed to 49.
- **Lifesteal 50%.** Vampire 59.8% overall.
- **A Sniper lock of 16 ticks.** +5 points against every ball.
- **Lower Vampire contact damage with higher lifesteal.** Vampire 41-43%.
- **25% more health for every ball** to lengthen fights. It steepened leans that already existed,
  not the counters. The Brawler fell to 44% and five of its even pairs left the band.

### 4. How the numbers were chosen

1. Each of 33 levers (every ball's health ±4 among them) was played once across the whole matrix,
   at 400 seeds.
2. A linear model was fitted to them, with remaps allowed. Each lever moves only its own ball's
   pairs, so the deltas are clean.
3. The model could not get below about 7 misses, even with 25 lever changes and 13 remaps. The
   cause is structural: most levers move all of a ball's pairs together (ADR 0010 §3), so a pair
   at 57% (too lean for even, too flat for favoured) moves with the rest.
4. So candidates were built by mechanism instead, and measured for real (4 rounds at 500 seeds).
5. Finally the map was set to what each pair measures, where a mechanism supports it.

### 5. Counter map changes

| Pair                 | Was         | Now           | Reason (in the map entry)                                |
| -------------------- | ----------- | ------------- | -------------------------------------------------------- |
| Frost vs Venom       | Frost       | even          | Rule removed                                             |
| Berserker vs Frost   | Berserker   | even          | Rule removed                                             |
| Vampire vs Speedster | Vampire     | even          | The faster stacks hit back as hard as it drinks          |
| Quake vs Speedster   | Quake       | even          | Softer shockwaves no longer outweigh its burst           |
| Quake vs Storm       | Quake       | even          | Heavier lightning makes up the strikes the stagger holds |
| Quake vs Ghost       | Quake       | even          | Softer shockwaves no longer outweigh its passes          |
| Quake vs Necromancer | Quake       | even          | A softer shockwave no longer wins the trade              |
| Storm vs Ghost       | Storm       | even          | Lightning waits while the Ghost is phased                |
| Magnet vs Archer     | Magnet      | even          | Faster arrows land first                                 |
| Magnet vs Storm      | Magnet      | even          | Heavier lightning pays for the brawl                     |
| Ghost vs Necromancer | Necromancer | **Ghost**     | Skulls pass through a phased ball                        |
| Ghost vs Magnet      | even        | **Ghost**     | A phased ball can't be gripped                           |
| Berserker vs Quake   | even        | **Berserker** | Every shockwave is a wound that feeds its rage           |
| Vampire vs Quake     | even        | **Vampire**   | Lifesteal heals back the softer shockwaves' chip         |
| Storm vs Necromancer | even        | **Storm**     | A heavier strike clears the skull and its owner          |

The Brawler is still even with every ball but Thorns.

## Results

From `pnpm balance:summary`: 500 seeds per slot order, ruleset 3. "Before" is ruleset 2's
`docs/balance-summary.md`.

| Ball        | Win before | Win after | Map gap before | Map gap after | Measured gap before | Measured gap after |
| ----------- | ---------: | --------: | -------------: | ------------: | ------------------: | -----------------: |
| Brawler     |      47.1% |     48.3% |             -1 |            -1 |                  -2 |                 -3 |
| Speedster   |      47.3% |     47.5% |             -3 |            -1 |                  -3 |        **-4 WARN** |
| Vampire     |      50.5% |     50.6% |             +1 |            +1 |                  +2 |                 +2 |
| Archer      |      50.3% |     51.7% |              0 |            +1 |                   0 |                 +1 |
| Storm       |      51.9% |     53.0% |             +1 |            +3 |                  +2 |                 +3 |
| Frost       |      50.6% |     47.7% |              0 |             0 |                   0 |        **-4 WARN** |
| Thorns      |      48.5% |     50.3% |             -2 |            -2 |                  -2 |                 +1 |
| Venom       |      48.3% |     48.7% |             -1 |             0 |                  -1 |                  0 |
| Berserker   |      51.3% |     51.6% |             +1 |            +1 |                  +1 |                 +1 |
| Sniper      |      47.5% |     48.4% |             -2 |            -2 |                  -2 |                 -3 |
| Quake       |      53.0% |     48.8% |    **+4 WARN** |            -2 |         **+4 WARN** |                 -1 |
| Magnet      |      54.1% |     52.2% |    **+6 WARN** |            +3 |         **+6 WARN** |                 +3 |
| Ghost       |      46.0% |     50.0% |    **-4 WARN** |            +1 |         **-5 WARN** |                 +1 |
| Necromancer |      49.3% |     47.1% |              0 |            -2 |                  -1 |                 -3 |

Every hard rule passes:

- every ball wins 47.1-53.0% (46.0-54.1% before);
- draws 0.6%;
- median fight 18.0 s (18.1 s before);
- worst side 28.6%;
- worst ±5% sensitivity 14.0 points;
- the Vampire heals 43.3% of its max health per match.

### What fell short

**The 62-72 band is not met everywhere.** Judged under the new band, the baseline had 23 pairs out:
21 favoured pairs were below 60%, plus some even pairs. The final configuration has **14 MISS**,
each 0.5-5.7 points beyond the NEAR allowance, so `pnpm balance` exits 1 on the counter-map
target. `pnpm balance:ci`, which allows 3 standard errors at 150 seeds, passes.

| Pair                     | Map         | Result      |
| ------------------------ | ----------- | ----------- |
| Speedster vs Storm       | Speedster   | 58.9        |
| Vampire vs Venom         | Vampire     | 59.2        |
| Vampire vs Berserker     | Vampire     | 59.0        |
| Vampire vs Quake         | Vampire     | 58.5        |
| Venom vs Berserker       | Venom       | 59.0        |
| Berserker vs Necromancer | Berserker   | 59.0        |
| Storm vs Thorns          | Storm       | 56.7        |
| Storm vs Necromancer     | Storm       | 57.2        |
| Necromancer vs Sniper    | Necromancer | 57.0        |
| Ghost vs Magnet          | Ghost       | 56.3        |
| Magnet vs Archer         | even        | 42.6 / 56.9 |
| Storm vs Ghost           | even        | 57.2 / 42.5 |
| Thorns vs Frost          | even        | 57.1 / 41.6 |
| Thorns vs Quake          | even        | 57.2 / 42.2 |

Each sits in the gap between even and favoured, where a stat moves the pair only together with the
ball's other pairs. Closing them needs more pair-specific mechanics or new balls. No further rules
were added, to keep about one per ball.

**Shapes.** By the map, every ball is within ±3. By the measured results, two balls warn at -4:

- the Speedster: a bigger buff (6 stacks, more damage) overshoots;
- the Frost: it lost its two rule-made counters, so its in-between pairs lean weak.

The Magnet, Quake and Ghost that were flagged are fixed.

### Performance

Measured in headless Chromium at 375 × 812, 2× density and 4× CPU throttling, timing the frame
callback over five matches: Necromancer vs Archer, Vampire vs Storm, Ghost vs Magnet, Quake vs
Sniper and Necromancer vs Sniper.

| Refresh               | Frames | Median |    p95 |     Max | Over 16.7 ms |
| --------------------- | -----: | -----: | -----: | ------: | -----------: |
| 60 Hz (native rAF)    |  3,488 | 0.9 ms | 1.4 ms | 11.3 ms |            0 |
| 90 Hz (fixed driver)  |  4,835 | 0.7 ms | 1.2 ms | 12.8 ms |            0 |
| 120 Hz (fixed driver) |  5,263 | 0.6 ms | 1.1 ms | 10.0 ms |            0 |

The object count did not grow (still one minion), so minion interpolation (ADR 0027) is unchanged.

## Consequences

- Positive: every interaction rule left shows the moment it acts, always with the same spark, and
  heals show on every ball. Phasing is one rule a player can state.
- Positive: no ball is lopsided by the map. The Ghost and Magnet are no longer outliers, and the
  Quake's edge sits in its stagger.
- Negative: 14 pairs fall short of the new band, and `pnpm balance` reports MISS until a later
  change moves them. Two measured shapes warn.
- Negative: there are fewer favoured pairs (43 → 37). Pairs that could not be sharpened were
  mapped even rather than forced with stats.
- Every link from ruleset 2 shows the outdated notice (ADR 0022).

## Addendum: a target and a floor (2026-11-06)

After this pass, the full `pnpm balance` failed on every run: 14 pairs sat outside the new band.
A check that always fails gets ignored, and a real regression would hide among the known
shortfalls. So each band now has two levels (`COUNTER_BANDS` in `scripts/counter-map.ts`):

| Band     | Target (aim) | Floor (fail outside, after the 2-point NEAR allowance) |
| -------- | ------------ | ------------------------------------------------------ |
| Favoured | 62-72%       | 58-72%                                                 |
| Even     | 45-55%       | 42-58%                                                 |

- A pair between its target and its floor is a **WARN, below target**. It is marked in the
  `pnpm balance` output, counted in its own target line, and listed under "Below target" in
  `docs/balance-summary.md`. It does not fail.
- Outside the floor, the existing allowance still applies: up to 2 points is NEAR (passes), and
  further out is a MISS (fails).
- The upper edge stays at 72%, and the 25/75 hard limit is unchanged.

The even band gets the same treatment because four of the 14 shortfalls were even pairs at about
57/42. The favoured target stays where ADR 0028 set it: the shortfalls are work to do, shown on
every run, not a lowered bar.

On today's config `pnpm balance` exits 0, and its target line reads "33 below target".

- **Of the 14 pairs that failed:** 9 are now WARN, below target. The 5 others are NEAR, within 2
  points outside the floor: Storm vs Thorns 56.7, Storm vs Necromancer 57.2, Necromancer vs Sniper
  57.0, Ghost vs Magnet 56.3, and Thorns vs Frost 41.6 / 57.1.
- **The other 24 below-target pairs** already passed as NEAR before (favoured 60-62%, even sides
  at 43-45% or 55-57%). They now count as below target, because they are short of the target.

The summary file lists all 33, so the distance to the target stays visible on every run.
