# Series: what the player's choices are worth against each bot level

Measured 2026-11-07 for ADR 0035 (ruleset 6, 17 balls), for ADR 0043 (ruleset 7, 21 balls) and
again on 2026-11-08 for ADR 0045 (ruleset 8, the roster redesign's first group, and ruleset 9, its
second group: the tables below): the three bot levels in Reveal and Showdown. Scripts: `scripts/series-analysis.ts` (the maths, unit-tested) and
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
| Reveal   | Easy      | 55.0% | 46.1% | 50.6%  | 8.9 pts  | 96.5% | 74.9% / 75.0%                   |
| Reveal   | Normal    | 54.9% | 44.8% | 49.5%  | 10.2 pts | 97.3% | 74.9% / 75.0%                   |
| Reveal   | Hard      | 52.9% | 43.2% | 47.8%  | 9.7 pts  | 95.4% | 74.9% / 75.0%                   |
| Reveal   | first bot | 55.0% | 43.4% | 48.8%  | 11.6 pts | 97.7% | 74.9% / 75.0%                   |
| Showdown | Easy      | 52.9% | 48.2% | 50.6%  | 4.7 pts  | 76.4% | 72.5% / 75.0%                   |
| Showdown | Normal    | 54.3% | 46.1% | 50.2%  | 8.2 pts  | 90.3% | 73.2% / 74.5%                   |
| Showdown | Hard      | 52.5% | 45.7% | 49.4%  | 6.8 pts  | 93.2% | 72.4% / 73.8%                   |

### Counter-map odds

| Format   | Bot    | Best  | Worst | Random | Gap     | Moved | Round 1 decides (best / random) |
| -------- | ------ | ----- | ----- | ------ | ------- | ----- | ------------------------------- |
| Reveal   | Easy   | 53.6% | 46.5% | 50.0%  | 7.1 pts | 91.0% | 74.9% / 75.0%                   |
| Reveal   | Normal | 53.3% | 45.2% | 48.8%  | 8.1 pts | 91.0% | 74.9% / 75.0%                   |
| Reveal   | Hard   | 50.0% | 44.0% | 46.9%  | 6.1 pts | 72.7% | 74.9% / 75.0%                   |
| Showdown | Easy   | 51.9% | 48.2% | 50.0%  | 3.7 pts | 50.3% | 73.1% / 75.0%                   |
| Showdown | Normal | 52.9% | 46.3% | 49.6%  | 6.6 pts | 91.0% | 73.4% / 74.5%                   |
| Showdown | Hard   | 50.0% | 46.2% | 48.7%  | 3.8 pts | 50.1% | 72.1% / 73.6%                   |

### Whole series played (a random player, 1,000 series per row, ± 2 standard errors)

| Format   | Easy        | Normal      | Hard        |
| -------- | ----------- | ----------- | ----------- |
| Reveal   | 50.3% ± 3.2 | 50.6% ± 3.2 | 47.6% ± 3.2 |
| Showdown | 49.1% ± 3.2 | 51.3% ± 3.2 | 49.9% ± 3.2 |

The played series agree with the model's random play within their noise in every row (ruleset
9, the redesign's second group). Against ruleset 8 every figure moved by half a point or less with
either odds; the levels and round-1 shares below still hold.

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
