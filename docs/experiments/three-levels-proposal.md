# Three honest levels and sharper counters: proposal (2026-11-20)

PROPOSAL ONLY, on `proto/three-levels` (never merge as is). The owner's decisions of 2026-11-20:
sharper counters (65-78%, aiming for 68-75%, Batch 2 approved) and three levels shown to players.

## A. How the three levels look

| Level  | Pick rows, quick setup, ball page             | Matchup chart (13 px cells on a phone) | Words and odds                     |
| ------ | --------------------------------------------- | -------------------------------------- | ---------------------------------- |
| Strong | ▲▲ / ▼▼ on a disc filled in its side's colour | one arrow on a filled cell             | "strongly favoured", about 7 in 10 |
| Edge   | ▲ / ▼ in its colour on the plain disc         | the arrow alone                        | "slightly favoured", about 6 in 10 |
| Even   | =                                             | blank                                  | "even", about 1 in 2               |

- Not colour alone: direction is the arrow, level is fill and arrow count (both read in greyscale).
- The odds are the level's band in words, never a measured rate (ADR 0024 holds): they move only
  when a pair changes level.
- The prototype labels today's ruleset 19 balls from the 500-seed matchup sheet: 44 strong, 75
  edges, 181 even. The 49 even pairs that became edges have no reason yet ("A slight edge,
  measured; its reason is still to be written"); the proposal writes one per pair.
- Phone chart: 25 + 1 columns leave 13 px cells. Strong counters stay readable as filled cells;
  the edges add 98 small arrows. Proposed: on a phone the chart tab shows one ball against all 24
  (the quick setup's grid, already readable with ▲▲ / ▲ marks), the full grid stays on desktop.

## B. The rules

One rule labels every pair: the full run (500 seeds, both slot orders) measures the favoured
side's win rate. 65% or more is a strong counter, 58% up to 65% an edge, under 58% even. The map
stores each label with its reason; `pnpm balance` checks the label against the run.

| Label  | Fails                     | Warns                                   | Passes    |
| ------ | ------------------------- | --------------------------------------- | --------- |
| Strong | under 65% or over 78%     | 65-68% or 75-78%; within 1 point of 65% | 68-75%    |
| Edge   | under 58% or 65% and over | within 1 point of 58% or 65%            | 59-64%    |
| Even   | a side at 58% or more     | a side 55-58%                           | under 55% |
| Any    | a side under 22%          |                                         |           |

- No grey zone and no NEAR allowance in a full run: the label and the check read the same fights,
  so a pair outside its band is mislabelled. Relabel it (with a reason) or tune it.
- CI's 150-seed run keeps today's `ciAllowance` (three standard errors) on the map's labels.
- The shape counts strong counters only: 2-4 each way, within 1, up to 5 when the extra one comes
  from the same visible mechanic (Batch 2). An edge is a small lean a player can't plan a pick
  around; counted, most balls would have 6-12 each way and the rule would say nothing.
- Every ball 45-55% overall keeps its edges in balance; no separate edge count.
- Bots: Easy unchanged. Normal ranks by level (strong, edge, even, edge against, strong against).
  Hard's model odds become each level's middle: 70 / 60 / 50 / 40 / 30% (today 64 / 50 / 36%),
  so it plays the edges too.

## C. The sharpening plan, re-run with edges (500 seeds, pair-only harness)

Today (ruleset 19): 44 strong, 75 edges, 181 even. Counting strong only, 17 balls are off the
2-5 shape. One-number levers were measured one ball at a time (50 settings, each ball's 24 pairs
at 500 seeds), combined with an additive model (it predicted the verified run within one counter),
and the best set verified on all 300 pairs.

| Batch                                                                                     | Changes (numbers only, all buffs but Thorns' speed)                                                                                   |            Strong |   Edge |    Even |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------: | -----: | ------: |
| Today                                                                                     | –                                                                                                                                     |                44 |     75 |     181 |
| 1                                                                                         | Archer reload 120→110 ticks; Hex curse 25→27%; Frost health 80→83; Venom health 69→71; Bomber blast 26→28; Quake shockwave 6→7        |        56 (model) |     71 |     173 |
| 1b (same batch: 1 alone overshoots Archer > Bloom to 78.6 and drops the Speedster to 44%) | Speedster +12% a stack; Storm strike 40→42; Bloom bump 21→22; Ghost fade 60→70 ticks; Slime halves bump 80→85%; Titan grows 0.06→0.07 |        56 (model) |     73 |     171 |
| 2                                                                                         | Vampire lifesteal 90→95%, health 39→37; Thorns speed 730→715                                                                          | **58 (verified)** | **72** | **170** |

Verified end state: every ball 45.5-54.4%, worst side 23.1%, nothing over 78%; 31 strong in the
68-75% aim, 22 at 65-68%, 5 at 75-78%.

Today's 26 counters at 62-65%: 13 become strong, 10 honest edges, 3 even (Berserker > Archer and

> Quake, Spider > Quake). Today's 48 grey pairs: 31 edges, 4 strong, 13 even.

Still off the strong-only shape after the plan (11): Titan 0/0, Ghost 2/1, Quake 2/0, Slime 1/0,
Spider 1/2, Spartan 1/2, Sniper 1/2, Inferno 2/1, Frost 4/2, Boomerang 2/4, Vampire 2/5. Every
search (with and without nerfs) plateaus at 57-60 strong with about ten gaps: one-number levers
move a ball's whole row, as ADR 0010, 0028 and 0045 found.

## D. What picking well is worth (Reveal, measured odds, best play minus worst play)

|                           | Easy         | Normal       | Hard         |
| ------------------------- | ------------ | ------------ | ------------ |
| Bo3 now (best / gap)      | 55.3% / 10.8 | 55.1% / 12.2 | 52.0% / 11.2 |
| Bo3 now, three-level bots | 55.3% / 10.8 | 54.9% / 12.4 | 50.9% / 10.4 |
| Bo3 after the plan        | 55.5% / 11.1 | 55.1% / 12.8 | 50.9% / 10.7 |
| Bo5 now                   | 59.7% / 19.6 | 59.1% / 22.3 | 54.7% / 21.8 |
| Bo5 now, three-level bots | 59.7% / 19.6 | 58.6% / 22.3 | 52.6% / 20.0 |
| Bo5 after the plan        | 60.0% / 20.3 | 59.0% / 23.1 | 52.6% / 20.7 |

The plan moves what picking is worth by under one point; the three-level Hard bot is 1-2 points
harder at best play. Labelling honestly is the visible gain; sharper numbers barely change series.
