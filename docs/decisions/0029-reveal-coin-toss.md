# 0029: Reveal: a coin toss decides who shows first

- Status: Accepted
- Date: 2026-11-06
- Amends: ADR 0021 (§1 the rule, §2 turns, §3 the bot, §5 screens)

## Context

Under ADR 0021 the bot always showed first in round 1, and the player always showed first in
round 2. Each side shows first once, so the rule is even on paper, but playing it the bot always
seems to lead, which can feel rigged. A fixed order also means the player always answers first and
the bot always answers last, with the score known.

## Decision

### 1. The rule

At the start of a Reveal series a seeded coin decides who shows first in round 1. The other side
answers. In round 2 the sides swap: the side that answered shows first. Round 3 is unchanged (the
ball each side has left), as are draws (the round is replayed with the same pair).

### 2. In the series rules

- `revealFirst(seed)` in `src/sim/series.ts` is the toss: the first float of
  `deriveSeed([seed, TOSS_SALT])`, below 0.5 to side A, the same coin as sudden death but on its
  own salt. Over 100,000 seeds it falls to side A 50.03% of the time.
- `revealTurnsOf(setup)` replaces the `REVEAL_TURNS` constant: round 1 `[first, other]`, round 2
  `[other, first]`. `awaitingPick` reads it, so picks, `nextMatch` and `recordPick` need nothing
  new.
- **Recorded and replayed.** The toss depends on the series seed alone, which every series link
  already carries, so a link replays it exactly. The order of the link's picks follows it
  (`b1,a1,a2,b2` when the bot wins the toss, `a1,b1,b2,a2` when the player does). I chose not to
  add a separate `toss=` field: it could only ever repeat what the seed decides, or disagree with
  it.
- **Verified.** `verifySeries` recomputes the toss from the seed. A link whose picks follow the
  other turn order fails: the first pick is either a ball the side due doesn't have, or not the
  bot's pick (`series-verify.test.ts`).
- A rematch has a new seed, and so a new toss.

### 3. The bot

`showFirst(seed, round, remaining)` replaces `showFirst(seed, own)`. When the bot shows first, in
round 1 or 2, it shows a seeded random ball it has left. `answer` is unchanged and now also runs in
round 1, when the player won the toss. When the bot shows first in round 2 it shows as soon as
round 1 ends (`showBotBallNow`): the choice is random and needs nothing from the player, so the
screen between rounds asks for the answer straight away instead of offering a Play round that would
only reveal the bot's ball.

### 4. Screens

Round 1 (the setup's `step=answer`, and the scoreboard after a rematch) opens with the toss. It is
a flat coin with You on one face and Bot on the other. It flips three times in 600 ms and lands on
the side that shows first. Then one line says "You show first" or "Bot shows first". With reduced
motion the coin is shown landed. The line stays until round 1 is played, and screen readers hear
"Coin toss: You show first". Below it, the round-1 pick is either an answer to the bot's shown
ball, as before, or the player's ball to show first, with the bot's possible answers marked.

## Measured

`docs/reveal-measurements.md`, all 132,496 pairs of lineups from the 14 balls, with counter-map
odds and with measured odds (200 seeds per ordered pair):

| Odds        | Who shows first in round 1     | Best play | Worst play | Gap      | Lineup pairs where choices move the odds by 3+ points |
| ----------- | ------------------------------ | --------- | ---------- | -------- | ----------------------------------------------------- |
| Counter map | The bot, always (ADR 0021)     | 54.0%     | 41.9%      | 12.0 pts | 97.5%                                                 |
| Counter map | The player                     | 53.4%     | 41.9%      | 11.5 pts | 93.4%                                                 |
| Counter map | A coin toss decides (ADR 0029) | 53.7%     | 41.9%      | 11.7 pts | 96.8%                                                 |
| Measured    | The bot, always (ADR 0021)     | 54.3%     | 41.6%      | 12.7 pts | 99.1%                                                 |
| Measured    | The player                     | 54.0%     | 41.6%      | 12.3 pts | 98.7%                                                 |
| Measured    | A coin toss decides (ADR 0029) | 54.1%     | 41.6%      | 12.5 pts | 99.0%                                                 |

- The toss keeps Reveal fair and keeps its decisions. Good play is worth 12.5 points (measured),
  where it was 12.7 with the bot always first, and choices still move the odds in 99% of lineup
  pairs.
- It barely matters who wins the toss. Best play is 0.3 to 0.6 points lower for a player who shows
  first than for one who answers, and worst play is the same, so the coin decides the order without
  deciding the odds.

## Consequences

- Positive: neither side always leads, and the toss is shown, so the order can be seen to be fair.
  The rule is still pure, seeded and verified, and it works between two players as it stands.
- Positive: the player gets to show first in round 1 half the time, a different decision from
  answering.
- Negative: links from ruleset 3 open the outdated notice (ADR 0022), as after any rules change.
- Negative: one more moving part on the round-1 screen.
