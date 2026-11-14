# 0019: Draft formats for best of 3

- Status: Accepted (both formats are built to be played and compared; which one stays is open).
  Reveal's rule (section 2) is replaced by ADR 0021. Loser picks next (section 3) is replaced by
  Showdown (ADR 0035), and the bot's choices by its levels. §5's "a pick that is no longer legal is
  dropped and the rest is played live" is replaced by ADR 0022: a link `verifySeries` refuses is
  not replayed at all, and bot picks must be the bot's.
- Date: 2026-11-05
- Amends: ADR 0017 (series setup, link, bot)

## Context

Aiming the launch didn't create skill (`docs/experiments/aiming-measurements.md`): one side's angle barely
matters, and the pair of angles turns into a second blind guess. Bigger balls didn't rescue it
(`docs/experiments/bigger-balls-experiment.md`). The vision's skill is in the guess about picks
(`docs/vision.md`): "they opened with a Speedster last time, so I'll lead with the Vampire". Today
both orders are set blind, so the only decision is three balls and their order, once. Two formats
move more of the skill into picking, with more information on the table.

## Decision

### 1. A format is part of the series setup

`SeriesSetup.format` is `blind` (ADR 0017, and the meaning of an absent field, so every existing
series and link is unchanged), `reveal` or `loser`. The series stays pure sim code a server can
re-run.

### 2. Reveal, then order

Both sides pick three balls blind. Both lineups are then revealed, and each side sets its order in
secret, knowing what it faces but not in which order. Once the orders are set the series plays
exactly like a blind one (a test checks this), so the engine needs nothing new; only the builder
has a second step.

### 3. Loser picks next

Both sides pick and order three balls blind and lock in their first. After a round, the loser picks
its next ball from what it has left; the winner keeps the order it set.

- **The winner's next ball is revealed to the loser before it picks.** It is already fixed by the
  winner's order, so showing it gives nothing away the winner could still change, and it is what
  makes the pick a counter-pick rather than a second blind guess. (Alternative considered: the
  loser only sees the ball that just won. Each ball plays once, so countering a ball that has
  already played gives no edge; rejected.)
- With three balls the only real choice comes after round 1: the loser chooses which of its two
  remaining balls faces the winner's second ball (the other plays round 3). At 1-1 each side has
  one ball left, so no pick is asked for.
- A drawn round is replayed (ADR 0017) before any pick; only a decided round (sudden death
  included) hands the loser a pick.
- In the sim: `awaitingPick(state)` names the side that must pick, `nextMatch` returns nothing until
  `recordPick` records it, and `nextBallOf` gives a side's ball for the coming round (its pick, else
  its next unplayed ball in order).

### 4. Picks are part of the record

Every pick is stored in order (`SeriesState.picks`, and `SeriesSetup.picks` for a replay).
`playSeries` takes them from the setup and throws on a missing or unused pick, so a server can
verify a reported series and a tampered link can't skip one. Both sides' picks are stored, the
bot's included, so a link keeps replaying after the bot changes (as ADR 0017 decided for lineups).

### 5. Links

`fmt=reveal` or `fmt=loser` (absent is blind) and, for loser-picks-next, `picks=x,y`. An unknown
format, picks in a format without them, a pick from neither lineup or too many picks fall back to
the builder, prefilled with what was valid. The format is in the address bar while building and
playing; the bot's lineup still only appears once the series is decided. A replayed link makes its
own picks; a pick that is no longer legal is dropped and the rest is played live.

### 6. The bot

Still behind `LineupBot` (ADR 0017), which gains two choices:

- `orderLineup`: in reveal-then-order, a seeded random order of its own lineup (it ignores the
  player's).
- `pickNext`: in loser-picks-next, a ball from its remaining two that the counter map says is
  favoured against the winner's next ball, at random among several; any remaining ball if none is.

The counter map's data moved from `scripts/` to `src/sim/counter-map*.ts` so the bot can read it;
the bands and checks stay in `scripts/counter-map.ts`.

### 7. UI

A Rules choice above the lineup (Blind, Reveal, Loser picks) with a one-line explanation. Reveal
adds an ordering step: the bot's three balls under "The bot's lineup", your three under "Your
order" with move buttons, Lock order and Change lineup. Loser picks adds, when you lost, a line
naming the bot's next ball and one Play button per ball you have left; when the bot lost, a line
saying it picks knowing your next ball. The scoreboard names the format.

## Consequences

- Positive: picking carries more of the skill, with information to act on (the opponent's lineup,
  or the winner's next ball), which is what the vision's guessing game wants. The counter map now
  matters inside a series, not only between blind lineups.
- Positive: blind series, their links and the series engine's results are unchanged.
- Negative: two more ways to play to explain, and a more complex series state (picks) for a server
  to verify. Loser-picks-next offers only one pick per series with three-ball lineups.
- Open: which format becomes the default, or whether both stay. A smarter bot (one that orders
  against a revealed lineup) would make reveal-then-order a stronger test of the player.

## Addendum: the bot's order in reveal-then-order (2026-11-05)

A smarter reveal bot was proposed: order its lineup against the player's revealed balls using the
counter map, without seeing the player's order. It can't do better than a random order:

- **The bot's order doesn't change its odds.** Against a player order it can't see, every bot order
  gives the same series odds. Checked over all 27,225 pairs of lineups, with favoured 64%, even 50%
  and unfavoured 36% per round: across the six bot orders, the expected odds (player order uniform)
  and the worst case (the player's best order) differ by under 1e-15. The reason is structural:
  the player's order alone decides which ball meets which, so every bot order leads to the same six
  pairings, and a best of 3 with independent rounds doesn't care which round a pairing lands in.
- **A uniformly random order is the equilibrium**, and a fixed "smart" order would be worse: the
  same lineup would always be ordered the same way, so a player could learn it and counter it.
- So `randomBot.orderLineup` stays as it is. What changed: a test that its order is the same for
  every order of the player's lineup (shown to fail when the bot reads that order), and the series
  controller now passes the player's lineup as it was revealed rather than the order the player
  locked, so a future bot can't read the secret order even by mistake.
- Rejected: simulating the coming rounds with the series seed to choose an order. The bot would be
  using knowledge of the future the player doesn't have.

**Implication: reveal-then-order has no real decision against this bot.** By the same symmetry,
against a uniformly random orderer the player's own order can't change the player's odds either:
only which three balls were picked matters, and those were picked blind. The ordering step only
rewards reading an opponent who orders predictably, which a human might and this bot never does.

**Open design question** (for the home, picker and manual plan): give the order step information
to act on. For example a sequential reveal, where the bot shows its first ball before the player
orders (the player can then lead with a counter, and the bot's remaining two still have to be
guessed), or alternating placement round by round. Any change belongs in the series rules in
`src/sim/series.ts`, where a server can verify it, and needs its own ADR.
