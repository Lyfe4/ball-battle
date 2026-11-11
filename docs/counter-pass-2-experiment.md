# Experiment: counter pass 2, phase 1 (game-wide levers)

Measured 2026-11-08 on the branch `experiment/counter-pass-2-sharpness` (ruleset 7, 21 balls).
Not merged. Question: which game-wide change, if any, makes the better matchup win more reliably
while keeping fights fun, before per-ball tuning (phase 2)?

## Success criteria (fixed before measuring)

- **Counter sharpness:** the mean and spread of the 70 designed favoured pairs, how many reach
  62-72%, and how many pairs are below target / NEAR / MISS (`checkCounter`, as `pnpm balance`).
- **Comebacks** (target band below): the "How it was won" rule (the winner trailed, then pulled
  ahead for good before the finish), "the half-time leader loses", and "the loser once led by
  25+ points of health".
- **Fight feel:** median 12-30 s, draws under 5%, contact hits and damage events per fight, and
  sensitivity (±5% health, warn 15 / fail 20).
- **Skill:** `scripts/series-measure.ts` with measured odds: best minus worst play in Reveal and
  Showdown, and the spread between bot levels.
- **Hard rules:** every ball 40-60%, no side of a matchup under 25%.

**Comeback band:** "the loser once led by 25+ points" in about **1 fight in 7-10 (10-15%)**. The
other two rules can't measure that (see below).

## Method

- A variant knob, `src/sim/experiment.ts`: `BB_VARIANT` (or `?variant=` in the dev page) rewrites
  every ball's definition when the roster loads, so the real `step` plays it. With no variant it is
  today's game: `pnpm test` passes unchanged. It is experiment-only and must never merge (the sim
  reads a global).
  - `r` radius (the Titan's growth scales with it), `h` max health, `c` contact damage (including
    `contactDamageOf`), `m` the minimum impact multiplier, `s` speed. Abilities are untouched, and
    so are the sim rules and the pass-through margin (no variant raises speed; bigger radii only
    widen the margin).
- `scripts/experiment/measure.ts`: every non-mirror pair, both slot orders, seeds 0-499 (210,000
  fights per variant). Per pair, 1,000 games give about ±3.1 points (2 SE). The mean of the 70
  favoured pairs is good to ±0.3-0.4. Counts of pairs near a band edge move by a few from noise
  alone.
- `scripts/experiment/analyse.ts`: the tables below. `pnpm balance 500` (with sensitivity) for the
  two finalists, and `series-measure.ts 20000` on each variant's measured odds.

## 1. Every variant against today

Contact-side variants. `r65,c0.75` and `r80,c0.6` are bigger balls with contact scaled down by
the rise in collision rate, so contact damage per second stays where it is.

| Criterion                            | today            | h1.25            | h1.5             | c0.75         | c0.6          | m0.5          |
| ------------------------------------ | ---------------- | ---------------- | ---------------- | ------------- | ------------- | ------------- |
| Favoured pairs: mean ± 2SE           | 62.1 ± 0.4       | **63.6 ± 0.4**   | **64.9 ± 0.4**   | 60.9          | 57.6          | 64.1          |
| Favoured pairs: SD / lowest          | 3.7 / 56.3       | 5.3 / 52.4       | 7.0 / 47.3       | 16.7 / 21.3   | 26.8 / 4.9    | 8.9 / 47.1    |
| Favoured in 62-72% / ≥58% (of 70)    | 31 / 60          | 34 / 61          | 33 / 63          | 11 / 36       | 6 / 33        | 31 / 52       |
| Even pairs: mean distance from 50    | 3.9              | 4.7              | 6.0              | 12.3          | 20.7          | 7.0           |
| Below target / NEAR / MISS           | 75 / 18 / 0      | 56 / 22 / 20     | 56 / 21 / 37     | 24 / 16 / 129 | 10 / 7 / 162  | 49 / 15 / 62  |
| Comeback, story rule (all / fav.)    | 46.5 / 48.3      | 52.2 / 54.0      | 56.3 / 58.1      | 52.6 / 54.4   | 55.8 / 56.9   | 44.7 / 47.2   |
| Half-time leader loses (all / fav.)  | 30.6 / 30.0      | 29.6 / 29.0      | 28.9 / 28.2      | 28.3 / 27.6   | 25.2 / 24.1   | 31.6 / 31.0   |
| Loser once led by 25+ pts            | 14.7             | **11.2**         | 8.8              | 12.1          | 10.3          | 12.2          |
| Median fight (p10-p90), s            | 18.1 (10.1-32.2) | 22.8 (13.4-39.3) | 27.5 (16.6-46.2) | 21.6          | 24.4          | 17.3          |
| Draws / reach 60 s, %                | 0.6 / 0.3        | 0.5 / 1.1        | 0.5 / 2.7        | 0.6 / 1.4     | 0.5 / 3.7     | 0.9 / 0.2     |
| Contact hits / damage events / fight | 8.7 / 15.3       | 10.8 / 19.1      | 12.8 / 23.0      | 10.4 / 18.0   | 11.8 / 20.1   | 8.3 / 14.6    |
| Ability share of damage              | 28.8%            | 29.1%            | 29.4%            | 33.3%         | 37.0%         | 27.1%         |
| Ball win rate range                  | 46.0-52.6        | 45.5-53.9        | 41.1-55.8        | **34.0-70.6** | **24.6-77.9** | **38.1**-58.0 |
| Worst side of any matchup            | 28.6             | **23.0**         | **20.0**         | **4.5**       | **0.6**       | **12.7**      |
| Sensitivity, worst ±5% health        | 14.0             | 15.7 (WARN)      | 18.8 (WARN)      | -             | -             | -             |
| Vampire heal / max health            | 44.5%            | 46.2%            | 47.3%            | 42.6%         | 40.1%         | 47.0%         |

Bigger balls with weaker contact, and combinations:

| Criterion                            | today       | r65,c0.75    | r80,c0.6      | r65,c0.75,h1.25 | r80,c0.6,h1.25 | r65,c0.75,h1.25,m0.5 |
| ------------------------------------ | ----------- | ------------ | ------------- | --------------- | -------------- | -------------------- |
| Favoured pairs: mean ± 2SE           | 62.1 ± 0.4  | 62.2         | 61.3          | 63.5            | 62.3           | 66.6                 |
| Favoured pairs: SD / lowest          | 3.7 / 56.3  | 11.8 / 37.8  | 18.3 / 25.6   | 14.5 / 34.1     | 20.8 / 23.0    | 12.3 / 35.9          |
| Favourite actually ahead             | 70 / 70     | 58 / 70      | 49 / 70       | 55 / 70         | 49 / 70        | 64 / 70              |
| Below target / NEAR / MISS           | 75 / 18 / 0 | 35 / 32 / 75 | 24 / 14 / 132 | 20 / 32 / 102   | 19 / 16 / 149  | 42 / 15 / 87         |
| Loser once led by 25+ pts            | 14.7        | 12.3         | 10.6          | 9.4             | 7.8            | 7.9                  |
| Half-time leader loses               | 30.6        | 30.1         | 28.8          | 28.6            | 27.2           | 29.3                 |
| Median fight, s                      | 18.1        | 17.1         | 16.1          | 21.6            | 20.2           | 20.7                 |
| Contact hits / damage events / fight | 8.7 / 15.3  | 10.8 / 18.1  | 12.9 / 20.7   | 13.5 / 22.7     | 16.1 / 25.9    | 12.9 / 21.8          |
| Ball win rate range                  | 46.0-52.6   | 40.3-64.5    | 33.9-74.9     | 37.3-68.2       | 29.8-78.7      | 37.9-63.8            |
| Worst side of any matchup            | 28.6        | 10.6         | 3.7           | 6.9             | 2.1            | 8.7                  |

### Skill (measured odds, 20,102 lineup pairs)

Gap = best minus worst play. Level spread = best play against Easy minus best play against Hard.

| Variant   | Reveal gap (Easy / Normal / Hard) | Showdown gap (E / N / H) | Level spread, Reveal / Showdown |
| --------- | --------------------------------- | ------------------------ | ------------------------------- |
| today     | 8.6 / 9.8 / 9.0                   | 4.5 / 7.9 / 6.1          | 2.7 / 0.9                       |
| h1.25     | 9.8 / 11.2 / 10.3                 | 5.2 / 9.1 / 7.0          | 3.0 / 1.0                       |
| h1.5      | 10.7 / 12.2 / 11.2                | 5.8 / 10.0 / 7.7         | 3.3 / 1.0                       |
| r65,c0.75 | 10.0 / 11.5 / 10.9                | 5.5 / 9.4 / 7.7          | 2.6 / 0.6                       |
| m0.5      | 10.0 / 11.4 / 10.6                | 5.4 / 9.3 / 7.4          | 2.9 / 0.8                       |

(Today's row reproduces `docs/series-measurements.md` within 0.6 points, which checks the
odds file this experiment writes.) The skill gap grows by about 1.3 points per +25% health. The
spread between bot levels barely moves: the bots read the counter map's fixed odds, so the bots
themselves would need changing to separate the levels.

## What the numbers say

1. **The premise is half right.** Designed favoured pairs already average **62.1%**, the bottom of
   the target band, and every designed favourite is ahead. Of today's 75 pairs below target, about
   **29 are favoured pairs at 58-62% and about 46 are even pairs drifting out of 45-55**. So much
   of the "softness" is even pairs that aren't even enough, which more sharpness makes worse.
2. **Sharpening is not selective.** More events per fight push every pair towards its true edge,
   whether that edge is designed or accidental. h1.25 sharpens designed counters (+1.5), but it
   also pushes 14 even pairs out of their floor (Vampire vs Titan 63.9/35.1, Chrono vs Bloom
   35.5/62.9) and drops 6 designed counters below 58% (Chrono vs Sniper 53.5, Boomerang vs
   Inferno 52.4, Archer vs Bomber 54.4). Today's soft results hide those wrong edges; they don't
   cause them.
3. **Anything that shifts contact against timed abilities breaks the roster.** Weaker contact,
   bigger balls with weaker contact, and a higher minimum hit (m0.5) all rebalance contact against
   timers. Venom (poison), Sniper and Inferno climb to 64-78%; Frost, Chrono, Guardian and
   Berserker fall to 24-40%; 62 to 162 pairs MISS. Bigger balls add hits (+25-50%) but don't
   sharpen the map at all (62.2 and 61.3): the ability balls' shifts swamp it. This is the ADR
   0007 addendum's warning measured: the bigger-balls direction needs per-ball retiming, not a
   global number.
4. **Health is the only neutral lever, and a weak one.** Sharpness grows with about the square root
   of the number of events: +25% health gives +25% events, +1.5 points on favoured pairs and
   +4.7 s of median fight. Getting the favoured mean to about 66% needs h ≈ 1.75, a median of
   about 32 s: too long.
5. **Comebacks:**
   - The story rule fires in about half of all fights (46.5%) because any early trailing counts. It
     works for the story screen but is too loose to tune against.
   - "The half-time leader loses" sits at 25-31% under every variant. The fights are mostly near
     even; for an even random walk this rate is about 25%, so it can't reach 1 in 6-8 without
     making matchups lopsided.
   - "The loser once led by 25+ points" is the useful measure. Today it is **14.7% (1 in 6.8)**,
     already in your band; h1.25 gives 11.2% (1 in 9), h1.5 8.8% (1 in 11).
6. **One-hit abilities lose value with more health.** The Chrono's rewind undoes one hit, and the
   Guardian's shield soaks one. With more health a hit is a smaller share, so Chrono (50.6 → 46.0
   → 41.1) and Guardian (48.0 → 45.5 → 44.0) fall. The steady, compounding balls (Vampire, Venom,
   Thorns, Storm) gain.

## 2. What feels different in a fight

- **h1.25:** the same fights, about a quarter longer, with two more contact hits each. The opening
  plays out identically (same seed, same bounces); the difference shows in who survives the third
  or fourth hit. Clear leads are lost less often (1 in 9 instead of 1 in 7). Easier to follow; not
  more chaotic.
- **h1.5:** noticeably long. p90 is 46 s and 2.7% of fights reach the 60 s limit.
- **Bigger balls with weaker contact:** busier and shorter, with more bumps that each do little.
  Fights read as ability fights: poison, lasers and fire do the work, and the bumping is filler.
- **m0.5:** glancing hits hurt more, so a fight reads less from the picture (ADR 0008's point). The
  Speedster, whose hits are often glancing, collapses to 38%.

Seeds to watch. Load the page with the variant in the URL; it's read on load. A seed link needs
`&v=7` or it opens the "link from another version" notice:

- Thorns vs Brawler (Thorns favoured), seeds 0, 1 and 2:
  - today: `http://localhost:5199/?a=thorns&b=brawler&seed=1&v=7`
  - h1.25: `http://localhost:5199/?a=thorns&b=brawler&seed=1&v=7&variant=h1.25`

  Same fight and same length on seeds 0 and 2 (seed 1 runs 7 s longer with more health), but today
  the Brawler wins all three and with more health Thorns outlasts it.

- Thorns vs Brawler, seed 10 with `variant=h1.25`: a real comeback. The Brawler trails by 23
  points and wins.
- Thorns vs Brawler, seed 7 with `variant=h1.25`: a 54.7 s fight, close to the time limit.
- Venom vs Berserker with `variant=r65,c0.75`: the contact-side breakage (Berserker 10.6%).

(Generate more with `BB_VARIANT=h1.25 node scripts/experiment/examples.ts <a> <b> 0 40`.)

## 3. Who each variant helps or breaks

Overall win rate (average over the ball's designed favoured pairs):

| Ball        | today       | h1.25       | h1.5        | r65,c0.75   | r80,c0.6    | m0.5        |
| ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- |
| Brawler     | 48.1 (-)    | 46.9 (-)    | 44.2 (-)    | 40.7 (-)    | 35.9 (-)    | 51.2 (-)    |
| Speedster   | 47.5 (64.7) | 49.5 (66.8) | 50.3 (69.7) | 52.8 (62.1) | 56.1 (56.1) | 38.1 (65.0) |
| Vampire     | 51.1 (59.9) | 53.9 (64.3) | 55.1 (67.2) | 46.4 (55.8) | 43.2 (55.3) | 55.1 (67.3) |
| Archer      | 51.5 (62.7) | 50.8 (63.1) | 48.3 (61.9) | 48.6 (59.8) | 48.2 (59.7) | 45.0 (56.6) |
| Storm       | 52.2 (60.1) | 53.4 (62.1) | 55.8 (65.2) | 54.9 (64.6) | 58.8 (70.4) | 50.4 (56.5) |
| Frost       | 47.3 (61.9) | 46.5 (61.0) | 45.9 (59.9) | 40.3 (52.7) | 36.4 (51.2) | 48.1 (69.5) |
| Thorns      | 50.5 (63.2) | 51.8 (67.7) | 53.9 (71.6) | 48.0 (68.4) | 45.0 (70.2) | 56.4 (66.6) |
| Venom       | 50.1 (63.0) | 52.6 (68.6) | 55.2 (73.2) | 64.5 (85.8) | 69.6 (93.9) | 42.7 (52.0) |
| Berserker   | 51.9 (60.9) | 51.3 (59.7) | 51.9 (60.4) | 46.7 (52.5) | 43.3 (48.8) | 56.7 (70.9) |
| Sniper      | 49.2 (62.9) | 50.2 (64.5) | 50.7 (65.8) | 60.1 (74.1) | 68.3 (81.8) | 46.9 (58.9) |
| Quake       | 48.4 (63.4) | 49.4 (65.3) | 50.1 (68.4) | 46.5 (60.5) | 45.6 (58.5) | 46.4 (65.3) |
| Magnet      | 52.2 (61.5) | 51.3 (60.5) | 51.5 (61.1) | 48.1 (53.1) | 43.0 (44.3) | 58.0 (71.7) |
| Ghost       | 48.2 (59.1) | 46.4 (58.0) | 47.4 (60.0) | 50.1 (59.3) | 53.4 (61.4) | 49.1 (63.1) |
| Necromancer | 46.0 (61.3) | 46.7 (64.1) | 45.4 (63.4) | 49.5 (61.0) | 53.4 (59.6) | 42.9 (63.9) |
| Chrono      | 50.6 (62.0) | 46.0 (57.7) | 41.1 (51.0) | 41.9 (50.5) | 34.7 (40.0) | 53.4 (70.9) |
| Titan       | 52.6 (64.6) | 51.5 (65.3) | 52.2 (67.4) | 45.1 (57.2) | 40.7 (52.4) | 57.3 (76.1) |
| Inferno     | 50.4 (61.9) | 51.5 (65.4) | 51.2 (66.3) | 63.2 (76.1) | 74.9 (86.1) | 46.1 (56.2) |
| Boomerang   | 47.4 (58.1) | 46.1 (57.5) | 46.6 (58.6) | 50.1 (54.2) | 54.0 (48.1) | 42.0 (55.0) |
| Bomber      | 48.5 (59.2) | 49.7 (60.0) | 49.7 (60.6) | 51.3 (53.5) | 52.9 (51.7) | 46.1 (63.0) |
| Guardian    | 48.0 (57.9) | 45.5 (55.2) | 44.0 (52.8) | 41.9 (61.1) | 33.9 (58.5) | 54.8 (64.4) |
| Bloom       | 51.9 (64.5) | 53.2 (66.1) | 54.7 (68.0) | 52.5 (57.3) | 50.9 (45.9) | 54.0 (72.8) |

- **h1.25 / h1.5**
  - Help: Vampire, Venom, Thorns, Storm, Bloom and Speedster, whose edges compound over time.
  - Hurt: Chrono and Guardian (one-hit abilities), and the Brawler drifts down.
  - Archer, Berserker, Magnet, Ghost, Boomerang and Bomber: their favoured pairs don't sharpen.
    Those counters are close to even in substance, and per-ball work has to create them.
- **Bigger balls with weaker contact:**
  - Help: Venom, Sniper, Inferno and Storm.
  - Break: Frost, Chrono, Titan (it grows to radius 117/144), Brawler, Magnet and Guardian.
  - Archer survives, unlike the earlier bigger-balls test (48.6 / 48.2), because weaker contact
    offsets the faster contact, but its counters still soften.
- **m0.5:**
  - Help: Magnet, Berserker, Titan and Thorns.
  - Break: Speedster (38.1), Archer and Venom.

## 4. Recommendation

**No game-wide change clearly wins. Do phase 2 as per-ball tuning, optionally on top of +25% health
(h1.25), and drop the bigger-balls and weaker-contact directions.**

- The contact-side variants are each a full rebalance. Every one breaks the hard rules by a wide
  margin, and none sharpens the counter map.
- h1.25 is the only variant that improves every criterion a little:
  - +1.5 on favoured pairs;
  - about +1.3 points of skill gap in both formats;
  - clear-lead comebacks from 1 in 7 to 1 in 9;
  - a median of 22.8 s, inside 12-30;
  - draws unchanged.

  It costs 20 MISS and one side under 25% (Boomerang vs Speedster 23.0). Those are edges per-ball
  work would have to fix anyway; h1.25 only makes them visible. Sensitivity rises to 15.7 (WARN).

- What phase 2 has to do in either case:
  - pull the 46 drifting even pairs back to even;
  - give the 29 soft favoured pairs a mechanical edge (the counters that don't sharpen with health
    are Archer, Berserker, Magnet, Ghost, Boomerang, Bomber and Guardian);
  - give Chrono and Guardian identities that don't rest on a single hit. With more health that
    becomes more urgent, which fits your wish for a stronger Guardian.
- If you take h1.25, adopt it first, as its own ruleset bump, and tune per ball on top. Otherwise
  every per-ball measurement would have to be redone.
- Not tested: game-wide levers on the bot side. The level spread is about 1-3 points under every
  variant, because the bots read the counter map's fixed odds.

## Reproduce

```bash
BB_VARIANT=h1.25 node scripts/experiment/measure.ts --seeds 500 --out h125.json --rates h125.rates.json
node scripts/experiment/analyse.ts today.json h125.json --balls
BB_VARIANT=h1.25 node scripts/balance.ts 500
node scripts/series-measure.ts 20000 --rates h125.rates.json
```

Each `measure.ts` run takes 2.5-4 minutes on 16 cores, and a full `pnpm balance` takes 16-20
minutes.
