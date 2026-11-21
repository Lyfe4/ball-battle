# 0076: The shape becomes a warning; hard limits on strong counters

- Status: Accepted
- Date: 2026-11-21
- Amends: ADR 0073 (the shape and its named exceptions), ADR 0045 group 4 (the shape as a target)
- Builds on: the owner's decision of 2026-11-21, after round 9 of new-ball prototypes
  (`docs/experiments/new-balls-proposal-9.md` on `proto/new-balls-9`, never merged)
- Amended by: ADR 0077 (the Vampire's allowance over the limit is gone)

## Context

Since ADR 0073 every ball had to beat 2-4 balls outright and lose to 2-4, the two counts within 1,
with six balls allowed off it by name (`SHAPE_EXCEPTIONS`). `pnpm balance` failed on any ball off
its allowance. Rounds 7, 8 and 9 of new balls kept running into it: a new ball's strong win is
another ball's strong loss, and most balls were already at 4, so good ideas (the Tsunami, the
Geode, the Parrot, the Cowboy) failed on "no room" even when every pair felt fair. A player feels
a matchup that is too steep, a fight that drags or a ball that always loses; they don't feel
whether a ball has 4 strong counters or 5.

## Decision

The rules that protect how a fight feels stay hard, exactly as before: every ball 45-55% overall,
no side under 22% or over 78%, median fight 12-30 s, draws under 5%, comebacks 10-20%, the ±5%
health sensitivity check, and every pair inside its level's band (strong, edge, even).

**New hard rules** (`STRONG_LIMITS` in `scripts/counter-map.ts`, checked by `pnpm balance` and
CI's `balance:ci`, counting strong counters only, measured in a full run and the map's on CI's
seeds, as the shape was):

- No ball has more than **6 strong wins** or more than **6 strong losses**.
- Every ball added after ruleset 22 has **at least 2 strong wins and 2 strong losses**, so it has
  real "pick this against that" matchups and isn't flat. The 28 balls of ruleset 22 are listed in
  `BEFORE_THE_FLOOR` (a test pins it to the first 28 of the roster); five of them have fewer
  (Brawler, Titan, Quake, Spider, Slime), and they keep what they have.

**The shape is a warning.** 2-4 strong counters each way, the two counts within 1, with the
Bloom's fifth loss and the Brawler's even pick as before, is printed as a WARN line by
`pnpm balance` and listed under "The shape" in `docs/balance-summary.md` with each ball's counts.
`SHAPE_EXCEPTIONS` is gone: every ball off the shape is listed by the run itself.

**One ball is over the new limit today.** The Vampire loses to 7 balls outright (it heals only
from its bumps, so balls that hit without a touch beat it). It is allowed exactly 7 by name in
`OVER_THE_LIMIT` (an eighth fails; a test fails if its count changes, so the entry is dropped as
soon as it is back to 6). The fix is an ability tweak, not a number (`docs/vision.md`).

No ball changes, so the ruleset stays 22; the summary's numbers are the same fights.

## Consequences

- New balls are judged by how their fights feel and by the floor of 2 each way, not by room in
  other balls' shapes. The shape still shows where the roster is lopsided.
- A ball can now reach 5 or 6 strong counters on a side. The warning says so; the 45-55% overall
  and the 78% ceiling keep any such ball fair.
- The six balls off the shape at ruleset 22 (Titan 1/1, Quake 2/1, Spider 1/3, Slime 1/0, Vampire
  2/7, Archer 5/3) are warnings now; only the Vampire's seventh loss needs its named allowance.
