# Series: what the player's choices are worth against each bot level

Measured 2026-11-07 for ADR 0035 (ruleset 6, 17 balls), for ADR 0043 (ruleset 7, 21 balls) and
again on 2026-11-08 for ADR 0045 (ruleset 8, the roster redesign's first group, and ruleset 9, its
second group, ruleset 10, its third, and on 2026-11-12 ruleset 11, its fourth: the tables below): the three bot levels in Reveal and Showdown. Scripts: `scripts/series-analysis.ts` (the maths, unit-tested) and
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
| Reveal   | Easy      | 56.1% | 45.2% | 50.6%  | 10.9 pts | 98.2% | 74.9% / 75.0%                   |
| Reveal   | Normal    | 55.8% | 43.4% | 49.3%  | 12.4 pts | 98.4% | 74.9% / 75.0%                   |
| Reveal   | Hard      | 53.2% | 41.5% | 47.0%  | 11.7 pts | 97.3% | 74.9% / 74.9%                   |
| Reveal   | first bot | 55.8% | 41.7% | 48.4%  | 14.1 pts | 98.6% | 74.8% / 75.0%                   |
| Showdown | Easy      | 53.5% | 47.7% | 50.6%  | 5.8 pts  | 87.2% | 71.9% / 75.0%                   |
| Showdown | Normal    | 55.0% | 45.1% | 50.1%  | 9.9 pts  | 93.6% | 72.6% / 74.4%                   |
| Showdown | Hard      | 52.9% | 44.6% | 49.1%  | 8.3 pts  | 97.0% | 71.7% / 73.5%                   |

### Counter-map odds

| Format   | Bot    | Best  | Worst | Random | Gap     | Moved | Round 1 decides (best / random) |
| -------- | ------ | ----- | ----- | ------ | ------- | ----- | ------------------------------- |
| Reveal   | Easy   | 53.3% | 46.6% | 49.9%  | 6.7 pts | 89.5% | 75.0% / 75.0%                   |
| Reveal   | Normal | 53.1% | 45.3% | 48.8%  | 7.7 pts | 89.5% | 74.9% / 75.0%                   |
| Reveal   | Hard   | 50.0% | 44.2% | 46.9%  | 5.8 pts | 71.0% | 74.9% / 75.0%                   |
| Showdown | Easy   | 51.7% | 48.2% | 49.9%  | 3.5 pts | 46.2% | 73.2% / 75.0%                   |
| Showdown | Normal | 52.7% | 46.4% | 49.5%  | 6.2 pts | 89.5% | 73.5% / 74.5%                   |
| Showdown | Hard   | 50.0% | 46.3% | 48.7%  | 3.6 pts | 46.0% | 72.2% / 73.7%                   |

### Whole series played (a random player, 1,000 series per row, ± 2 standard errors)

| Format   | Easy        | Normal      | Hard        |
| -------- | ----------- | ----------- | ----------- |
| Reveal   | 52.0% ± 3.2 | 50.3% ± 3.2 | 47.1% ± 3.2 |
| Showdown | 52.4% ± 3.2 | 51.7% ± 3.2 | 51.2% ± 3.2 |

The played series agree with the model's random play within their noise in every row (ruleset
11, the redesign's fourth group). With measured odds the choices are worth more than at ruleset 10:
the Reveal gaps grow from 9-10 to 11-12 points and Showdown's from 5-8 to 6-10, since every ball
now has counters both ways. With the map's odds the gaps shrink a little and Showdown against the
Easy and Hard bots moves fewer lineup pairs (46%, from 61%): those bots read the map, and with 51
counters spread across every ball they leave fewer lineups where one choice stands out. The levels
and round-1 shares below still hold.

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
  best-playing player can find a little more against it (Showdown 52.9% and Reveal 53.2% with measured odds, 50.0% with the
  map's).
