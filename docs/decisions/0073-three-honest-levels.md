# 0073: Three honest levels, and bots that read them

- Status: Accepted
- Date: 2026-11-20
- Amends: ADR 0010 (the map labels a level, not only a side), ADR 0022 (an older ruleset whose
  fights are today's still replays), ADR 0024 (a level's odds in words), ADR 0028 addendum and ADR
  0045 group 4 (the bands, the grey zone, NEAR and the shape), ADR 0035 (Normal and Hard read the
  levels)
- Builds on: the owner's decisions of 2026-11-20 and the approved prototype (draft PR #119,
  `docs/experiments/three-levels-proposal.md` on `proto/three-levels`); step 1 of its plan. The 14
  number changes (Batches 1, 1b and 2) come next, in their own ruleset.

## Context

The map said only who was favoured, from 62%. A pair at 58-62% was shown as even (the grey zone),
and a 63% pair looked the same as a 75% one: 48 grey pairs read as "even" while one side won about
six fights in ten, and players could not tell a lean from a counter. The bots read the same two
levels, so Hard valued a 63% and a 75% pair alike (64%), and Normal answered a lean as if it were
even.

## Decision

### 1. Three levels, one rule

Every pair is labelled from the full run (500 seeds, both slot orders) by its better side's win
rate: **65% or more is a strong counter, 58% up to 65% an edge, under 58% even.** The map stores the
label (`level: 'strong' | 'edge'` on every favoured entry) beside its reason; `pnpm balance`
checks it against the run (`scripts/counter-map.ts`, `LEVEL_BANDS`):

| Label  | Fails                     | Warns                        | Passes    |
| ------ | ------------------------- | ---------------------------- | --------- |
| Strong | under 65% or over 78%     | 65-68% or 75-78%             | 68-75%    |
| Edge   | under 58%, or 65% or more | within 1 point of 58% or 65% | 59-64%    |
| Even   | a side at 58% or more     | a side at 55-58%             | under 55% |
| Any    | a side under 22%          |                              |           |

- The bands meet with no gap: every rate passes exactly one label (a test walks 50-78%). There is
  no grey zone and no NEAR in a full run: the label and the check read the same fights, so a pair
  outside its band is mislabelled. Relabel it with a reason, or tune it.
- CI's 150-seed run keeps its noise allowance (three standard errors, NEAR) on the map's labels.
- Ruleset 19's sheet labels as 44 strong, 75 edges, 181 even; the map test reads the committed
  sheet (`docs/balance-matrix.csv`) and fails on any pair labelled otherwise.

### 2. The shape counts strong counters only

Every ball beats 2-4 balls outright and loses to 2-4, the counts within 1. A fifth on one side is
allowed when it comes from the same visible mechanic (`FIFTH_FROM_ONE_MECHANIC`: the Bloom, any
hit shuts its bud). An edge is a small lean a player can't plan a pick around; counted, most balls
would have 6-12 each way and the rule would say nothing. Every ball's 45-55% keeps edges in balance.

17 balls are off that shape today, each allowed exactly its gap with a one-line reason in
`SHAPE_EXCEPTIONS`:

- **Ten for ability tweaks or new balls** (the proposal's search plateaued with them still off):
  the Titan, Ghost, Quake, Slime, Spider, Spartan, Sniper, Inferno, Frost and Boomerang. The
  proposal's eleventh, the Vampire, fits today; its Batch 2 would make it 2/5.
- **Seven for the next run's numbers**, which the proposal's verified run brings to the shape: the
  Archer, Thorns, Magnet, Necromancer, Bomber, Bloom and Battery. That run tightens or drops each.

### 3. A reason for every edge

The 49 pairs that were even and are now edges each have a reason of their own, in the style of
the counter reasons and true to the sim (a blast heals the Vampire nothing; a nip is too small to
rewind), at most 97 characters so it fits the card at 375 px. A test fails on "still to be
written" anywhere, and on a favoured pair whose reason says neither side leans.

### 4. Bots by level (ruleset 20)

- **Easy** unchanged: any ball at random.
- **Normal** ranks by level: a strong counter, then an edge, then even, then an edge against, then
  a strong counter against (`standingOf`, 2 to -2), 60% of the time as before.
- **Hard** values a round at the middle of each level's band: **70 / 60 / 50 / 40 / 30%** (was 64 /
  50 / 36%), so it plays the edges too.

This changes bot choices, so the ruleset is 20 (`f86d0334…`). No fight changed: ruleset 20's known
results are ruleset 19's, match for match.

### 5. Series already played still replay exactly

A series records every pick, the bot's included, and `verifySeries` re-derives each bot pick and
refuses a series whose recorded pick differs. So a new bot alone would make every ruleset-19 link
against Normal or Hard fail, and every series saved for reload be dropped. Instead:

- `SAME_FIGHTS_AS = [19]` (`src/sim/ruleset.ts`): an older ruleset whose fights, roster, series
  rules and seeds are today's. `replaysHere` accepts it wherever only today's was accepted:
  `verifySeries`, the route (a v=19 link replays, no "older link" notice), `restoreSeries`, and the
  online screens.
- Its bots are kept: `botFor(opponent, ruleset)` gives a ruleset-19 series ruleset 19's Normal,
  Hard and first bot, reading its two levels (`src/sim/bot-r19.ts`: today's map with the 49 new
  edges read as even, and Hard's 64 / 50 / 36% written exactly as then). Easy never read the map.
- Proof (`scripts/replayed-rulesets.slow.test.ts`): ruleset 19's frozen known results equal
  today's; 288 series played by ruleset 19's own frozen bundle (every bot, format and length)
  verify here with the same rounds, and today's bots would refuse some of them. The test fails with
  the kept bots removed.
- Online series are unaffected: the server verifies each with its own ruleset's frozen bundle (ADR
  0052).
- The first ruleset that changes a fight (the next run) empties `SAME_FIGHTS_AS` and deletes
  `bot-r19.ts`: from then on ruleset 19 and 20 links show the older-link notice, as ADR 0022 has
  every fight change do.

### 6. On every screen

- Marks: a strong counter is two arrows on a disc filled in its side's colour (▲▲ / ▼▼), an edge
  one arrow on the plain disc (▲ / ▼), even =. Fill and arrow count read without colour. The chart's
  cells are too small for two arrows, so a strong counter there is one arrow on a filled cell.
- Words: "strongly" or "slightly favoured", and the level's odds in words: about 7 in 10, 6 in 10,
  1 in 2 (amends ADR 0024: these are a band's middle, never a measured rate, and move only when a
  pair changes level). Accessible names say the level ("slightly unfavoured against Vampire").
- The pick key is two short lines: whose edge each arrow is ("▲ you're favoured · = even · ▼
  bot's favoured"), then what two arrows mean ("▲▲ strong, about 7 in 10 · one arrow, about 6 in
  10"). The prototype's two lines both repeated "favoured" and "strong / slight"; this says
  direction once and level once, and fits two lines at 375 px.
- Ball page: Strong vs and Weak vs lead with their strong counters, each line led by its mark.
  With edges listed, a list runs to ten lines (the Vampire's Strong vs), so on a desktop an edge's
  line is compact and its reason is the mark's tooltip and the line's description; the entry still
  fits 1280 x 800 (`desktop-layout.wide.browser.test.ts`). A phone shows every reason on its card.
  Hovering a ball underlines its name only, never the mark; "How it works" has its own rounded
  corners, so its hover fill follows the box (square only where it opens).
- **Matchup chart, a fork.** On a desktop, the full grid as in the prototype. On a phone, 25
  columns leave 13 px cells, too small to read a level, so the chart shows one ball against all the
  others in the quick setup's grid and key (one component, `matchup-legend.ts`): "Every ball vs
  Thorns", each tile's mark how that ball does against it, a tap explains the pair above the grid,
  and "Change ball" turns the grid into a chooser. The two forms share one selected pair, so turning
  a screen keeps the explanation.

### 7. Nothing behind a series before its first round

In vs Friend on a laptop, the home demo stayed dimmed behind the panel until round 1. A series on
screen was "playing" from its first read, and between rounds a wide screen shows the arena dimmed
(the finished round stays, ADR 0025), so before round 1 it showed whatever the arena last held.
Each series controller already knew whether the arena holds its own world (`shownAt`); the stage
now marks `data-no-round` until it does, and the arena shows nothing then, at every size. Checked
on each live screen: the lobby and challenge are setup screens (no arena); lineups, picks and the
coin toss show nothing; between rounds and at the end the series' own last round stays dimmed; a
rematch is a new series and shows nothing until its round 1. Offline, round 1's pick is a setup
step, so it never showed there.

## Consequences

- `pnpm balance` on ruleset 20: every target passes; 87 pairs are off their aim (WARN), the next
  run's work. `docs/balance-summary.md` groups each ball's opponents five ways and lists strong
  counters and edges; `docs/balance-matrix.csv` labels each pair `A strong`, `B edge` or `even`.
- What picking well is worth barely moves (the proposal's part D): the three-level Hard bot is 1-2
  points harder at best play; the visible gain is honest labels.
- Every new ball adds a level and a reason per pair, and its strong counters must fit the shape.
