# 0056: The Battery, Venom over Thorns, and the fastest ball by what players see (ruleset 16)

> **Scripts:** the measuring harness this cites (`scripts/new-balls/`, including

- Amended by: ADR 0071 (the Battery's look: one smooth fill)

- Amended by: ADR 0058 (the Magnet pulls shooters in (ruleset 18))

> `speed-probe.ts`) lives on `proto/battery-r16` and was never merged to `main`. The numbers here
> are the record.

- Status: Accepted
- Date: 2026-11-17
- Amends: ADR 0045 (a defence can tell what dealt a hit; the known gaps), ADR 0049 (the Storm's and
  Bomber's allowances go)
- Proposal: `docs/roster-expansion.md` on `proto/roster-expansion` (the Battery in for the Magnet,
  measured at ruleset 15), then `proto/battery-r16` (the Battery beside the Magnet)

## Context

The roster's first named gap (ADR 0049) was that nothing but the Chrono's rewind blunted one big
strike or blast, so the Storm and the Bomber each lost to one ball. The roster-expansion proposal
filled it with the Battery, a ball that stores part of every big hit and throws it back on its next
bump, in place of the Magnet. The owner kept the Magnet, so the Battery was measured beside it on
`proto/battery-r16`. Two things stood in the way:

1. **Thorns had only two losses.** With the Battery in, Thorns beat four balls and lost to two, one
   off the shape. Venom at bump 10 and health 69 (from 11 and 66) gives Thorns its third loss.
2. **The Battery only fits at speed 870,** faster than the Speedster's base 800. Its losses to the
   Frost and the Spider come from their slows, which only bite a ball that relies on speed. No
   slower Battery kept both losses without handing the Bloom, Vampire or Venom a win over it. The
   identity rule was "the Speedster is the fastest ball at base speed".

The owner's rule for the second: the Speedster must stay the fastest ball in what players see. If
it is clearly the faster ball for most of a fight, the Battery ships at 870; if not, the Speedster
gets the smallest base-speed buff that puts it back above the Battery.

## Decision

### 1. The Speedster is the fastest ball where it counts: in the fight

Measured in real fights (`speed-probe.ts`, ruleset 16 roster, 500 seeds in both slot orders, every
Speedster matchup, its speed sampled every tick it is alive):

| Speedster vs 870                     | All 23 matchups | vs the Battery | vs the Frost | vs the Spider |
| ------------------------------------ | --------------: | -------------: | -----------: | ------------: |
| Average speed                        |             996 |           1028 |          759 |           668 |
| Share of fight time faster than 870  |           79.8% |          85.7% |        39.8% |         19.5% |
| Fights faster than 870 for over half |           92.0% |          99.9% |        18.4% |          4.0% |
| First passes 870 (median)            |          0.47 s |         0.47 s |       0.47 s |        0.47 s |

One wall bounce (a stack: 880) already takes it past 870, and it does that in under half a second
of every fight. The only fights where it spends most of its time slower are against the two balls
whose slows are their counter to it (Frost > Speedster and Spider > Speedster are counters by
design), and the Battery is slowed by those same two balls (it averages 660 against the Frost and
582 against the Spider). In its own fights the Battery averages 843.

So the Battery ships at 870 and the Speedster's base speed is unchanged. The identity rule becomes
what players see: **one wall bounce takes the Speedster past every other ball's top speed**
(`identity.test.ts`). The manual follows: a definition may declare `topSpeed` (the most its
`cruiseSpeed` ever gives; text only, never read in a fight), the Speedster's is 1200 (five stacks),
and the manual's speed shows "800–1200" with a full bar and names it the "Fastest ball". Every
other ball shows its base speed against that top. No buff was needed, so none was tried.

### 2. The Battery

Stores a third (`STORE_SHARE` 0.33) of every strike, blast or burst of 15 (`BIG_HIT`) or more, up
to 40 (`CAPACITY`); the rest lands. Its next bump adds everything stored to its contact damage
(`contactDamageOf`, ADR 0015) and empties it. Bumps, shots, arrows, burns, poison and nips are never
stored. Health 70, bump 23.5, speed 870, standard radius.

- **Engine:** `incomingDamageOf` is told what dealt the hit (`via`, or `'contact'` for a bump), and
  `onDamageTaken` gets `reduced` (what its own defence took off) and `via`. A damage event carries
  `reduced` when a defence took some. Still one rule in one place for both damage paths (ADR 0045):
  no interaction rule, since the Battery stores any big strike from anyone.
- **One-liner:** "Stores big strikes and blasts; its next bump lets them out." Its "How it works"
  is built from the constants above.
- **Look:** a dark battery seen side on, on electric blue (`#2563eb`), with four cells that light
  from the bottom as it stores; at phone size they merge into one gauge. Its blue keeps 3.27:1 on
  the floor and sits far from the Archer's cyan and the Storm's pale blue (OKLab distance 0.30 and
  0.29; the roster's closest existing pairs are 0.04-0.06). Its sign in the arena is `hitReduced`.
- **Matchups (500 seeds):** beats the Storm 74.8, Bomber 72.8 and Hex 68.9; loses to Thorns 72.9,
  the Frost 62.4 and the Spider 62.4. 48.5% overall, 3-3.

**Is it a copy of the Chrono?** Partly, and it should be said plainly. Two of its three wins (the
Storm, Bomber) are Chrono wins too, for the same reason: it blunts one big hit. What it does
differs: the Chrono undoes a hit and jumps back, the Battery takes most of it, keeps the rest and
throws it back on contact (you see the cells fill, then empty into the other ball). It also beats
the Hex, which the Chrono doesn't, and it plays as a fast, hard bumper, not a slow tank.

### 3. Venom over Thorns

Venom: bump 11 → 10, health 66 → 69. Its poison never touches the spikes and its bumps are now
light, so Thorns barely bites: Venom 64.9% (was even). Thorns is 4-3 (Brawler, Magnet, Titan,
Battery; Archer, Sniper, Venom). Venom is 3-2 (Bloom, Chrono, Thorns; Berserker, Ghost).

### 4. The Boomerang stays at 760

From the proposal (770 → 760). Measured again with the final roster (200 seeds) at 770: the
Boomerang goes 5-3 (it beats the Frost, Chrono and Inferno) and the Spider drops to one loss, both
off shape. At 760 the Boomerang is 3-3 and the Spider 4-3. The Frost-Boomerang pair is now even
and the Boomerang beats the Spider (counter map updated).

### 5. The roster's shape (500 seeds, `pnpm balance`)

Every hard rule passes: every ball 45-55% (lowest the Speedster 45.8%, highest the Bomber 52.0%),
worst side 23.8%, draws 0.5%, median fight 16.3 s, comebacks 18.4%, ±5% health moves a rate by at
most 11.9 points, every pair inside its counter-map floor. The Storm is 2-2 and the Bomber 2-2, so
their allowances (one loss) are removed. The Magnet stays an even pick (loses only to Thorns; even
with the Battery, 52.8/45.9). The named exceptions left: the Titan (1-1), Berserker (up to 5 wins),
Bloom (up to 5 losses), Ghost (1 loss), Sniper and Quake (1 win each) and the Vampire (within 2).

## Consequences

- Ruleset 16 (golden results regenerated, frozen as `rulesets/r16/`; r15's bundle stays for open
  online series). No migration.
- The Speedster's identity is now pinned by the speed it fights at, not its base. A future ball
  faster than 880 at base, or a buff past it, breaks the rule and is a design decision.
- The Battery and the Chrono now share the "blunts one big hit" niche; a future ball for that gap
  should not.

## Also measured: the Slime (not shipped)

`proto/slime-2` measured a sharper Slime (a ball that splits in two at half health) against
ruleset 15 with the Boomerang at 760 (`docs/slime-proposal.md` there). Lessons kept in
`docs/vision.md`: every version that has an edge has it over the Sniper first (it wastes one big
aimed hit), and the Sniper can't take a third loss; faster, smaller halves add the Archer and Hex;
bigger or slower halves only grow the Speedster's and Sniper's edges; weaker halves or earlier
splits only lose. The closest version was 53.0%, 2-1, so it failed.
