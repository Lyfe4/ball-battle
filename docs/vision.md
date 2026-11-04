# Vision

Where BallBattle is heading. Nothing here is implemented yet; it guides design and balance
decisions so today's work doesn't paint the future into a corner.

## Future mode: player vs player

- Each player picks **3 balls, blind and in order**. Neither sees the other's lineup until the
  match starts.
- **Round 1** is each player's first ball against the other's first ball, round 2 the second
  balls, round 3 the third.
- **Best of 3** decides the match. It stops as soon as one player has two round wins (2-0 ends
  it; round 3 is only played at 1-1).

Every round is still an ordinary deterministic match (ADR 0001): two balls and a seed.

## The core fun: rock-paper-scissors guessing

The interesting decision is the guess: "they opened with a Speedster last time, so I'll lead with
the Vampire." That only works if matchups lean:

- Balls have **soft counters**: a counter is _favoured_, not guaranteed. Picks matter, but no
  pick is hopeless, and the fight still has to play out.
- Hard counters (a matchup that is decided before it starts) remove the reason to watch; a flat
  field (every matchup 50/50) removes the reason to pick.

## Future balance targets for this mode

These are where the targets in `pnpm balance` should move once the round structure exists. They
are not enforced today.

- Every ball has **at least one matchup around 60% or better** and **at least one around 40% or
  worse**, so each has something to fear and something to hunt.
- **No matchup worse than about 25/75** (today's limit is 20/80).
- **Every ball wins 40-60% overall** (unchanged).

Draws matter more in a best-of-3: a round needs a winner, and mirror matches will be common with
blind picks. See `docs/counters.md` for the current proposal.

## Planned order

1. **Round structure against a bot lineup, locally.** Pick 3 in order, the bot picks 3, play the
   best of 3. No network.
2. **Asynchronous PvP.** Players fight other players' saved lineups. The server generates the
   seeds and can re-simulate any match to verify a reported result, which the deterministic sim
   makes cheap.
3. **Progression and unlocks.** Unlocks add **variety, not power**: a new ball is a new option in
   the guessing game, never a stronger version of an old one.
