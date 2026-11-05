# Reveal: do the player's choices change their odds?

Measured 2026-11-05, before and after the rule change in ADR 0021. Scripts:
`scripts/reveal-analysis.ts` (the maths, unit-tested) and `scripts/reveal-measure.ts` (runs it).

## The question

In Best of 3, Reveal used to mean: both lineups are revealed, then each side sets its order in
secret. Against the bot, whose order is random, the player's order could not change their odds.
The plain counter-map check in ADR 0019's addendum showed that, and this measurement confirms it.
ADR 0021 replaced the rule so the player's choices matter. This document measures both rules.

## Method

- **Round odds.** Each round's chance comes from one of two sources:
  - _counter-map odds_: favoured 64%, even 50%, unfavoured 36%;
  - _measured odds_: every ordered pair played from the player's slot (A) over 200 seeds with the
    game's own simulation (`playToEnd`), so 24,200 matches. A draw counts as half (it is
    replayed).
- **Lineups.** Every pair of lineups of three different balls from the 11: 165 × 165 = 27,225.
- **Exact expectations, no sampling.** For each pair of lineups the series chance is computed
  exactly over the bot's choices. Rounds are treated as independent, and the series is first to
  two. The player's _best_ and _worst_ play are both computed: the same choices, made well or
  badly. The gap between them is what the choices are worth.
- **Before ADR 0021:** both orders secret, the bot's uniformly random.
- **After ADR 0021 (take turns):**
  - Round 1: the bot shows a random ball and the player answers.
  - Round 2: the player shows first, knowing the score, and the bot answers with its best counter
    by the counter map (favoured, else even, else unfavoured, ties at random), exactly as
    `randomBot.answer` does (a test checks the model matches it).
  - Round 3: the balls left.

Run it with:

```bash
node scripts/reveal-measure.ts 200
```

Add `--save rates.json` to keep the measured odds and `--rates rates.json` to reuse them. About
5 minutes to play the matches, then about 10 s for the analysis.

## Results

| Odds        | Rule                  | Best play | Worst play | Gap      | Lineup pairs where choices move the odds by 3+ points |
| ----------- | --------------------- | --------- | ---------- | -------- | ----------------------------------------------------- |
| Counter map | Before: orders secret | 50.0%     | 50.0%      | 0.0 pts  | 0%                                                    |
| Counter map | After: take turns     | 54.2%     | 41.4%      | 12.8 pts | 97.2%                                                 |
| Measured    | Before: orders secret | 50.5%     | 50.5%      | 0.0 pts  | 0%                                                    |
| Measured    | After: take turns     | 55.0%     | 42.2%      | 12.8 pts | 99.0%                                                 |

- **Before, the player's order was worth nothing.** The gap is 0 to floating-point precision, for
  every one of the 27,225 pairs, with either odds. The reason is structural: against an order you
  can't see, every order of yours produces the same set of possible pairings.
- **After, it is worth about 13 points.** Answering the bot's first ball well, and choosing what to
  show first in round 2, take the player from about 42% to about 55%.
- **The two sources of odds agree within a point.** The counter map's bands describe the game
  well enough for this question. Measured odds sit half a point higher overall, which is slot A's
  small edge in the simulation.
- **The bot is not unbeatable, and not a pushover.** The player gets the first answer and the
  bot the second. With good play the player is a little ahead; badly played, the counter-picking
  bot wins clearly.

## Variants considered

Measured the same way while choosing the rule, with the counter map odds:

| Variant                                                             | Best  | Worst | Gap      | Note                                                                                          |
| ------------------------------------------------------------------- | ----- | ----- | -------- | --------------------------------------------------------------------------------------------- |
| A: the bot shows its round-1 ball, then the player orders all three | 54.8% | 45.2% | 9.6 pts  | Only the bot gives information, so it isn't fair between two players                          |
| B: the bot shows each round's ball first, the player answers        | 58.6% | 41.4% | 17.2 pts | A counter-pick every round: too easy against the bot, and it overlaps with "loser picks next" |
| C: take turns showing first (chosen)                                | 54.2% | 41.4% | 12.8 pts | Each side shows first once, so it works for player against player too                         |

In the exploration, C's bot answered with the exact best reply, not the counter-map rank. That
version gave 51.6% best play. The implemented bot, measured above, is a little kinder.

## Limits

- Rounds are treated as independent. Momentum doesn't exist in the sim, so this is exact up to the
  odds themselves.
- The measured odds have about ±3.5 points of noise per pair at 200 seeds. They enter the series
  maths smoothed over many pairs, and the two sources agree within a point.
- The bot shows its round-1 ball at random. A bot that read the player's lineup when choosing it
  would change the numbers. That is a design choice recorded in ADR 0021.
