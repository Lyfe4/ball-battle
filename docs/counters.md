# Counter map and mirror draws (proposal)

- Status: Proposal, for review. Nothing here changes stats, rules or balance targets yet.
- Date: 2026-11-04
- Data: `pnpm balance` at 0f50399 (500 seeds per slot order, 1000 games per pair, ±1.6 points
  standard error per pair), plus one-off analysis scripts noted below.

The PvP mode in `docs/vision.md` is a guessing game: picks should matter, nothing should be
hopeless. This proposes which matchups should lean which way, how `pnpm balance` could check
that, which levers would get there, and what to do about draws in mirror matches.

## Current matrix

Win rate of the row ball against the column ball (draws make up the rest).

|               | Brawler | Speedster | Vampire | Archer | Storm | Overall |
| ------------- | ------: | --------: | ------: | -----: | ----: | ------: |
| **Brawler**   |       — |      51.0 |    51.5 |   43.2 |  45.5 |    47.8 |
| **Speedster** |    48.7 |         — |    39.6 |   67.2 |  57.7 |    53.3 |
| **Vampire**   |    47.9 |      60.2 |       — |   42.2 |  48.0 |    49.6 |
| **Archer**    |    56.6 |      32.8 |    57.4 |      — |  54.3 |    50.3 |
| **Storm**     |    54.4 |      41.8 |    51.9 |   45.2 |     — |    48.3 |

The soft triangle is already there: **Speedster > Archer** (67/33), **Archer > Vampire**
(57/43), **Vampire > Speedster** (60/40). The Brawler has no matchup it is favoured in, and the
Storm only a slight edge over the Brawler.

## Proposed counter map

Built around the existing triangle, plus a second one through the two balls without a clear
role: **Brawler > Speedster > Storm > Brawler**. Every ball ends up with exactly one or two
favoured and one or two unfavoured matchups, which keeps each pick's expected win rate near 50%.

| Matchup              | Intended           | Now       | Reason                                                                                                                |
| -------------------- | ------------------ | --------- | --------------------------------------------------------------------------------------------------------------------- |
| Speedster vs Archer  | Speedster favoured | 67.2/32.8 | Closes the distance faster than arrows can stop it (triangle).                                                        |
| Archer vs Vampire    | Archer favoured    | 57.4/42.2 | Chips the Vampire from range, where lifesteal can't answer (triangle).                                                |
| Vampire vs Speedster | Vampire favoured   | 60.2/39.6 | Outlasts the Speedster's burst by healing off every exchange (triangle).                                              |
| Brawler vs Speedster | Brawler favoured   | 51.0/48.7 | Every Brawler hit lands at full weight; the Speedster has to bounce several times to match one, and loses the trades. |
| Speedster vs Storm   | Speedster favoured | 57.7/41.8 | Outruns the warnings: the fastest target escapes the most zones.                                                      |
| Storm vs Brawler     | Storm favoured     | 54.4/45.5 | No ability and below-average speed: the Brawler walks into zones and has no way to punish from range.                 |
| Brawler vs Vampire   | Even               | 51.5/47.9 | Burst against sustain: the Brawler's big hits are also the Vampire's biggest heals.                                   |
| Brawler vs Archer    | Even               | 43.2/56.6 | The Archer kites, but the Brawler ends it in two clean hits once it connects. Today the Archer edges it.              |
| Vampire vs Storm     | Even               | 48.0/51.9 | Lightning out-damages lifesteal at range; the Vampire heals it back up close.                                         |
| Archer vs Storm      | Even               | 54.3/45.2 | Two ranged balls: arrows hit more often, a strike hits harder.                                                        |

Per ball, favoured / unfavoured / even:

| Ball      | Favoured against | Unfavoured against | Even against    |
| --------- | ---------------- | ------------------ | --------------- |
| Brawler   | Speedster        | Storm              | Vampire, Archer |
| Speedster | Archer, Storm    | Vampire, Brawler   | —               |
| Vampire   | Speedster        | Archer             | Brawler, Storm  |
| Archer    | Vampire          | Speedster          | Brawler, Storm  |
| Storm     | Brawler          | Speedster          | Vampire, Archer |

The Speedster is the most "swingy" pick (two of each), which suits a ball built on burst.

What has to move: **Brawler vs Speedster** from 51 to 58+ for the Brawler, **Storm vs Brawler**
from 54 to 58+ for the Storm, and **Brawler vs Archer** from 43 into 45-55. Everything else is
already where the map wants it. With those three moved, the expected overall rates land near
50% for every ball (Brawler about 49-50%).

### Alternatives considered

- **Brawler > Vampire instead of Brawler > Speedster** ("hits too hard to out-heal"). It also
  gives the Brawler a counter, but leaves the Vampire with two bad matchups (Archer, Brawler)
  and one good one, and the Speedster with no second weakness. Rejected for symmetry, but it is
  the more thematic choice if you prefer it.
- **Leave the Brawler counter-less** as the plain baseline. Fails the vision rule that every ball
  has a favoured matchup.

## How `pnpm balance` could check the map

Store the map as data next to the targets (a `COUNTER_MAP` in `scripts/`, keyed by pair, values
`'x' | 'y' | 'even'`), and add a section after the matrix:

| Intended | Check (favoured side's win rate, draws counted as games) | Warn                           |
| -------- | -------------------------------------------------------- | ------------------------------ |
| Favoured | 58-70%                                                   | within 2 points of either edge |
| Even     | 45-55% for both sides                                    | within 2 points of either edge |

- 58% is the low end of "around 60%" in the vision note; 70% keeps a 5-point gap above the future
  25/75 hard limit, so noise can't push a favoured matchup into a hard counter.
- The 2-point warning band covers the ±1.6-point standard error at 500 seeds per slot order.
- `--ball <id>` would only check that ball's rows.
- Keep the existing targets as they are. The map adds a check; it replaces none. The future
  25/75 limit and "every ball has a ≥ 60% and a ≤ 40% matchup" from the vision note would come
  in the same change, when the round structure arrives.

Example output:

```
  Counter map (favoured 58-70%, even 45-55%)
  ok   Speedster vs Archer     Speedster favoured   67.2%
  WARN Archer vs Vampire       Archer favoured      57.4%   (just under 58)
  MISS Brawler vs Speedster    Brawler favoured     51.0%
  ok   Vampire vs Storm        even                 48.0 / 51.9
```

## Levers

Ordered from most to least targeted. Every lever moves more than one matchup; re-run the full
balance after each step and check the identity rules (`roster.slow.test.ts`).

| Goal                                    | Lever                                                                                                                                                                                                                                                                                                        | Side effects to watch                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storm > Brawler, keep Speedster > Storm | **Shorter Storm warning** (`WARNING_TICKS`, 48 now). ADR 0006 measured that the warning sets the gap between fast and slow targets: shorter favours the Storm against slow balls (Brawler 740, the second slowest) and helps fast ones less. Moves both Storm matchups in the intended direction. Try 44-46. | Storm vs Vampire (760) and Archer (780) shift too; keep them inside 45-55. Storm's ability share (≥ 40% rule) rises, fine.                                                                                                                                                                  |
| Brawler > Speedster                     | **Speedster's bonus** down slightly (`MAX_STACKS` 5 → 4; `DAMAGE_PER_STACK` must stay whole so health stays whole), or **Brawler max health** up (64). Lower Speedster burst is what the Brawler's reason says.                                                                                              | Identity rule: max-stack bonus ≥ half its contact damage (10 ≥ 7 now; 4 stacks give 8, still passing). Speedster vs Vampire leans further to the Vampire (keep ≤ 70); Speedster vs Storm and Archer fall (keep ≥ 58). Brawler health up also helps vs Archer (wanted) and Storm (unwanted). |
| Brawler vs Archer to even               | **Brawler max health** up, or **Archer arrow damage** (11) down by 1.                                                                                                                                                                                                                                        | Arrow damage affects every Archer matchup and the ≥ 50% arrow share rule (82% now, lots of room). Archer vs Vampire must stay ≥ 58.                                                                                                                                                         |
| Fine-tune any Brawler matchup           | **Brawler speed** (740): slower makes it a better Storm target and a worse chaser of the Archer.                                                                                                                                                                                                             | Speedster must stay the fastest (identity rule).                                                                                                                                                                                                                                            |

A plausible first pass: Storm warning 48 → 45, Brawler health 64 → 66, Speedster bonus unchanged.
That is a guess to start bisecting from, not a measured result.

## Mirror draws

In blind-pick PvP both players will often pick the same ball, and a best-of-3 round needs a
winner. Current draw rates in mirrors (500 seeds each) and what causes them:

| Mirror    | Draws | Mutual KO, contact only (equal raw damage) | Mutual KO involving ability damage | Time limit |
| --------- | ----: | -----------------------------------------: | ---------------------------------: | ---------: |
| Brawler   |  4.6% |                                         23 |                                  0 |          0 |
| Speedster | 17.0% |                                         17 |                                 68 |          0 |
| Vampire   |  2.4% |                                         12 |                                  0 |          0 |
| Archer    |  5.0% |                                          6 |                                 19 |          0 |
| Storm     |  3.4% |                                          2 |                                 15 |          0 |

Non-mirror matchups draw 0.0-0.6%.

Why mirrors draw so much more:

- **Speedster:** the lethal-exchange tiebreak (ADR 0002 §4b) leaves one Speedster on 1 health,
  then both cash in their stack bonus in `onHitBall` (ability damage, outside the tiebreak, ADR 0003) on the same tick, and both die. In a mirror both usually hold stacks.
- **Archer and Storm:** identical cooldowns start on the same tick (first shot on tick 30, first
  strike on tick 60), so both balls fire or strike on exactly the same ticks all match. Two
  arrows or two zones finishing both balls in one tick is a draw; ADR 0005/0006 let a defeated
  owner's arrow or zone still land.
- **Brawler and Vampire:** equal contact damage, so a head-on mutual knockout often has exactly
  equal raw damage, which the tiebreak leaves as a draw.

No mirror draw came from the time limit.

### Options

Measured on the same 500 seeds per mirror with one-off analysis scripts that read the sim's
events without changing it (not committed):

**A. Extend the tiebreak to every same-tick mutual knockout (sim rule).** When all remaining
balls reach 0 in one tick, from any mix of contact and ability damage, the ball that had more
health at the start of the tick survives on 1 health (fallback: more damage dealt that tick;
both criteria resolve the same draws here). Resolves 81/85 Speedster, 21/23 Brawler, 10/12
Vampire, 19/25 Archer and 15/17 Storm mirror draws, leaving about 0.4-1.2% per mirror.

- Pros: decisive inside the match, deterministic, cheap, and a server re-simulation verifies it
  for free. Fixes the non-mirror mutual knockouts too. One rule in `step`, after defeats.
- Cons: a sim change: every seed that drew replays differently and the balance numbers move
  slightly (draws are 0.3% overall, so very slightly). "Survived on 1" twice in a match can look
  arbitrary. Exact ties stay draws, so it needs B or C behind it for PvP.

**B. Replay the round with a derived seed (match rule).** A drawn round is replayed with
`seed' = hash(round seed, attempt)`, same balls. Each attempt draws with the mirror's base rate,
so a Speedster mirror needs a second fight 17% of the time and a third about 3%. In the
measurement, 103 replays were needed for 85 Speedster draws, 18 of which drew again.

- Pros: no sim change at all; the server already generates and verifies seeds, so the rule is
  just "attempt n uses seed n". Fair: nobody is favoured by a tiebreak rule.
- Cons: the viewer watches another full fight (Speedster mirrors 16 s median). Needs a cap
  (say 3 attempts) and a final fallback for the rare fourth draw (A, or a coin flip from the
  seed). Doesn't touch the underlying cause.

**C. Desynchronise cooldowns in the sim (cause fix).** Start each ball's first shot or strike
at a small seeded offset (for example ±10 ticks from `ctx.random`), so mirrored Archers and
Storms stop firing on the same tick.

- Pros: removes the "both fire at once" pattern, which also looks mechanical when watched. No
  new tiebreak rule.
- Cons: only addresses the Archer and Storm share (at most the 34 of their 42 draws that involve
  ability damage); does
  nothing for the Speedster, Brawler or Vampire. A sim change for every match of those balls.

**Recommendation:** A for the match itself (it removes 80-95% of mirror draws and makes knockouts
read as "someone won"), with B as the PvP backstop for the exact ties that remain. C is worth
doing later for how mirrors look, not for draws.

## Questions for you

1. Is the second triangle right (Brawler > Speedster > Storm > Brawler), or do you prefer
   Brawler > Vampire as the Brawler's counter?
2. Favoured band 58-70% and even band 45-55%: right widths?
3. Mirror draws: A + B as recommended, or keep the sim untouched and rely on B alone?
