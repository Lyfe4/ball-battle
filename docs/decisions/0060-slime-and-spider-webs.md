# 0060: The Slime, and the Spider's webs are used up (ruleset 19)

- Status: Accepted
- Date: 2026-11-17
- Amends: ADR 0049 (the Spider), ADR 0045 (the known gaps, group 4), ADR 0058 (the Magnet's gap)
- Builds on: ADR 0059 (sides and the split action)
- Proposal: `docs/spider-slime-proposal.md` on `proto/spider-slime` (owner's decisions 1-5)

## Context

The proposal measured two steps. Step 1, a Spider whose webs are used up when they catch, settles
its Chrono win even and keeps its Speedster and Quake wins, with room for a Slime win. Step 2, the
Slime, passed every hard rule but one: the Archer went to five losses. The owner accepted both
steps and gave the Archer a named allowance (decision 3).

## Decision

**The Spider (owner's decision 1).** A web that catches a ball is used up (gone); the Spider spins
a new one on its next bounce off that wall. The slow drops from 6.5 s to 6 s (`WEB_SLOW_TICKS` 360) and a web reaches 145 along its wall (`WEB_HALF_LENGTH`, from 140). Nip 3, at most 6 webs,
12 s each: unchanged. Its identity and look stay. Its "How it works" adds "and the web snaps".

Every numbers-only change moved the Quake and Chrono pairs together, and the Bomber, Boomerang and
Archer pairs together (the proposal's table); only a change to how often one web catches separates
them. A hard bumper that comes back to the same wall (the Chrono) used to be caught by one web many
times; the wall bouncers (the Speedster; the Quake, whose shockwaves come off the walls) meet
fresh webs everywhere.

**The web snap (look).** A used-up web is seen to go: its silk flashes bright, then its two halves
spring apart along the wall and fade (420 ms, `theme.webSnapMs`). With reduced motion it flashes
and fades in place. A web's end is ability state, not an event, so the renderer reads it from
consecutive worlds as it reads wall bounces (`snappedWebs`, `src/render/moments.ts`): a web gone
before its time, on a tick the Spider caught a ball, and not respun in place.

**The Slime (owner's decision 2).** The first time a hit leaves it at half its health or less, it
splits into two small slimes on its side (the split action, ADR 0059) that share what it has left
in whole points. The enemy must knock out both. Health 76, bump 24, speed 760; each half is radius
30 (`HALF_RADIUS`), 20% faster and bumps for 80%, starting 30 apart. Any hit, from anything, can
split it; a half never splits again. One-liner: "At half health it splits in two; finish both to
win." Its "How it works" is written from the constants.

- **One clear thing, the same on any ball:** it reacts to its own health, not to the kind of hit.
  Its counters come from the mechanic: one aimed hit (an arrow, a heavy shot) only ever finishes
  one half, while the Spider's webs catch both halves and the Vampire drinks from two bodies.
- **The pass-through property holds:** a half is smaller and faster, so `balls.test.ts` checks
  the closing speed against the smallest radius a ball reaches; the margin is not loosened.
- **Teaching:** its ability shows by its `split` event (a new `AbilitySign`), so the arena's
  one-time "Split!" hint (ADR 0036) is read from it.

**The Slime's look.** Three options were mocked up on the real arena at phone size (whole,
mid-split, two halves): A, a lemon-lime jelly (`#e8f580`) with two eyes; B, an ooze green
(`#2bee7a`) with bubbles rising inside; C, a bubblegum gummy (`#fda4af`) with a pale rim. **A
ships:** it is the farthest colour from every ball (ΔE 36 or more; B is 30 from Thorns among the
greens, C 32 from the Bloom's pink), it reads as jelly rather than another green or pink, and its
face makes the two halves plainly the same creature, smaller. All three share the shape: a body
outline that wobbles slowly (`BallDesign.outline`, a closed path the fill, flash and outline use),
a wide shine and a soft inner shade for gloss and depth, and while whole a wavy seam down its middle
where it will split. Squashing on a bump is every ball's.

**The split (look).** A band of jelly joins the two halves, thins and breaks (the stretch), then a
ring of droplets is thrown from where it broke (the pop), 380 ms in all (`theme.splitMs`). With
reduced motion the band just fades. The halves' wobbles run half a turn apart.

**Health shows by side.** The HUD has one row a side and its bar and health read the halves added
up (`sideHealth`); a match's story credits what a half did to its side; the winner's ring circles
every half still standing; a half's own bar on the court is its share of the whole, coloured by
its side's total. A half keeps its side's shade in a mirror match.

**The Archer's allowance (owner's decision 3).** The Archer loses to five balls: the Slime joins
the Magnet, Necromancer, Speedster and Berserker. `SHAPE_EXCEPTIONS.archer` allows up to 5 losses,
wins and losses within 1, like the Bloom's. Every Slime that beats the Sniper beats the Archer by
as much or more, so the Slime can't be tuned off it; the gap closes with a change that takes one
of the Archer's losses (docs/vision.md).

**The Magnet keeps its exception (decision 4).** The Slime brawls, so it meets only the timed
pull, but the brawl is even (50.7%).

**The Spider's win over the Battery (decision 5).** 62.5% at 500 seeds, 60.7% in CI's 150-seed
check (NEAR: within 2 points of the floor, which passes) and 7.0 points at most under ±5% health
(the warn line is 15). Neither check fails, so it stays a Spider win as measured; the decision's
fallback (settle it even) was not needed.

**The Vampire's allowance goes.** It beats the Slime, a third win against its four losses: it is
on the standard shape, so `SHAPE_EXCEPTIONS.vampire` is removed.

Counter map: the Slime is favoured over the Archer and Sniper and the Spider and Vampire over it;
every other pair is even. The Spider–Chrono pair is even; the Spartan is favoured over the Spider.
The bot reads the map.

| Ball    | Ruleset 18 | Ruleset 19 (500 seeds)                                                                                                                  | Why               |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Slime   | -          | 48.8%, 2-2: beats Archer 68.2, Sniper 67.1; loses to Spider 63.7, Vampire 63.7                                                          | New               |
| Spider  | 4-3        | 49.7%, 4-4: beats Speedster 74.9, Quake 64.1, Slime 63.7, Battery 62.5; loses to Bomber 64.4, Archer 62.9, Boomerang 63.0, Spartan 62.1 | Used-up webs      |
| Chrono  | 4-4        | 4-3 (Spider even, 60.0 its side)                                                                                                        | Used-up webs      |
| Spartan | 2-3        | 3-3 (beats the Spider)                                                                                                                  | Used-up webs      |
| Vampire | 2-4        | 3-4 (beats the Slime)                                                                                                                   | Allowance removed |
| Sniper  | 2-2        | 2-3 (loses to the Slime)                                                                                                                |                   |
| Archer  | 4-4        | 4-5 (loses to the Slime)                                                                                                                | Named allowance   |

Every other ball is as in ruleset 18.

## The roster (25 balls, 500 seeds, `pnpm balance`)

Every hard rule passes: every ball 45.8-52.2% overall, worst side 24.4%, every pair inside its
floor, draws under 5%, median fight inside 12-30 s, comebacks 18.5%, ±5% health moves a rate by at
most 12.7 points (Venom vs Slime), every ball on its shape or its named exception. `pnpm
balance:ci` (150 seeds) passes too. `docs/balance-summary.md` is regenerated.

## Consequences

- Ruleset 19: golden results regenerated, frozen as `rulesets/r19/`; r15-r18 stay for open online
  series. No migration.
- The link-preview image shows 25 balls; the style guide has the Slime's tiles and a split Slime
  in the phone arena.
