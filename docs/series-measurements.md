# Series: what the player's choices are worth against each bot level

Measured 2026-11-07 for ADR 0035 (ruleset 6, 17 balls) and again for ADR 0043 (ruleset 7, 21
balls, the tables below): the three bot levels in Reveal and Showdown. Scripts: `scripts/series-analysis.ts` (the maths, unit-tested) and
`scripts/series-measure.ts` (runs it). Reveal's earlier measurements are in
`docs/reveal-measurements.md`.

## Method

- **Round odds** come from two sources, as in `docs/reveal-measurements.md`:
  - the counter map's odds: favoured 64%, even 50%, unfavoured 36%;
  - measured odds: every ordered pair played from slot A over 200 seeds (88,200 matches), with a
    draw counting as half.
- **Lineups:** 20,102 evenly spaced pairs out of all 1,768,900 pairs of three-ball lineups.
- **Exact expectations over the bot's choices.** The bot's choices are read from its own `weights`
  (`src/sim/bot.ts`), so the model is the bot. Rounds are independent and the series is first to
  two.
- **The player plays three ways:**
  - _best_: knows how the bot weighs each choice, the most a player can learn about it;
  - _worst_: the same choices, made badly;
  - _random_.
- **Gap** is best minus worst: what the choices are worth.
- **Moved** is the share of lineup pairs where choices move the series chance by 3 points or more.
- **Round 1 decides** is how often the winner of round 1 takes the series. Independent 50/50
  rounds give 75%.
- **Reveal's coin toss** is fair, so each Reveal pair is the average of the two orders.
- **Check:** 1,000 whole series per format and level, played with the game's own simulation:
  random lineups, a random player and the real bot through `botPick`.

Run it with:

```bash
node scripts/reveal-measure.ts 200 --save rates.json
node scripts/series-measure.ts 20000 --rates rates.json --series 1000
```

The first command takes about 6 minutes. The second takes about 2 minutes, most of it the whole
series.

## Results

### Measured odds

| Format   | Bot       | Best  | Worst | Random | Gap      | Moved | Round 1 decides (best / random) |
| -------- | --------- | ----- | ----- | ------ | -------- | ----- | ------------------------------- |
| Reveal   | Easy      | 54.7% | 45.6% | 50.2%  | 9.1 pts  | 97.6% | 74.9% / 75.0%                   |
| Reveal   | Normal    | 54.5% | 44.1% | 49.0%  | 10.4 pts | 98.3% | 74.9% / 75.0%                   |
| Reveal   | Hard      | 52.4% | 42.5% | 47.2%  | 9.9 pts  | 96.6% | 74.9% / 75.0%                   |
| Reveal   | first bot | 54.5% | 42.6% | 48.2%  | 11.9 pts | 98.7% | 74.8% / 75.0%                   |
| Showdown | Easy      | 52.6% | 47.8% | 50.2%  | 4.8 pts  | 80.8% | 72.4% / 75.0%                   |
| Showdown | Normal    | 53.9% | 45.5% | 49.7%  | 8.4 pts  | 94.1% | 73.2% / 74.5%                   |
| Showdown | Hard      | 52.0% | 45.2% | 48.9%  | 6.8 pts  | 93.7% | 72.3% / 73.7%                   |

### Counter-map odds

| Format   | Bot    | Best  | Worst | Random | Gap     | Moved | Round 1 decides (best / random) |
| -------- | ------ | ----- | ----- | ------ | ------- | ----- | ------------------------------- |
| Reveal   | Easy   | 54.1% | 46.0% | 50.0%  | 8.1 pts | 94.4% | 74.9% / 75.0%                   |
| Reveal   | Normal | 53.7% | 44.4% | 48.6%  | 9.3 pts | 94.4% | 74.9% / 75.0%                   |
| Reveal   | Hard   | 50.0% | 43.0% | 46.4%  | 7.1 pts | 79.8% | 74.9% / 75.0%                   |
| Showdown | Easy   | 52.2% | 47.9% | 50.0%  | 4.3 pts | 61.5% | 72.7% / 75.0%                   |
| Showdown | Normal | 53.3% | 45.7% | 49.5%  | 7.6 pts | 94.4% | 73.2% / 74.4%                   |
| Showdown | Hard   | 50.0% | 45.6% | 48.5%  | 4.4 pts | 60.9% | 71.8% / 73.4%                   |

### Whole series played (a random player, 1,000 series per row, ± 2 standard errors)

| Format   | Easy        | Normal      | Hard        |
| -------- | ----------- | ----------- | ----------- |
| Reveal   | 49.9% ± 3.2 | 50.6% ± 3.2 | 47.5% ± 3.2 |
| Showdown | 50.0% ± 3.2 | 50.1% ± 3.2 | 50.4% ± 3.2 |

The played series agree with the model's random play within their noise in every row (ruleset
7, 21 balls). With four more balls every number moved by under a point: the levels, gaps and
round-1 shares below still hold.

## What it says

- **The levels are close, by the nature of soft counters.** The best a player can do moves from
  about 55% (Easy) to about 52% (Hard), and random play from 50% to 47%.
  - Against the counter map's own odds, Hard at best play is exactly 50%, the fair value: tough but
    not hopeless.
  - An Easy bot drawing its lineup after the player's, leaning toward balls the player counters,
    added only about 2.5 points, so it was not built.
- **Choices matter at every level.** Good play is worth 5 to 11 points, and in most lineup pairs
  choices move the odds by 3 points or more.
- **Hard is harder to exploit than to beat.** Its gap is smaller than Normal's, because it never
  hands out a free counter. In Showdown's round 1 its mix leaves every opener worth the same, so
  the opener can't be read.
- **Reveal has more skill than Showdown at every level.** Showdown's round 1 is a guess, and only
  round 2 gives one side information.
- **Showdown has a small comeback effect.** Its winner shows first next, so round 1 decides the
  series 72-73% of the time, against 75% with independent rounds.

## Limits

- Rounds are treated as independent; the sim has no momentum.
- "Best play" knows the bot's weights. A real player learns them only roughly, so real results sit
  between best and random play.
- Hard models the odds with the counter map, not measured odds. Where the two differ, a
  best-playing player can find a little more against it (51.9% with measured odds, 50.0% with the
  map's).
