# Aiming: does choosing the launch direction create skill?

Measured 2026-11-05. Nothing in the game changed: the live game still uses the random start, and
`pnpm balance` output is byte-identical to before the aimed start existed (ADR 0018).

## The idea

At the start of each round both balls stand on fixed spots on opposite sides of the arena, and each
player chooses the direction their ball launches in (simultaneously and blind in PvP; a bot for
now). Everything after the launch plays out exactly as today.

## Method

- **Start.** `createWorld(seed, balls, { kind: 'aimed', aims })` (ADR 0018): ball A at (250, 500),
  ball B at (750, 500), each launched at an integer aim point. The seed drives everything after
  the launch (wall-bounce turns, ability randomness), exactly as in a random start.
- **Directions** are in each ball's own frame: 0° is straight at the opponent's spot, 90° straight
  at the bottom wall, 180° straight back at its own wall. B's frame mirrors A's, so an angle means
  the same thing from either spot. 24 directions, 15° apart; aim points sit 240 units out, rounded
  (under 0.15° of error).
- **Mirror images are folded.** The arena is symmetric about its middle line, so against a random
  opponent turning 30° towards the bottom wall is the same choice as 30° towards the top. Results
  are reported for 13 folded angles (0°, 15°, …, 180°), each with both sides' data.
- **Random aim** is a uniformly random direction per seed, from a seeded stream.
- **Both slot orders** are played for every seed, as in `pnpm balance`, and draws count as games.
- **Honest best-direction numbers.** The best of 13 noisy win rates overstates itself. The best (and
  worst) angle is chosen on one half of the seeds and its rate read on the other half, both ways
  round, averaged. "Gain" is that best angle's win rate minus random aim's on the same seeds;
  "spread" is that best minus that worst.
- **Good aiming on both sides** (the blind game). For every pair, a 24 × 24 matrix of every
  direction against every direction (16 seeds per cell, both slot orders, each cell merged with
  its mirror image: 64 games), solved as a zero-sum game (fictitious play). Profiles were then
  played on **held-out seeds** (10000-10499, both slot orders, 1000 games per pair), so a strategy
  chosen on noise can't flatter itself:
  - _random_: both aim randomly;
  - _both best angle_: each side plays its best angle against random aim (±θ evenly);
  - _both solved_: each side plays its equilibrium mix from the matrix;
  - best responses: one side plays the matrix's best pure reply to the other's best angle or
    solved mix. The largest change this makes is the "best-response swing".
- Counter-map verdicts use the same bands and near-miss allowance as `pnpm balance` (ADR 0010).

Scripts (measurement only, not part of CI): `scripts/aim-measure.ts` plays an experiment across all
cores and writes raw counts; `scripts/aim-strategies.ts` builds the profiles;
`scripts/aim-report.ts` prints the tables below. To reproduce:

```bash
node scripts/aim-measure.ts baseline --out aim/baseline.json
node scripts/aim-measure.ts directions --out aim/directions.json
node scripts/aim-measure.ts matrix --out aim/matrix.json
node scripts/aim-strategies.ts aim/directions.json aim/matrix.json aim/strategies.json
node scripts/aim-measure.ts evaluate --strategies aim/strategies.json --out aim/evaluate.json
node scripts/aim-report.ts aim
```

All rates are the first-named ball's share of all games. One pair at 1000 games has about ±1.6
points of standard error; a difference between two such runs about ±2.2.

## 1. Fixed spots, random aim: how far do matchups move?

Seeds 0-499, both slot orders (1000 games per pair), compared with today's random start on the
same seeds (`pnpm balance 500`, reproduced exactly by the harness).

- **Mean shift 2.1 points, max 5.6**; four pairs move more than 5: Storm vs Thorns −5.6, Vampire
  vs Storm +5.3, Frost vs Sniper −5.2, Vampire vs Berserker +5.0. Most of the rest is within noise.
- **Counter map: 5 MISS** (from none), each 2.2-4.2 points short of a band whose edge is 2 points
  of noise allowance away: Vampire over Speedster 53.8, Quake over Speedster 55.8, Storm over
  Thorns 51.3, Frost over Quake 55.5 (favoured band 58-70), and Venom vs Quake 41.3 / 58.2 (even).
  On the held-out seeds of section 4 (random aim column) four of them miss again (Frost vs
  Berserker misses there instead of Venom vs Quake), so the spots themselves move a few counters.
- Per ball, overall rates barely move (largest: Quake 53.0 → 54.9, Sniper 47.9 → 49.7, Storm
  51.6 → 49.9). Fixed spots on their own would need a light retune pass.

## 2. How much does one side's aim matter? (the other aims randomly)

Every ordered pair, mirrors included (121), seeds 0-299 in two halves, 600 games per angle per
half after folding.

- **Gain over random aim: median +1.7 points; 20 of 121 matchups at +5 or more; max +11.1**
  (Speedster against the Archer).
- **Spread (best minus worst angle): median 3.8; 12 matchups over 15, 10 over 20, max 29.4.**
  The big spreads are nearly all one blunder, not one great choice:
  - **Against the Storm, 180° (straight back into your own wall) is the worst angle for all 11
    balls**, with spreads of 17-29 points. The Storm calls its first strike at 1.0 s around where
    the enemy is, and it lands at 1.8 s. A ball launched backwards bounces off its wall and
    comes back along the same line, so it is still in the zone: **the first strike hits 77% of the
    time, against 1-7% at every other angle** (200 seeds, Brawler vs Storm).
  - **Against the Archer, aiming straight at it costs 4-9 points** for 9 of 11 balls (Speedster
    −9.4, Brawler −7.3). An arrow leads its target, and a ball on a straight line is the easiest
    to lead: in the first 5 s a Brawler launched at the Archer takes 28 ability damage, one
    launched sideways (90°) 17. Sideways is the best angle against it for six balls.
- **Cross-check:** the measured random aim and the every-direction average agree within noise
  (mean difference 1.6 points).

| Aiming ball | vs     | Random aim | Best angle | Gain  | Spread | Straight at it (0°) | Worst angle |
| ----------- | ------ | ---------- | ---------- | ----- | ------ | ------------------- | ----------- |
| Speedster   | Archer | 70.2       | 90°        | +11.1 | 20.6   | −9.4                | 180°        |
| Speedster   | Storm  | 59.9       | 135°       | +9.9  | 26.4   | +0.8                | 180°        |
| Archer      | Archer | 46.6       | 90°        | +9.6  | 20.4   | −4.1                | 150°        |
| Vampire     | Quake  | 52.0       | 180°       | +8.5  | 8.1    | −1.6                | 105°        |
| Brawler     | Sniper | 45.5       | 165°       | +7.1  | 9.1    | −1.7                | 105°        |
| Brawler     | Archer | 45.5       | 90°        | +6.8  | 14.1   | −7.3                | 0°          |
| Quake       | Archer | 62.8       | 90°        | +6.6  | 14.5   | +0.2                | 165°        |
| Storm       | Storm  | 47.5       | 45°        | +6.4  | 21.7   | −1.0                | 180°        |
| Sniper      | Storm  | 49.4       | 105°       | +6.4  | 26.0   | −1.7                | 180°        |
| Archer      | Storm  | 50.1       | 90°        | +4.6  | 29.4   | +3.0                | 180°        |
| Vampire     | Storm  | 40.9       | 120°       | +3.2  | 20.4   | −1.9                | 180°        |
| Brawler     | Storm  | 49.1       | 45°        | +1.4  | 20.5   | −0.1                | 180°        |

(The matchups with a gain of 6.4 or more or a spread over 20; the full 121-row table is printed by
`scripts/aim-report.ts`.)

## 3. Is there a solved angle?

No single angle is best:

- Across the 121 matchups the best angle is spread over all 13: 0° 13, 15° 8, 30° 4, 45° 10, 60°
  13, 75° 7, 90° 14, 105° 16, 120° 6, 135° 4, 150° 7, 165° 13, 180° 6.
- **Straight at the opponent (0°)** is best in 13 matchups, gains −0.3 on average, and its median
  rank is 8th of 13. It is a poor default against the Archer (above) and fine elsewhere.
- **The best angle is not stable across seeds**: it is the same on both seed halves in only 21 of
  121 matchups (about 9 by chance with 13 angles), because most angles are within noise of each
  other.
- Per ball, no angle is best against more than 4 of its 11 opponents.

## 4. Do counters survive good aiming?

Held-out seeds 10000-10499, both slot orders, 1000 games per pair and profile.

| Profile                                                         | ok  | WARN | NEAR | MISS  |
| --------------------------------------------------------------- | --- | ---- | ---- | ----- |
| Today's random start (`pnpm balance 500`, seeds 0-499)          | 28  | 19   | 8    | 0     |
| Fixed spots, both aim randomly                                  | 28  | 16   | 6    | 5     |
| Both play their best angle against random aim (a fixed habit)   | 18  | 19   | 4    | 14    |
| Both play the solved mix (equilibrium of the blind aiming game) | 29  | 13   | 5    | **8** |

- **The two sides' angles interact far more than either does alone.** Against a random aimer one
  side's angle is worth a median +1.7. But when both commit to angles, the pair of angles
  matters: 4.3% of all angle-against-angle combinations are 80/20 or worse (Speedster vs Archer
  23% of its cells, Archer vs Quake 15%, Archer vs Thorns 14%; 64 games per cell, so a little of
  that is noise). Today no matchup is worse than 31/69.
- **So aiming is a guessing game, like the lineup.** Knowing an opponent's habitual angle (both
  play their best angle against random aim, and one side best-responds) is worth a **median +11.4
  points, over 15 in 18 of 55 pairs, over 20 in 9, max +31.9** (Thorns vs Quake). Against the
  **solved mix** the best response is worth only a median +1.7 (max +8.0). Mixing protects you.
- **Good aiming on both sides (the solved mix) misses the counter map in 8 pairs** (5 with random
  aim from the same spots). Most are the spots' misses again, a couple of points past the
  allowance: Vampire over Speedster 53.7, Quake over Speedster 51.8, Storm over Frost 52.2,
  Storm over Thorns 50.8, Berserker over Frost 55.0, Vampire vs Frost 54.4 / 42.8 (even). Two are
  out the other way: **Speedster over Archer goes to 81.0 / 18.6, beyond the 25/75 hard limit and
  the 20/80 target**, and Frost over Venom to 72.3.
- **Fixed habits break the map badly** (14 MISS): Speedster vs Sniper 73.8 / 25.8, Archer vs
  Frost flips to 39.5 / 60.2, Vampire vs Thorns 62.2 / 35.2.
- Solved play against random aim moves pairs by a median 1.7 points, max 13.5: once both sides
  play well, aiming mostly cancels out, apart from the Speedster against the Archer.

## 5. Aiming styles per ball

Average gain over random aim across all 11 opponents (points; ±0.5 is noise):

| Ball      | 0°   | 15°  | 30°  | 45°  | 60°  | 75°  | 90°  | 105° | 120° | 135° | 150° | 165° | 180° |
| --------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Brawler   | −0.0 | −0.4 | +0.4 | +1.7 | −0.2 | −0.2 | +0.6 | −0.9 | +0.0 | +0.1 | −0.3 | +0.4 | −2.2 |
| Speedster | −4.0 | −0.6 | −2.2 | −0.9 | +0.4 | −1.5 | −0.7 | +3.9 | +2.8 | +3.2 | +0.5 | −1.0 | −3.6 |
| Vampire   | +0.4 | +0.1 | +0.6 | −0.4 | +0.7 | −0.2 | +0.4 | −0.2 | +0.1 | −1.2 | +0.2 | +0.3 | −1.5 |
| Archer    | +1.8 | +1.8 | −0.9 | −0.5 | +0.3 | +1.0 | +1.3 | +1.3 | −1.4 | −0.0 | −0.4 | −1.4 | −4.1 |
| Storm     | −0.5 | −0.9 | +0.0 | +1.3 | −0.2 | −0.7 | −0.3 | +1.3 | −0.3 | +0.4 | +0.1 | +0.6 | −2.2 |
| Frost     | −1.6 | −0.8 | +0.0 | +0.4 | +0.1 | +0.2 | −0.5 | +0.5 | +0.3 | −0.1 | +0.5 | +0.6 | −1.0 |
| Thorns    | +0.3 | −0.2 | +0.8 | +1.6 | +0.2 | −0.3 | −0.3 | −0.5 | −1.0 | −0.1 | −0.2 | +0.1 | −0.3 |
| Venom     | +0.5 | −0.5 | −0.2 | +0.7 | +1.0 | +1.1 | +0.2 | +0.7 | −0.2 | −0.9 | −0.9 | −0.7 | −1.1 |
| Berserker | −0.3 | +0.1 | +0.8 | +0.9 | +1.0 | −0.5 | −0.8 | +0.1 | +0.0 | −0.7 | −0.3 | −0.0 | −1.2 |
| Sniper    | −1.4 | −1.9 | −0.9 | −0.3 | −0.4 | +1.4 | +3.6 | +3.5 | +1.9 | +0.9 | −0.8 | −3.9 | −4.9 |
| Quake     | +1.5 | −0.1 | −2.8 | −1.9 | +1.5 | +1.3 | +3.1 | +3.0 | −1.1 | +1.3 | +0.6 | −3.0 | −5.3 |

In plain language:

- **Speedster: away and to the side (105-135°), never head-on.** It banks wall bounces before the
  first hit: launched at 105-135° it reaches its first contact with 3.6-3.7 stacks, launched
  straight at the enemy with 1.8. Head-on (−4.0) and straight back (−3.6) are its worst.
- **Sniper and Quake: sideways (90-105°, about +3).** Both lose 4-5 points launching backwards.
  The mechanism was not isolated; both want to be moving across the arena rather than along the
  line between the spots.
- **Archer: forward (0-15°) is fine, straight back is its worst (−4.1).**
- **Everyone else (Brawler, Vampire, Storm, Frost, Thorns, Venom, Berserker): no style.** Their
  averages sit within about ±1.5 except that straight back is mildly bad for most.
- **By opponent rather than by ball:** never launch straight back against the Storm, and don't
  launch straight at the Archer. Those two rules are most of what aiming against a random opponent
  is worth.

## Mitigations measured

| Variant                          | Gain vs random aim (median / ≥5 / max) | Spread over 15 | Exploit a habit (median / max) | Solved: MISS | Speedster vs Archer, solved |
| -------------------------------- | -------------------------------------- | -------------- | ------------------------------ | ------------ | --------------------------- |
| As measured (spots 250 / 750)    | +1.7 / 20 of 121 / +11.1               | 12             | +11.4 / +31.9                  | 8            | 81.0                        |
| Cone ±60° around the opponent    | +0.6 / 3 / +5.8                        | 0              | +14.1 / +48.6                  | 12           | not a MISS                  |
| Wobble ±15° on every launch      | (not re-run)                           |                | +4.7 / +19.3                   | 6            | 81.7                        |
| Wobble ±30°                      | (not re-run)                           |                | +2.5 / +10.1                   | 8            | 78.6                        |
| Spots close together (400 / 600) | +2.5 / 25 / +10.3                      | 6              | (not run)                      | (not run)    | (not run)                   |
| Spots near the walls (100 / 900) | +1.1 / 17 / +16.7                      | 13             | (not run)                      | (not run)    | (not run)                   |

Wobble rows replay the same strategies with the launch turned by a seeded random angle; their
best responses were chosen without wobble, so "exploit a habit" there is a lower bound. Start-spot
variants ran the one-sided sweep only (200 seeds).

- **A cone removes the blunders and makes everything else worse.** No more 180°-against-the-Storm
  disaster, but aim matters even less against a random aimer, and with fewer choices a habit is
  more exploitable (max +48.6) and solved play misses 12 pairs. Its fixed-habit profile is
  dramatic: Speedster vs Vampire 7.4 / 92.6.
- **Wobble shrinks the guessing layer, as intended.** ±15° cuts the median habit exploit from
  +11.4 to +4.7 and leaves 6 MISS under solved play. It cannot fix Speedster vs Archer (81.7),
  and it makes aim matter even less against a random aimer, which is already the failing
  criterion.
- **Spots close together make aim matter a little more** (median +2.5, 25 matchups at +5) **but
  create a solved angle**: straight at the opponent becomes best in 38 of 121 matchups (median
  rank 3 of 13), and the Brawler wants 0° against 7 of 11 opponents (+5.2 on average).
- **Spots near the walls** make aim matter less (median +1.1) with bigger blunders (max spread
  35.8).

None of these reaches "aim matters in most matchups" while keeping the counters: the levers that
make one side's aim count more (closer spots) also make one angle right.

## Verdict: aiming does not pass

| Criterion                                                   | Result                                                                                                                                                                                                      | Pass?                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Aim matters: best-angle gain about 5+ in most matchups      | Median +1.7; only 20 of 121 at +5 or more                                                                                                                                                                   | **No**                        |
| Aim isn't dominant: no single-handed swing over about 15-20 | Best angle gains at most +11.1, but a blunder costs up to 29 (180° against the Storm), and reading an opponent's habit is worth over 15 in 18 of 55 pairs (max +31.9). Fine only if both sides play the mix | **No**, in the guessing layer |
| No single direction best everywhere                         | Best angles spread over all 13; 0° median rank 8 of 13                                                                                                                                                      | Yes                           |
| Counters survive good aiming (near-miss allowance)          | Solved play: 8 MISS (fixed spots alone: 5), and Speedster vs Archer 81.0 / 18.6 breaks the 25/75 hard limit                                                                                                 | **No**                        |

**What aiming actually is in this sim:** not a skill of finding the right angle, but a second
blind guessing game layered on the lineup guess. One side's angle hardly matters on its own, since
bounce variance and long fights wash out the launch, but the _pair_ of angles can matter a lot.
The skill it rewards is being unpredictable and reading the opponent's habits, plus two pieces of
knowledge (never launch backwards against the Storm, never straight at the Archer). Against a bot
that aims randomly, a player's aim would feel like it does nothing.

**If you still want a launch choice, the measurements point to:**

1. Fixed spots need a light retune first (5 pairs miss with random aim). Speedster vs Archer
   under good aiming needs a mechanical answer, not a stat nudge (ADR 0010): aimed launches let the
   Speedster bank wall stacks before the Archer's first arrows land.
2. A ±15° seeded wobble on the chosen direction if the guessing layer should stay small (habit
   exploit median +4.7, max +19.3).
3. Treating the launch as part of the read, shown to viewers (both arrows revealed at the start),
   rather than as an execution skill, because the numbers say it is the former.

The alternative is to drop aiming and look for skill elsewhere: something that acts during the
match, since a single input at tick 0 is mostly washed out by the 18-second fight that follows.
