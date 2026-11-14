# Experiment: aiming v2

> **Scripts:** the measuring scripts this cites (under `scripts/`) were never merged to `main`: they
> lived on the experiment's own branch. The numbers here are the record.

Measured 2026-11-07 on a throwaway branch, since deleted. **Decision: not adopted**; aiming is
dropped and the skill stays in the draft (`docs/vision.md`). The live game never changed. On the
branch the default paths were proven identical to `main`: the ruleset fingerprint was unchanged, the
golden matches passed, and `pnpm balance 50` output was byte-identical (same SHA-256). This
document is what was kept.

**Verdict in one line:** none of the three ideas gives aiming that matters modestly while keeping
the counters.

- The one setup that keeps the counters (today's random spots) makes the launch worth about
  2 points.
- The setups that make it worth more (fixed spots, an opening strike) break the counter map.
- Reveal with launches does widen the gap between good and bad play, but mostly by punishing
  bad launches, not by rewarding good ones.

## Why a second attempt

Aiming v1 (`docs/experiments/aiming-measurements.md`, ADR 0018) gave each side a free launch angle from fixed
spots. It failed in three ways:

1. One side's angle was worth a median +1.7 points, because wall bounces wash it out.
2. What mattered was the pair of angles. That is a blind guessing game, where reading a habit was
   worth up to +32 points.
3. It broke counters. The spots alone moved 5 pairs out of their bands, and Speedster vs Archer
   reached 81/19.

v2 tested three ideas built around those failures, with the success criteria set before any data
came in:

1. **A few clear launch choices** instead of a free angle.
2. **An opening strike:** the first clash of a round hits harder, so aiming for the first hit
   matters.
3. **Launches in Reveal's turns:** the side that shows first also locks its launch, and the
   answering side sees both before choosing.

It also tested a frame v1 never tried, **frame R**: keep today's random spots, and measure the
launch angle from the line to the opponent. With a launch drawn uniformly over every direction,
that is exactly today's game, so random aim can't move the counter map. That was v1's first
failure.

## Method

### Harness (not kept)

Recovered from v1 (`f7eaf8b`) rather than rebuilt, and deleted with the branch:

- **In the sim**, behind options the game never sets (`src/sim/world.ts`, `src/sim/combat.ts`,
  `src/sim/step.ts`):
  - `createWorld(seed, defs, start)` takes `fixed` (frame F: v1's spots (250, 500) and
    (750, 500)) or `relative` (frame R: today's spots and RNG state). Each comes with one integer
    launch vector per ball, normalised with `Math.sqrt` only (ADR 0001).
  - `WorldState.openingStrike` multiplies both contact hits of the first ball-to-ball contact. The
    hits still go through directness, the lethal tiebreak and Thorns' reflection.
  - Each path has a test, and each test was shown to fail with its behaviour broken.
- **Scripts** (`scripts/aim2-*.ts`, measurement only):
  - `aim2-measure` plays launch matrices and held-out profiles on every core.
  - `aim2-analysis` holds v1's folding, cross-validated gains and fictitious-play solver.
  - `aim2-survey` scores a menu as a sub-matrix of a survey.
  - `aim2-profiles` and `aim2-evaluate` check the counter map and the hard rules on held-out
    seeds.
  - `aim2-reveal-model` adds launches to the Reveal series model. Its tests check it reproduces
    `series-analysis.ts` exactly when there is a single launch.

### Conventions

- **Angles** are in each ball's own frame: 0° is straight at the opponent, 90° / 270° is
  sideways towards the bottom / top wall, and 180° is straight away.
  - Side B mirrors side A, so "towards the bottom wall" means the same on both sides of the screen.
  - Against a random opponent, an option and its mirror image (60° and 300°) are the same choice,
    so they are counted as one.
- **Honest numbers.** Anything chosen (a best option, a habit, a reply, the player's and the
  bot's choices in Reveal) is chosen on one half of the seeds and scored on the other, both ways
  round, as in v1.
- **Scores** in the survey and the Reveal model count a draw as half a win. Held-out win rates
  count draws as games, as `pnpm balance` does. Draws are 0.7%.

### Stages

1. **Survey.** A 12 × 12 matrix (every 30°) for all 153 pairs plus mirrors, in frames R and F.
   - 32 seeds × both slot orders, merged with mirror images: 128 games per cell.
   - Seven menus scored as sub-matrices.
2. **Chosen menus at depth.** The best menu in each frame, with the strike off, ×1.5 and ×2.
   - 100 seeds × both slot orders: about 400 games per cell after folding.
3. **Held-out profiles.** Seeds 10000-10499, both slot orders, 1,000 games per pair per profile:
   - today's start;
   - both uniform over the menu;
   - both play the solved mix;
   - one side's best reply to the solved mix;
   - one side's best reply to the other's habit.
4. **Reveal with launches.** Exact series chances over 600 evenly spaced lineup pairs against the
   three bot levels, from stage 2's odds.

Stage 1 and 2 numbers carry survey noise. Stage 3 is the clean read: about ±1.6 points per pair.

## 1. Survey: which menus

Frame R is today's random spots; frame F is v1's fixed spots. 272 ordered matchups, no mirrors.
"Gain" is the best option against a uniform opponent, minus choosing uniformly.

| Frame | Menu              | Gain median | Gain 3-8 | Best−worst over 12 | Habit read max | MISS (uniform / solved) | Worst side |
| ----- | ----------------- | ----------- | -------- | ------------------ | -------------- | ----------------------- | ---------- |
| R     | {0, ±60}          | +1.1        | 59       | 8                  | +20.2          | 3 / 4                   | 25.5       |
| R     | **{0, ±90}**      | **+2.2**    | 88       | 24                 | +23.4          | 1 / 1                   | 25.5       |
| R     | {0, ±60, 180}     | −0.2        | 63       | 5                  | +24.6          | 3 / 4                   | 27.6       |
| R     | {0, ±90, 180}     | +1.1        | 74       | 7                  | +16.7          | 1 / 1                   | 25.8       |
| R     | {0, ±60, ±120}    | +0.2        | 43       | 3                  | +20.1          | 2 / 3                   | 26.8       |
| R     | {0, ±90, ±150}    | +0.7        | 55       | 1                  | +24.8          | 0 / 1                   | 27.7       |
| R     | all 12            | +0.3        | 28       | 0                  | +20.1          | 2 / 3                   | 28.5       |
| F     | {0, ±60}          | +2.4        | 97       | 42                 | +37.6          | 5 / 6                   | 25.7       |
| F     | {0, ±90}          | +4.5        | 94       | 105                | +31.4          | 14 / 29                 | 9.4        |
| F     | **{0, ±60, 180}** | **+2.4**    | 105      | 57                 | +26.4          | 5 / 4                   | 26.7       |
| F     | {0, ±90, 180}     | +3.9        | 94       | 92                 | +30.8          | 20 / 28                 | 16.3       |
| F     | {0, ±60, ±120}    | +2.2        | 103      | 37                 | +35.4          | 16 / 16                 | 23.0       |
| F     | {0, ±90, ±150}    | +2.9        | 113      | 54                 | +34.0          | 4 / 5                   | 25.3       |

Two patterns:

- **v1's trade-off is still there.** Fixed spots make the launch count more, about +2.5 to +4.5
  against frame R's +1 to +2, because both balls start on the same line every time. But the same
  fixed geometry moves counters, more so the wider the options. In frame R the counters hold
  whatever the menu.
- **More options make each one matter less.** All 12 directions in frame R are worth +0.3. A small
  menu is more legible and also makes the choice count more.

Stage 2 took the best of each frame: R {0, ±90} ("at" or "wide") and F {0, ±60, 180} ("at",
"angled" or "back").

## 2. Chosen menus at depth, and the opening strike

| Frame, menu     | Strike | Gain median | Gain 3-8 (of 272) | Best−worst over 12 / max | Habit read over 12 / max | MISS (uniform / solved) | Worst side |
| --------------- | ------ | ----------- | ----------------- | ------------------------ | ------------------------ | ----------------------- | ---------- |
| R {0, ±90}      | off    | +1.8        | 77 (28%)          | 11 / 16.6                | 1 / +13.1                | 1 / 1                   | 26.9       |
| R {0, ±90}      | ×1.5   | +2.3        | 91 (33%)          | 21 / 19.9                | 1 / +12.3                | 22 / 18                 | 21.2       |
| R {0, ±90}      | ×2     | +2.5        | 98 (36%)          | 20 / 20.0                | 0 / +11.8                | 48 / 41                 | 16.5       |
| F {0, ±60, 180} | off    | +3.0        | 126 (46%)         | 46 / 26.4                | 38 / +27.3               | 12 / 7                  | 26.6       |
| F {0, ±60, 180} | ×1.5   | +3.5        | 139 (51%)         | 61 / 26.8                | 49 / +24.8               | 46 / 36                 | 20.2       |
| F {0, ±60, 180} | ×2     | +4.0        | 162 (60%)         | 75 / 26.6                | 65 / +25.5               | 66 / 62                 | 15.2       |

**The strike doesn't make aim matter; it makes contact matter.** It adds 0.5-1 point of aim value
and breaks the counter map with it: 18-48 MISS in frame R and 36-66 in frame F. Who gains, per
ball overall, frame R, both sides uniform, strike off → ×1.5 → ×2:

| Gains (contact balls)                         | Loses (ranged, timer, poison)         |
| --------------------------------------------- | ------------------------------------- |
| Magnet 53.0 → 56.9 → 59.9                     | Archer 54.0 → 46.2 → 38.7             |
| Vampire 51.9 → 55.1 → 58.7                    | Venom 46.8 → 40.4 → 35.0              |
| Thorns 50.4 → 54.4 → 58.4                     | Sniper 48.4 → 45.1 → 41.9             |
| Chrono, Titan, Brawler, Frost, Berserker +5-8 | Inferno, Quake, Necromancer −4 to −10 |

This is the same shift the bigger-balls experiment found: anything that makes a contact hit worth
more pays the contact balls and starves the ones whose damage arrives on a timer. The strike stops
at stage 2; no held-out run was made for it.

## 3. Held-out profiles (no strike)

Seeds 10000-10499. **Today's game on the same seeds:** 4 MISS, worst side 28.0. That is the noise
floor; `pnpm balance` judges on seeds 0-499, where today has none.

| Profile                          | R {0, ±90}: MISS / worst side     | F {0, ±60, 180}: MISS / worst side    |
| -------------------------------- | --------------------------------- | ------------------------------------- |
| Both uniform over the menu       | 7 / 25.1                          | 17 / **24.3** (Brawler vs Thorns)     |
| Both solved                      | 7 / 26.9                          | 15 / 25.1                             |
| One side replies to solved       | 8 / 26.6                          | 14-15 / **23.6** (Thorns vs Magnet)   |
| One side reads the other's habit | 10-14 / **24.2** (Venom vs Titan) | 35-44 / **13.0** (Speedster vs Frost) |

Bold is under the 25/75 hard limit. Every ball stays within 40-60% overall in every profile except
F's habit reads (Speedster 35.9, Inferno 37.6). Draws stay at 0.7% and the median match at 18.0-18.6 s.

How far aim alone moves a pair from both-uniform:

|                                       | Frame R                                    | Frame F                              |
| ------------------------------------- | ------------------------------------------ | ------------------------------------ |
| Solved play and replies to it: median | 2.1                                        | 3.1                                  |
| Same: max                             | 7.3 (Speedster vs Berserker); none over 10 | 9.1 (Archer vs Sniper); none over 10 |
| Reading a habit: median               | 1.9                                        | 4.9                                  |
| Reading a habit: max                  | 9.4; none over 12                          | 29.0; 32 of 272 over 12              |

In frame R, uniform over three options is not uniform over every direction. So frame R's
"uniform" differs from today by a mean of 2.2 points per pair (max 9.4), a little more than the
1.8 that noise alone gives. Frame F differs by a mean of 3.4 (max 11.7), as v1 found for its spots.

## 4. Reveal with launches

The rule:

- The side showing first locks its ball and its launch.
- The answering side sees both, then picks its ball and launch.
- Round 2 swaps, after the coin toss (ADR 0029).
- Round 3's launches are chosen at the same time.

The bots keep their ball choices (ADR 0035) and get launches:

| Bot    | Answering a shown launch       | Showing first                       | Round 3    |
| ------ | ------------------------------ | ----------------------------------- | ---------- |
| Easy   | random                         | random                              | random     |
| Normal | its best reply 60% of the time | random                              | random     |
| Hard   | its best reply                 | the launch with the best worst case | solved mix |

600 lineup pairs. Choices are made on one seed half and scored on the other.

| Frame, menu     | Bot    | Launch | Best  | Worst | Random | Gap      |
| --------------- | ------ | ------ | ----- | ----- | ------ | -------- |
| R {0, ±90}      | Easy   | none   | 54.8% | 45.9% | 50.3%  | 8.8      |
|                 |        | menu   | 58.0% | 42.5% | 50.3%  | **15.5** |
|                 | Normal | none   | 54.6% | 44.4% | 48.9%  | 10.2     |
|                 |        | menu   | 57.1% | 39.2% | 48.2%  | **17.9** |
|                 | Hard   | none   | 51.9% | 42.8% | 46.9%  | 9.1      |
|                 |        | menu   | 52.2% | 34.4% | 44.3%  | **17.8** |
| F {0, ±60, 180} | Easy   | none   | 54.8% | 46.5% | 50.7%  | 8.2      |
|                 |        | menu   | 61.4% | 39.2% | 50.7%  | **22.2** |
|                 | Normal | none   | 54.6% | 45.1% | 49.4%  | 9.5      |
|                 |        | menu   | 59.6% | 34.7% | 47.1%  | **25.0** |
|                 | Hard   | none   | 52.2% | 43.6% | 47.5%  | 8.6      |
|                 |        | menu   | 53.1% | 29.2% | 42.5%  | **23.9** |

"None" reproduces `docs/series-measurements.md` (a gap of 10.7 at Normal there, 10.2 here, from
other seeds), which checks the model.

- **The gap grows at every level, but from the bottom.** Against Hard, good play with launches gains
  +0.3 (frame R) or +0.9 (frame F), while bad play loses 8-14 points. A player choosing at random
  loses 0.7-5 points, because a bot that sees a shown launch punishes it.
- **Showing a launch first is a disadvantage you pay for, not a decision you win.** Across every
  shown launch and pair, the answering side's best launch reply is worth:

| Frame | Median | Over 12 points       | Max   |
| ----- | ------ | -------------------- | ----- |
| R     | +2.5   | 35 of 816 cases (4%) | +23.3 |
| F     | +7.5   | 300 of 1,088 (28%)   | +37.7 |

In frame F, the answering launch is a counter-pick inside the counter-pick.

## Per-ball styles (what a player would learn)

Frame R {0, ±90}, average gain of each option over all opponents:

| "At" is better (+1.4 to +2.9)                                                       | "Wide" is better (+1.0 to +2.6)                                                      | No style                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| Brawler, Vampire, Frost, Thorns, Berserker, Chrono, Titan: contact and sturdy balls | Speedster, Archer, Storm, Sniper, Quake, Inferno: ranged, zone and wall-bounce balls | Venom, Magnet, Ghost, Necromancer |

It is legible: "hitters go straight in, shooters go wide". But it is a habit per ball, not a read.
For 15 of 17 balls the same option is best against more than 60% of their opponents. A choice with
the same answer most of the time would feel like a chore, or like the game's default.

## Verdicts

| Criterion                                      | 1. Menus, frame R                                                       | 1. Menus, frame F                                 | 2. Opening strike                     | 3. Reveal launches, frame R                              | 3. Reveal launches, frame F    |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| Aim matters, modestly (best worth 3-8 in most) | **No**: median +1.8, 28% in 3-8                                         | **Almost**: median +3.0, 46% in 3-8               | Adds only 0.5-1 point                 | **No**: answering launch median +2.5                     | Yes: median +7.5               |
| Aim isn't dominant (no swing over about 10-12) | Yes with sensible play (max 7.3); 11 blunders over 12                   | **No**: 46 blunders over 12; habit reads up to 29 | **No**: 20-75 blunders over 12        | **No**: 4% of answers over 12, max +23.3                 | **No**: 28% over 12, max +37.7 |
| No single choice best everywhere               | Narrowly no: "wide" is best in 145 of 272 (53%); per ball no (15 of 17) | Narrowly no: "angled" is best in 138 of 272 (51%) | No: as without it ("angled" 53% in F) | (as frame R)                                             | (as frame F)                   |
| Counter map and hard rules hold                | **Yes**: 7 MISS vs today's 4 on the same seeds, worst 25.1              | **No**: 15-17 MISS, Brawler vs Thorns 24.3        | **No**: 18-66 MISS, worst side 15     | Yes (per round as frame R)                               | No                             |
| Reveal skill grows                             | n/a                                                                     | n/a                                               | n/a                                   | **On paper**: gap 10.2 → 17.9; good play only +0.3 to +3 | On paper: 9.5 → 25.0           |

In plain words:

1. **A few clear launch choices: fails.**
   - With today's random spots (frame R) it is safe but barely matters. The best choice is worth
     about 2 points, and what it teaches is a fixed per-ball habit.
   - With fixed spots (frame F) it matters about as much as wanted (median +3.0), but it breaks
     15-17 counter pairs and one hard limit. The guessing layer comes back, with habit reads worth
     up to 29.
   - This is v1's trade-off again: the lever that makes the launch count is the one that moves the
     counters.
2. **Opening strike: fails clearly.** It adds under a point of aim value, and it moves the whole
   balance towards contact balls. The Archer falls 15 points and the Venom 12 at ×2, and even ×1.5
   breaks 18-46 counter pairs. A smaller strike would only do less of the same.
3. **Launches in Reveal's turns: fails in spirit, though it passes the letter of "the gap grows".**
   - The gap nearly doubles, but good play gains almost nothing against Hard (+0.3) while bad and
     random play lose.
   - The answering side's launch reply is sometimes decisive: over 12 points in 4% of cases in
     frame R and 28% in frame F.
   - It feels like a choice, but mostly it is a way to make mistakes the bot can see and punish.

## What the data suggests instead

- **A single input at tick 0 is washed out.** This is now true across v1, bigger balls and v2.
  The launch decides the first second or two; the rest of an 18-second fight decides the match.
  Fixed spots make the launch matter only because the fight then starts the same way every time,
  and that sameness is what moves the counters.
- **If a launch is wanted for flavour,** frame R with {at, wide} is safe.
  - Both-uniform and solved play stay within noise of today's counters, and no sensible-play swing
    goes over 7.3 points.
  - It should be shown to both sides at the start, as v1 already suggested.
  - It shouldn't be sold as skill: its honest value is about 2 points.
  - Making it each ball's default launch (hitters straight in, shooters wide) would give the same
    look with no decision at all.
- **Skill beyond the draft needs an input during the fight,** where it isn't washed out. That needs
  its own experiment, and nothing here measures it.

## The code

The harness was not merged: an experiment's sim options are dead code once the answer is no (the
lesson of ADR 0018's addendum). Its shape is described under Method. To measure aiming again,
start from v1's harness at `f7eaf8b`, add the two start frames and the strike as described above,
and reuse the criteria and the cross-validation in this document. Rough cost on a 16-thread
machine: about 18 minutes per 12 × 12 survey frame, 4-6 minutes per menu matrix at 100 seeds,
about 10 minutes per held-out profile set, and a few minutes for the Reveal analysis.
