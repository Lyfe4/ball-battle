# Series: what the player's choices are worth against each bot level

Measured 2026-11-07 (ruleset 6, 17 balls) for ADR 0035: the three bot levels in Reveal and
Showdown. Scripts: `scripts/series-analysis.ts` (the maths, unit-tested) and
`scripts/series-measure.ts` (runs it). Reveal's earlier measurements are in
`docs/reveal-measurements.md`.

## Method

- **Round odds** come from two sources, as in `docs/reveal-measurements.md`:
  - the counter map's odds: favoured 64%, even 50%, unfavoured 36%;
  - measured odds: every ordered pair played from slot A over 200 seeds (57,800 matches), with a
    draw counting as half.
- **Lineups:** 20,105 evenly spaced pairs out of all 462,400 pairs of three-ball lineups.
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
| Reveal   | Easy      | 54.7% | 45.4% | 50.0%  | 9.3 pts  | 97.7% | 74.9% / 75.0%                   |
| Reveal   | Normal    | 54.4% | 43.7% | 48.7%  | 10.7 pts | 98.4% | 74.8% / 75.0%                   |
| Reveal   | Hard      | 51.9% | 42.0% | 46.7%  | 9.9 pts  | 96.5% | 74.8% / 75.0%                   |
| Reveal   | first bot | 54.4% | 42.2% | 47.8%  | 12.2 pts | 98.8% | 74.8% / 75.0%                   |
| Showdown | Easy      | 52.5% | 47.6% | 50.0%  | 4.9 pts  | 82.2% | 72.3% / 75.0%                   |
| Showdown | Normal    | 53.9% | 45.1% | 49.5%  | 8.8 pts  | 95.4% | 73.1% / 74.4%                   |
| Showdown | Hard      | 51.6% | 44.9% | 48.6%  | 6.6 pts  | 93.5% | 72.1% / 73.6%                   |

### Counter-map odds

| Format   | Bot    | Best  | Worst | Random | Gap      | Moved | Round 1 decides (best / random) |
| -------- | ------ | ----- | ----- | ------ | -------- | ----- | ------------------------------- |
| Reveal   | Easy   | 54.4% | 45.5% | 50.0%  | 8.9 pts  | 97.0% | 74.9% / 75.0%                   |
| Reveal   | Normal | 53.9% | 43.7% | 48.4%  | 10.2 pts | 97.0% | 74.8% / 75.0%                   |
| Reveal   | Hard   | 50.0% | 42.2% | 46.0%  | 7.8 pts  | 84.5% | 74.9% / 75.0%                   |
| Showdown | Easy   | 52.3% | 47.7% | 50.0%  | 4.7 pts  | 69.6% | 72.5% / 75.0%                   |
| Showdown | Normal | 53.5% | 45.2% | 49.4%  | 8.4 pts  | 97.0% | 73.0% / 74.3%                   |
| Showdown | Hard   | 50.0% | 45.2% | 48.3%  | 4.8 pts  | 68.9% | 71.4% / 73.2%                   |

### Whole series played (a random player, 1,000 series per row, ± 2 standard errors)

| Format   | Easy        | Normal      | Hard        |
| -------- | ----------- | ----------- | ----------- |
| Reveal   | 51.5% ± 3.2 | 50.4% ± 3.2 | 46.4% ± 3.2 |
| Showdown | 52.0% ± 3.2 | 51.0% ± 3.2 | 51.7% ± 3.2 |

The played series agree with the model's random play within their noise for Reveal. Showdown's
Hard row sits about 3 points above the model, just inside the noise; slot A's small edge in the
simulation is about half a point.

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
