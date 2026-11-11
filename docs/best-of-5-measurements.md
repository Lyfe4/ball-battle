# Best of 5, and Reveal against Showdown: measurements

Measured 2026-11-12 on ruleset 11 (21 balls, the roster redesign's fourth group). Measurement only:
the game, the sim and the ruleset are unchanged, and the game stays Best of 3. Scripts:
`scripts/best-of-5-measure.ts` (the model), `scripts/best-of-5-play.ts` (whole series with the
game's own fights, as a check), `scripts/best-of-n-bot.ts` (Hard for any lineup size) and
`scripts/series-analysis.ts` (now first to a majority of the lineup, so Best of 3 is unchanged).

## The Best of 5 rules measured

Kept as close to Best of 3 as possible: the same three formats, one ball per round, no repeats.

- **Five balls each, first to three.** Five is the natural size: every round still uses a fresh
  ball, the last round is forced exactly as round 3 is now, and a lineup of four would need a
  repeat for a 2-2 decider.
- **Blind:** both orders set before round 1, played in order.
- **Reveal:** the seeded coin decides who shows first in round 1, then the sides alternate (the
  toss winner shows first in rounds 1 and 3, the other side in rounds 2 and 4). Round 5 is the ball
  each side has left. Each side shows first twice, so it stays even.
- **Showdown:** round 1 both open at once; in rounds 2-4 the winner of the last round shows first
  and the loser answers; round 5 is forced.
- **Bots:** Easy and Normal need no change (their rules don't depend on the lineup size). Hard
  needs two: wins needed are read from the view (balls left plus rounds played), and positions are
  memoised; Showdown's opener solves the 5 × 5 game by trying every square support, where the
  sim's solver is exact only up to 3 × 3. At Best of 3 it makes exactly the sim's Hard choices
  (`best-of-n-bot.test.ts`). **No approximation was needed:** a cold Hard choice takes 2-11 ms
  (show 7 ms, answer 2 ms, Showdown opener 10 ms) and a warm one under 0.5 ms.

## Method

- **Odds:** measured, every ordered pair over 200 seeds (88,200 fights), a draw as half.
  Counter-map odds were also run and tell the same story (smaller numbers, same order).
- **Exact model** (as `docs/series-measurements.md`): 4,003 evenly spaced lineup pairs at Best of
  3, 1,001 at Best of 5, exact over the bots' own weights. The player plays best (knows the bot's
  weights), worst, or at random. Error bars are 2 standard errors over lineup pairs.
- **Played out:** 12,000 series per row on the model (3 per pair at Bo3, 12 at Bo5) for series
  length, comebacks and single decisions; 2 standard errors.
- **Real fights:** 4,000 whole series per format and bot with the game's simulation, a random
  player. They agree with the model's random play within noise in every row (e.g. Best of 5 Reveal
  against Easy, Normal, Hard: model 50.9 / 48.2 / 44.5%, played 50.8 / 46.8 / 44.5%).

## Results (measured odds)

### Skill: best play, worst play and the gap (± 2 SE)

| Format   | Bot    | Bo3 best   | Bo3 worst  | **Bo3 gap**    | Bo5 best   | Bo5 worst  | **Bo5 gap**    |
| -------- | ------ | ---------- | ---------- | -------------- | ---------- | ---------- | -------------- |
| Blind    | any    | 50.6 ± 0.2 | 50.6 ± 0.2 | **0.0**        | 50.9 ± 0.2 | 50.9 ± 0.2 | **0.0**        |
| Reveal   | Easy   | 56.0 ± 0.2 | 45.1 ± 0.2 | **10.9 ± 0.1** | 60.8 ± 0.3 | 41.0 ± 0.3 | **19.8 ± 0.3** |
| Reveal   | Normal | 55.8 ± 0.2 | 43.4 ± 0.2 | **12.5 ± 0.2** | 60.3 ± 0.3 | 37.7 ± 0.3 | **22.6 ± 0.3** |
| Reveal   | Hard   | 53.1 ± 0.2 | 41.4 ± 0.2 | **11.8 ± 0.2** | 56.7 ± 0.3 | 33.8 ± 0.4 | **22.9 ± 0.4** |
| Showdown | Easy   | 53.5 ± 0.2 | 47.6 ± 0.2 | **5.8 ± 0.1**  | 58.5 ± 0.3 | 43.3 ± 0.3 | **15.2 ± 0.2** |
| Showdown | Normal | 54.9 ± 0.2 | 45.1 ± 0.2 | **9.9 ± 0.2**  | 59.6 ± 0.3 | 39.3 ± 0.3 | **20.2 ± 0.3** |
| Showdown | Hard   | 52.8 ± 0.2 | 44.5 ± 0.2 | **8.3 ± 0.1**  | 56.0 ± 0.3 | 36.5 ± 0.3 | **19.6 ± 0.3** |

Best of 3 reproduces `docs/series-measurements.md` to 0.1 points.

### Bot spread: how differently the levels play (series chance, ± 0.4)

| Format   | Player | Bo3 Easy / Normal / Hard | Bo3 spread | Bo5 Easy / Normal / Hard | Bo5 spread |
| -------- | ------ | ------------------------ | ---------- | ------------------------ | ---------- |
| Reveal   | best   | 56.0 / 55.8 / 53.1       | 2.9 pts    | 60.8 / 60.3 / 56.7       | 4.1 pts    |
| Reveal   | random | 50.6 / 49.2 / 47.0       | 3.6 pts    | 50.9 / 48.2 / 44.5       | 6.4 pts    |
| Showdown | best   | 53.5 / 54.9 / 52.8       | 2.1 pts    | 58.5 / 59.6 / 56.0       | 3.6 pts    |
| Showdown | random | 50.6 / 50.1 / 49.0       | 1.6 pts    | 50.9 / 49.2 / 46.3       | 4.6 pts    |

Spread is the highest level minus the lowest. Against the counter map's own odds Hard stays the
fair 50% at best play in both lengths (Bo5: Reveal 50.4%, Showdown 50.7%).

### How often choices matter

| Format   | Bot    | Lineup pairs moved 3+ pts (Bo3 → Bo5) | Single decisions that move the odds 3+ pts, best play (Bo3 → Bo5) | Decisions that are reads (Bo3 → Bo5) |
| -------- | ------ | ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Blind    | any    | 0% → 0%                               | none (one blind guess)                                            | 0% → 0%                              |
| Reveal   | Easy   | 98.4 → 100%                           | 57.8 → 59.1% (± 0.6)                                              | 50 → 50%                             |
| Reveal   | Normal | 98.6 → 100%                           | 69.2 → 81.9%                                                      | 50 → 50%                             |
| Reveal   | Hard   | 97.2 → 100%                           | 62.3 → 79.5%                                                      | 50 → 50%                             |
| Showdown | Easy   | 87.0 → 100%                           | 28.6 → 42.8%                                                      | 26 → 35%                             |
| Showdown | Normal | 93.6 → 100%                           | 58.1 → 74.0%                                                      | 25 → 35%                             |
| Showdown | Hard   | 97.4 → 100%                           | 42.6 → 66.8%                                                      | 25 → 35%                             |

A read is a choice made after seeing the bot's ball (an answer); a guess is made before (showing
first, or Showdown's opener).

### Length, early finishes and comebacks (± 2 SE)

| Format   | Rounds Bo3 | Rounds Bo5 | Fights with replays (real) Bo3 → Bo5 | Over early Bo3 (2-0) | Over early Bo5 (3-0, 3-1) | Comeback after losing round 1, Bo3 → Bo5 | Comeback from 0-2, Bo5 |
| -------- | ---------- | ---------- | ------------------------------------ | -------------------- | ------------------------- | ---------------------------------------- | ---------------------- |
| Blind    | 2.50       | 4.12       | 2.53 → 4.17                          | 50 ± 1%              | 62 ± 1%                   | 25 → 31 ± 1%                             | 12 ± 1%                |
| Reveal   | 2.50       | 4.11-4.13  | 2.53 → 4.15                          | 49-50 ± 1%           | 62-63 ± 1%                | 25 → 31 ± 1%                             | 12-13 ± 1%             |
| Showdown | 2.50-2.53  | 4.12-4.20  | 2.53 → 4.19                          | 47-50 ± 1%           | 59-63 ± 1%                | 25-28 → 32 ± 1%                          | 12-13 ± 1%             |

**Rough time per series** (16 s a fight, about 8 s per pick decision, about 10 s per ball when
building a lineup, about 4 s between rounds):

| Format          | Best of 3        | Best of 5        |
| --------------- | ---------------- | ---------------- |
| Blind           | about 1 min 20 s | about 2 min 15 s |
| Reveal/Showdown | about 1 min 40 s | about 2 min 45 s |

Fights alone go from about 40 s to about 67 s. A Best of 5 is about 65-70% longer.

## Verdict on Best of 5

**A clear gain in skill, worth building as a longer option beside Best of 3, not as a
replacement.**

- Good drafting is worth about **twice as much**: Reveal's gap goes from 11-12 to 20-23 points,
  Showdown's from 6-10 to 15-20. More rounds have information in them, so reads compound.
- The bot levels **spread out** (Reveal against a random player: 3.6 → 6.4 points), so Easy and
  Hard feel more different, which soft counters had capped at Best of 3.
- **Every lineup pair** now has choices that matter, and more single decisions count.
- Comebacks get a little more common (25% → 31% after losing round 1; 12% from 0-2), so a bad
  first round hurts less.
- The cost is time: about 2 min 45 s against 1 min 40 s, the last round is played 38% of the time
  (50% at Best of 3), and a lineup of five out of 21 balls is a bigger ask for a newcomer. Best of
  3 stays the quick default on a phone; Best of 5 is the "serious" option.
- Blind gains nothing from Best of 5 but length: the order still can't be read.

### Rough build cost: medium

- **Sim (small-medium):** the lineup size and wins needed become part of the setup (`length: 3 |
5`, absent = 3) instead of the `LINEUP_SIZE` / `WINS_NEEDED` constants; `Lineup` stops being a
  3-tuple; `revealTurnsOf` alternates over four rounds and `showdownTurnsOf` follows each winner;
  Hard takes the memo and the general solver from `scripts/best-of-n-bot.ts` (the Best of 3
  choices stay identical, which its test checks). Whether that needs a `RULESET_VERSION` bump is a
  judgement call: no Best of 3 series changes, but the convention says bump when in doubt, and
  `pnpm golden` is cheap.
- **verifySeries (small):** check five-ball lineups and up to 8 picks for a Best of 5. Verifying
  plays up to 5 rounds plus replays: still well under a second.
- **Links and reload saving (small):** links already carry `mode=bo3`, so `mode=bo5` names it;
  `readPicks` takes its min/max from the length; the saved session carries the setup, so it only
  needs the length and a test that an old save still restores as Best of 3.
- **UI (medium, the main risk):** the lineup builder takes five; the series track and score line
  show five rings and "first to 3"; the pick rows become a 5 × 5 type chart, six 44 px targets
  wide on a 375 px phone, which is tight with the marks and must not squeeze the court (ADR 0039);
  the rules step offers the length; series text and the ready card. `no-dead-end.test.ts` and the
  browser flows walk about twice as many states.
- **Main risks:** the phone pick rows at 390 × 664; test time growing with the state walk; a new
  player facing five picks from 21 balls (a "suggest a lineup" button would help).

## Reveal against Showdown

| Measure (measured odds, Normal bot)   | Reveal Bo3 | Showdown Bo3 | Reveal Bo5 | Showdown Bo5 |
| ------------------------------------- | ---------- | ------------ | ---------- | ------------ |
| Skill gap (best − worst)              | 12.5 pts   | 9.9 pts      | 22.6 pts   | 20.2 pts     |
| Skill gap against Hard                | 11.8 pts   | 8.3 pts      | 22.9 pts   | 19.6 pts     |
| Bot spread, random player             | 3.6 pts    | 1.6 pts      | 6.4 pts    | 4.6 pts      |
| Single decisions that matter (Hard)   | 62%        | 43%          | 80%        | 67%          |
| Decisions that are reads, not guesses | 50%        | 25%          | 50%        | 35%          |
| Comeback after losing round 1         | 25%        | 28%          | 31%        | 32%          |

Blind, for reference: no skill in the order at either length (gap 0.0), every choice a guess.

- **Skill:** Reveal leads at every level and both lengths. Showdown closes the gap at Best of 5
  (rounds 2-4 all have a winner showing first), but never overtakes.
- **Guess or read:** in Reveal half of the player's decisions are answers to a ball already shown,
  in both lengths. Showdown's opener is a pure guess, and against Hard it is an equilibrium in
  which no opener is better than another: the most visible moment of the series has no skill in it.
- **Understanding:** Reveal is one rule ("a coin decides who shows first, then take turns"); every
  answer has the odds on screen. Showdown's opener is dramatic but its later rule is
  counter-intuitive for a newcomer: winning a round means showing first, which is the weaker seat.
- **Phone play:** the same screens either way; Reveal's bot shows straight away when it leads
  (ADR 0029), so a round never waits on a "Play round" that only reveals.
- **Async PvP:** both fit `verifySeries`, saved lineups and server seeds, since every pick is
  recorded and the toss comes from the server's seed. Showdown needs one fewer hand-off (its opener
  is two simultaneous submissions, which a server must hold sealed until both arrive), but against
  a saved lineup someone must play the absent side's picks either way (a bot level driving the
  saved lineup), so the difference is small. Reveal's toss needs no extra field: a server-issued
  seed decides it.

### Recommendation: Reveal as the main mode on the home screen

1. **More skill, at every bot level and both lengths:** a 12.5 vs 9.9 point gap at Best of 3,
   22.6 vs 20.2 at Best of 5, with more single decisions that matter.
2. **Half of all decisions are reads, not guesses,** which is what the game's vision says the fun
   is ("a read of the opponent").
3. **The bot levels are more distinct** (3.6 vs 1.6 points for a random player at Best of 3), so
   choosing Easy or Hard means something.

**The main downside:** a coin decides who shows first. It is fair (ADR 0029: about 0.5 points
either way) but it can feel like luck, and it is one more thing to explain than "open together".

**What Showdown is still good for:** head-to-head play between two people, live or async, where a
simultaneous opener is exciting and needs no coin; a slightly stronger comeback; and at Best of 5
it is nearly as skilful as Reveal, so a "Showdown, Best of 5" option is a reasonable second mode.

This is a recommendation, not a decision: ADR 0035 left the PvP default open until both formats
are played.

## Surprises

- **The gap almost doubles, more than the extra rounds alone explain.** Rounds go from 2.5 to 4.1
  on average, about 1.6 times, but the gap goes up 1.8-2.6 times: later rounds have fewer balls
  left on both sides, so a read narrows the bot's options more.
- **Hard stops being harder to exploit than Normal.** At Best of 3 its gap is smaller than
  Normal's; at Best of 5 they are level (22.9 vs 22.6 in Reveal). Its "never hand out a free
  counter" rule protects it less over more rounds.
- **Blind does not change at all with length:** its order has exactly no value against a random
  bot order at either size, so a Best of 5 Blind is a longer coin flip.
- **Showdown's comeback effect fades.** At Best of 3 a round-1 loser comes back 28% of the time
  against Reveal's 25%; at Best of 5 both are about 31-32%.

## Limits

- Rounds are treated as independent (the sim has no momentum), and "best play" knows the bot's
  weights; a real player sits between best and random.
- Lineup building is not measured: all numbers start from a given pair of lineups.
- The time per series is an estimate from the fight length, not timed play.

## Run it

```bash
node scripts/reveal-measure.ts 200 --save rates.json
node scripts/best-of-5-measure.ts --size 3 --format reveal --pairs 4000 --series 3 --rates rates.json
node scripts/best-of-5-measure.ts --size 5 --format reveal --pairs 1000 --series 12 --rates rates.json
node scripts/best-of-5-play.ts --size 5 --format reveal --series 4000
```

Run each size and format (`blind`, `reveal`, `showdown`) as its own process to use every core.
The Best of 5 exact model takes 5-8 minutes per format at 1,000 pairs; the rest take seconds to
4 minutes.
