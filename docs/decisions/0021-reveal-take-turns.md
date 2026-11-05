# 0021: Reveal takes turns showing first

- Status: Accepted
- Date: 2026-11-05
- Replaces: the reveal-then-order rule of ADR 0019 (section 2 and the bot's `orderLineup`)

## Context

ADR 0019's Reveal let both sides see both lineups, then set their orders in secret. Its addendum
showed that, against a bot ordering at random, no order of the player's changes their odds, so
Reveal had no real decision. `docs/reveal-measurements.md` measures this: a gap of exactly 0
between best and worst play, over all 27,225 pairs of lineups. It also measures three sequential
alternatives.

## Decision

### 1. The rule

Both sides pick three balls blind, and both lineups are revealed. Then:

1. **Round 1:** the bot (side B) shows its ball first and the player answers with one of theirs.
2. **Round 2:** the player shows first and the bot answers from the two it has left.
3. **Round 3:** each side plays the ball it has left. No choices.

A drawn round is replayed with the same pair (ADR 0017). Round 3 is only played at 1-1.

Each side shows first once, so the rule works as it stands between two players. That decided it
over "the bot shows first, then the player orders all three" (only one side gives information) and
"the bot shows every round" (a counter-pick every round). Measured best and worst play for the
player: 55.0% and 42.2%, a 12.8-point gap. Choices move the odds by 3 or more points in 99% of
lineup pairs, where before they moved them in none.

### 2. In the series rules

- **Turns.** `src/sim/series.ts` holds the turns as data (`REVEAL_TURNS`): round 1 B then A,
  round 2 A then B.
- **Picks.** Every choice is a pick, through the machinery loser-picks-next already uses:
  - `awaitingPick` names who must choose;
  - `nextMatch` is empty until both have;
  - `recordPick` checks the ball is one the side has left.
- **Records.** Picks are stored in order (bot, player, player, bot), in `SeriesState.picks` and
  `SeriesSetup.picks`.
- **Verification.** `playSeries` replays a setup with its picks exactly and refuses one without
  them, so a server can verify a series.

### 3. The bot

`LineupBot.orderLineup` is replaced by two choices.

- **`showFirst(seed, own)`:** a seeded random ball of its own. It has nothing to react to in
  round 1, and any fixed rule (its strongest ball, or its least counterable) is one the player
  could learn and answer. Showing at random is the fair choice.
- **`answer(seed, round, remaining, shown)`:** its best counter to the ball the player showed,
  by the counter map: favoured, else even, else unfavoured, with ties on a seeded coin. It never
  sees anything the player hasn't shown.

### 4. Links

- **Format.** A decided Reveal series is
  `?mode=bo3&fmt=reveal&la=…&lb=…&seed=…&picks=b1,a1,a2,b2`, always four picks, since a series
  can't be decided before round 2.
- **Old Reveal links.** A link from before this rule has no picks and can't replay under it. It
  opens the lineup step, prefilled with the player's lineup and the format, like any other link
  that doesn't hold a whole series. Old `step=order` URLs open the rules.
- **Replaying a link.** The picks are made from the link, both sides'. This also fixed a gap in
  loser-picks-next replays, which asked the player for a pick the link already held.

### 5. Screens (phone first, one job per screen)

1. Rules, then lineup ("Reveal lineups").
2. **Round 1** (`step=answer`) replaces the order step. It shows the bot's three with its shown
   ball marked, and the player's three as buttons, each marked ▲ / ▼ against that ball. A tap
   answers, and the round plays.
3. **Round 2:** the scoreboard says "you show first", with one button per ball left. Each button is
   marked against both balls the bot could answer with. The bot answers and the round plays.
4. **Round 3** plays on Next round.

## Consequences

- Positive: Reveal has real decisions (about 13 points between good and bad play), and the bot's
  side of the rule is simple, explainable and on the counter map players can read in the manual.
- Positive: the rule is ready for player against player as it stands.
- Negative: links to Reveal series played before this rule no longer replay; they open the lineup
  instead.
- Negative: the series state has more picks to verify (four per Reveal series).
- Open: a smarter round-1 bot (showing the ball the player's lineup counters least) would make
  Reveal harder; its effect would need measuring with the same scripts.
