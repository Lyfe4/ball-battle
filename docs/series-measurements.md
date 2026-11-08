# Series: what the player's choices are worth against each bot level

Measured 2026-11-07 for ADR 0035 (ruleset 6, 17 balls), for ADR 0043 (ruleset 7, 21 balls) and
again on 2026-11-08 for ADR 0045 (ruleset 8, the roster redesign's first group; the tables below): the three bot levels in Reveal and Showdown. Scripts: `scripts/series-analysis.ts` (the maths, unit-tested) and
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
| Reveal   | Easy      | 54.7% | 46.1% | 50.4%  | 8.6 pts  | 96.6% | 74.9% / 75.0%                   |
| Reveal   | Normal    | 54.5% | 44.8% | 49.4%  | 9.7 pts  | 97.3% | 74.9% / 75.0%                   |
| Reveal   | Hard      | 52.5% | 43.3% | 47.7%  | 9.2 pts  | 95.3% | 74.9% / 75.0%                   |
| Reveal   | first bot | 54.6% | 43.5% | 48.7%  | 11.1 pts | 97.8% | 74.9% / 75.0%                   |
| Showdown | Easy      | 52.7% | 48.2% | 50.4%  | 4.5 pts  | 75.9% | 72.6% / 75.0%                   |
| Showdown | Normal    | 53.9% | 46.1% | 50.0%  | 7.8 pts  | 90.1% | 73.3% / 74.6%                   |
| Showdown | Hard      | 52.2% | 45.7% | 49.3%  | 6.6 pts  | 92.9% | 72.5% / 73.8%                   |

### Counter-map odds

| Format   | Bot    | Best  | Worst | Random | Gap     | Moved | Round 1 decides (best / random) |
| -------- | ------ | ----- | ----- | ------ | ------- | ----- | ------------------------------- |
| Reveal   | Easy   | 53.6% | 46.5% | 50.0%  | 7.1 pts | 90.2% | 75.0% / 75.0%                   |
| Reveal   | Normal | 53.2% | 45.2% | 48.8%  | 8.1 pts | 90.2% | 74.9% / 75.0%                   |
| Reveal   | Hard   | 50.0% | 44.0% | 46.9%  | 6.0 pts | 71.5% | 74.9% / 75.0%                   |
| Showdown | Easy   | 51.9% | 48.2% | 50.0%  | 3.7 pts | 49.2% | 73.1% / 75.0%                   |
| Showdown | Normal | 52.9% | 46.3% | 49.6%  | 6.6 pts | 90.2% | 73.5% / 74.5%                   |
| Showdown | Hard   | 50.0% | 46.2% | 48.7%  | 3.8 pts | 49.0% | 72.2% / 73.6%                   |

### Whole series played (a random player, 1,000 series per row, ± 2 standard errors)

| Format   | Easy        | Normal      | Hard        |
| -------- | ----------- | ----------- | ----------- |
| Reveal   | 51.0% ± 3.2 | 50.5% ± 3.2 | 47.9% ± 3.2 |
| Showdown | 50.2% ± 3.2 | 49.7% ± 3.2 | 50.5% ± 3.2 |

The played series agree with the model's random play within their noise in every row (ruleset
8). Against ruleset 7, measured odds moved by about a point at most. With the map's odds, the
redesign's first group made fewer pairs favoured, so choices move fewer lineups in Showdown against
the Easy and Hard bots (about 50% instead of 61%) and Reveal's gaps shrank by about a point; the
levels and round-1 shares below still hold.

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
