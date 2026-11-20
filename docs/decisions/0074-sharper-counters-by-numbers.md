# 0074: Sharper counters by numbers (ruleset 21)

- Status: Accepted
- Date: 2026-11-20
- Amends: ADR 0073 (its shape exceptions, and ruleset 19's kept bots), ADR 0045 group 4 (the
  numbers of 16 balls)
- Builds on: step 2 of the three-levels plan (`docs/experiments/three-levels-proposal.md` on
  `proto/three-levels`, part C: Batches 1, 1b and 2), the owner's decisions of 2026-11-20

## Context

Ruleset 20 labelled every pair honestly (ADR 0073) but left 44 strong counters, 75 edges and 181
even pairs, with 17 balls off the strong-only shape. The proposal measured one-number levers one
ball at a time, combined them with an additive model and verified the best set on all 300 pairs
with a pair-only harness: 58 strong, 72 edges, 170 even, with eleven balls still off the shape.
This record is that set, numbers only (no ability changes, no new balls), with three adjustments
the real runs needed.

## Decision

### 1. The numbers

| Ball      | What          | Was       | Now       |
| --------- | ------------- | --------- | --------- |
| Archer    | reload        | 120 ticks | 110 ticks |
| Hex       | curse burst   | 25%       | 27%       |
| Frost     | health        | 80        | 83        |
| Venom     | health        | 69        | 71        |
| Bomber    | blast         | 26        | 28        |
| Quake     | shockwave     | 6         | 7         |
| Speedster | speed a stack | 10%       | 12%       |
| Storm     | strike        | 40        | 42        |
| Bloom     | bump          | 21        | **21.5**  |
| Ghost     | phase         | 60 ticks  | 70 ticks  |
| Slime     | a half's bump | 80%       | 85%       |
| Titan     | growth a tick | 0.06      | 0.07      |
| Vampire   | lifesteal     | 90%       | 95%       |
| Vampire   | health        | 39        | 37        |
| Thorns    | speed         | 730       | **727**   |
| Berserker | health        | 86        | **88**    |

Three differ from the plan (Thorns 715, Bloom 22, Berserker unchanged):

- **The Thorns' speed is 727, not 715.** At 715 the Thorns is slower than the Frost (720), and the
  Frost is the slowest ball: its identity ("slow and sturdy"), the manual's "Slowest ball" chip and
  `identity.test.ts`. Every speed setting reshuffles the Thorns' row by a few points, so three were
  measured on its 24 pairs at 500 seeds. At 721 the Vampire's edge on it reached 65.2% and the
  Thorns lost to five outright, off the shape; at 724 the Sniper's only strong win (over the
  Thorns) fell to 64.9%; at **727** the Thorns beats three and loses to four outright, and every
  other ball keeps its shape.
- **The Bloom's bump is 21.5, not 22, and the Berserker has 88 health, not 86.** With the plan's 22,
  the Bloom beat the Berserker 75.6% at 500 seeds, but 80.3% on CI's 150 (seeds 0-149, the same
  fights every run), past the 78% hard limit, which has no noise allowance. The Bloom's row alone
  can't hold both ends: Archer over Bloom needs a bump of about 21.3 or more to stay under 78% at 500
  seeds, and the Berserker needs about 21.2 or less to keep 22% on CI's seeds, where draws push
  its side down. A bump of 21.5 and two more Berserker health (still the most in the roster) pass
  both: the Bloom beats the Berserker 71.8% (74.7% on CI's seeds, the Berserker at 23.0%), and the
  Archer beats the Bloom 77.7%. The Berserker's bump was already fractional (18.2), so a half
  point is a number the sim has always handled.

The Speedster stays the fastest ball and the Bloom's regrowth is untouched.

### 2. The result (500 seeds, both slot orders)

|                 | Ruleset 20 | Ruleset 21 |
| --------------- | ---------: | ---------: |
| Strong counters |         44 |         57 |
| Edges           |         75 |         75 |
| Even            |        181 |        168 |

Every hard rule passes, in the full run and in CI's: every ball 45.4-54.3%, the worst side of any
pair 22.3% (23.0% on CI's seeds), nothing over 78%, every pair inside its label's band, draws 0.5%,
the median fight 16.1 s, comebacks 18.7%, ±5% health moves a win rate 12.4 points at most, and the
Vampire heals 110% of its health a fight. 99 pairs are inside their band but off its aim (WARN).
One strong counter fewer than the plan's 58: the Berserker's health turns the Frost's strong win
over it into an edge (64.6%).

### 3. Labels

58 pairs changed level against ruleset 20 (a few moved and moved back while tuning). Each has a reason written from what decides its fights (the pair harness's
per-fight evidence: who deals what damage, of which kind, in wins and losses), every new strong
counter says why it is strong, and every reason stays within 97 characters. Six unchanged reasons
quoted numbers that moved and now say "over a quarter" (the curse), "over half" (a blast on the
Bloom) and "just over 1 s of every 4" (the Ghost's phase).

### 4. The shape: ten exceptions left

The seven balls ADR 0073 left for these numbers (the Archer, Thorns, Magnet, Necromancer, Bomber,
Bloom and Battery) and the Frost are on the shape, and their allowances are gone. Ten remain, each
allowed exactly its gap, all for ability tweaks or new balls:

- Titan 0/0: growing evens its fights out, weak early and strong late, so no pair leans far.
- Ghost 2/1: phased, nothing touches it, so only the Bloom's regrowth beats it outright.
- Quake 2/0: small, wide shockwaves chip every ball alike, so no ball beats it outright.
- Slime 1/0: its split outlasts one-at-a-time hitters; it beats only the Sniper, and none beat it.
- Spider 1/2: webs slow every wall-bouncer a little; only the Speedster, living on walls, loses.
- Spartan 1/2: shield and spear trade evenly with most; only the frail Vampire loses outright.
- Sniper 1/2: a moving ball often slips its line; only the slow Thorns loses outright.
- Inferno 2/1: fire burns every ball alike; only the Berserker, raged by each burn, beats it.
- Boomerang 2/4: two light hits a throw beat the Vampire and Bloom; four punish its light bumps.
- Vampire 2/5: it heals only from its bumps, so five balls that hit without a touch beat it.

### 5. Older links

These numbers change fights, so ruleset 21 empties `SAME_FIGHTS_AS` and retires ruleset 19's kept
bots (`bot-r19.ts`), as ADR 0073 §5 planned. Ruleset 19 and 20 links show the older-link notice
(ADR 0022). The mechanism stays for the next bot-only change: `KEPT_BOTS` (by ruleset) is empty,
and `botFor(opponent, ruleset)` still takes the ruleset. Online series are unaffected: the server
verifies each with its own ruleset's frozen bundle (ADR 0052). Ruleset 21 is frozen as
`rulesets/r21/`.

### 6. The manual

Text read from the constants follows on its own. Three lines changed by hand, each still two lines
at 375 px: the Archer leads an arrow "every 1.8 s"; the Hex's curse takes "over a quarter" of the
cursed ball's health (its "How it works" now prints 27% through `percentOf`, where `CURSE_SHARE *
100` would print 27.000000000000004%); the Ghost's phase prints through `secondsOf` (1.2 s of
every 4 s).

### 7. Tests that read the fights

Two tests pinned a fight of ruleset 20 and are re-pinned: the series that reaches sudden death is
found again by search (seed 30142), and the web-snap test accepts a catch whose nip knocks the ball
out on that tick (the sim slows no defeated ball, and the renderer rightly snaps the web).

## Consequences

What picking well is worth in Reveal (measured odds, 2000 lineup pairs, best play and best minus
worst; ruleset 20's figures are the three-levels proposal's, part D):

|                       | Easy         | Normal       | Hard         |
| --------------------- | ------------ | ------------ | ------------ |
| Best of 3, ruleset 20 | 55.3% / 10.8 | 54.9% / 12.4 | 50.9% / 10.4 |
| Best of 3, ruleset 21 | 56.6% / 12.4 | 56.1% / 14.3 | 51.9% / 12.3 |
| Best of 5, ruleset 20 | 59.7% / 19.6 | 58.6% / 22.3 | 52.6% / 20.0 |
| Best of 5, ruleset 21 | 60.7% / 21.1 | 59.8% / 24.0 | 54.0% / 22.2 |

Sharper counters make picking worth more: best play gains about one point against every bot, and
the gap between best and worst play grows by 1.5 to 2 points. The proposal's model predicted under
one point; the real fights moved more than its additive model.

- Every new ball must fit the shape or name its gap; the ten left need ability tweaks or new balls,
  not numbers.
- Pairs near CI's hard limit on its own 150 seeds are now checked as part of tuning (the Bloom over
  the Berserker was 80.3% there at 75.6% in the full run).
