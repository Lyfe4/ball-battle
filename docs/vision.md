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

These are where the targets in `pnpm balance` are heading. The counter map and the 25/75 limit
are checked today (see Decisions); the rest waits for the round structure.

- Every ball has **at least one matchup around 60% or better** and **at least one around 40% or
  worse**, so each has something to fear and something to hunt. **One exception: the Brawler**
  is the deliberate safe pick, even against everyone (see Decisions).
- **No matchup worse than about 25/75** (today's limit is 20/80).
- **Every ball wins 40-60% overall** (unchanged).

Draws matter more in a best-of-3: a round needs a winner, and mirror matches will be common with
blind picks. See Decisions below.

## Planned order

1. **Round structure against a bot lineup, locally.** Pick 3 in order, the bot picks 3, play the
   best of 3. No network.
2. **Asynchronous PvP.** Players fight other players' saved lineups. The server generates the
   seeds and can re-simulate any match to verify a reported result, which the deterministic sim
   makes cheap.
3. **Progression and unlocks.** Unlocks add **variety, not power**: a new ball is a new option in
   the guessing game, never a stronger version of an old one.

## Decisions

### Counter map (2026-11-04)

- One soft triangle, which comes from the balls' mechanics: **Speedster > Archer > Vampire >
  Speedster**. Plus **Storm > Vampire** (ranged damage denies lifesteal, as the Archer's does)
  and **Speedster > Storm** (it outruns the warnings). Archer vs Storm is even.
- **The Brawler is the safe pick: even (45-55%) against every ball.** It is the one exception to
  "every ball has a favoured and an unfavoured matchup": a blind pick that never loses the guess
  badly and never wins it big. The counter-map test lists it as an explicit exception.
- The map is data in `scripts/counter-map.ts`; the reasoning and results are in ADR 0009.
- Replaces the first version of this decision (a second triangle, Brawler > Speedster > Storm >
  Brawler), which stat tuning could not reach: the Brawler has no ability, so nothing in its
  mechanics favours it against one ball more than another.
- Bands, checked by `pnpm balance`: the favoured side wins **58-70%**, an even pair **45-55%**
  for both sides, and **no matchup is worse than 25/75**, on top of every existing target.

### Mirror draws (2026-11-04)

Mirrors draw far more than other pairs (500 seeds: Speedster 17%, Archer 5%, Brawler 4.6%,
Storm 3.4%, Vampire 2.4%; non-mirrors 0-0.6%). Causes: two Speedster stack bonuses (ability
damage, outside the lethal tiebreak) finishing both balls in one tick, mirrored cooldowns firing
on the same tick, and equal raw contact damage.

- **Decision: replay a drawn round with a new seed** (option B), derived from the round seed and
  the attempt number so a server can regenerate and verify it. A cap (about 3 attempts) and a
  final fallback are decided with the round structure.
- It is **implemented with the best-of-3 round structure**, not before. **No sim change** for
  draws now: the lethal tiebreak and cooldown timing stay as they are.
- Rejected for now: a wider sim tiebreak for every same-tick mutual knockout (would resolve
  80-95% of mirror draws but changes the sim), and seeded cooldown offsets (only fixes the Archer
  and Storm pattern).
