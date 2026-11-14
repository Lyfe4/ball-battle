# 0047: The Spartan replaces the Guardian, and the Bloom's regrowth pauses

- Status: Accepted
- Date: 2026-11-12
- Amends: ADR 0045 (the Guardian's armor and the Bloom's regrowth, group 2; the known gaps, group 4)
- Proposal: `docs/experiments/new-balls-proposal.md`, `docs/experiments/new-balls-proposal-2.md` (ruleset 11)

## Context

The new-balls proposal (round 2) asked for the Guardian to be reworked into the Spartan, no Dodger,
and the Magnet kept. The owner changed the Spartan's shield: a planted shield halves every hit (not
6 less), with no rule letting poison past it, because a rule only Venom meets is a rule between two
abilities (ADR 0045). The Bloom, which beat five balls, gets a short pause in its regrowth after
each hit it takes, shown on screen.

## Decision

### 1. The Spartan: "Plants its shield, then throws its spear."

One steady rhythm of 250 ticks (about 4.2 s), started at a seeded random point each match so it
never runs in lock-step with another ball's timer (round 2 measured a 25-point swing in the Archer
pair from a fixed start):

- **Shield planted, 135 ticks (2.25 s):** it slows to 0.42 of its speed (a bit under half), and
  every hit it takes, of any kind, does half, rounded down (`incomingDamageOf`, ADR 0045; a burn of
  3 does 1, a bump of 22 does 11). Each halved hit shows as the gold glance.
- **Spear:** as the shield comes down it throws its spear at the nearest enemy (28, speed 1500, no
  lead), then fights in the open for the rest of the rhythm.
- 44 health, bump 16, speed 730 (above the Frost, which stays the slowest ball).

On screen (replaced, see the addendum): while planted, a big bronze round shield faces the enemy
with the spear readied along its top; once thrown, the shield is slung behind it as an arc and
nothing is in front. The spear flies as a spear (shaft and head), not a dot.

**Its counters:** beats the Vampire (its bumps do half against the shield, so it drinks half);
loses to the Storm (slowed behind its shield it can't leave the circle) and the Chrono (it rewinds
the spear). The Inferno was meant to be a second win; halving takes no more off a burn than off
anything else, and in about 30 configurations (rhythm, shield length, shielded speed, spear, bump,
health, speed) the Inferno sat about 6 points above the Spartan's overall rate, so at a fair 50%
the pair is even. The owner accepted the Spartan with one win, as a known gap.

### 2. The Bloom's regrowth pauses

After every hit it takes, of any kind, its regrowth pauses for 60 ticks (1 s); it regrows 1 every
17 ticks otherwise (was 26), 49 health. On screen: every hit closes its petals into a bud (the pale
centre hidden) and they open again as the regrowth comes back.

So it beats balls whose hits come slowly (Berserker, Frost, Necromancer, Ghost, Chrono) and loses
to streams of small hits that keep it closed (Venom, Archer, Boomerang) and to the grown Titan.
Venom's poison now beats it: **Venom's known gap closes** (2-2). The Bloom keeps five wins, so its
exception stays at "up to 5 wins", but its gap narrows from 5-2 to 5-4.

### 3. Small changes to other balls

The Guardian's going and the Bloom's new shape moved pairs across the 62% line. Three 1-health
steps put them back: the Titan 77 → 78 (it no longer loses to the Inferno), the Chrono 61 → 62 (the
Boomerang no longer beats it) and the Inferno 75 → 74 (its wins over the Thorns and Titan drop into
the grey zone). One health point moves a small pair by 1-3 points; two points on the Vampire moved
it from one win to six.

### 4. The known gaps

Every hard rule passes (below). The shape does not for four balls the owner accepted as known gaps
(`SHAPE_EXCEPTIONS`, `docs/vision.md`):

| Ball                 | Shape | Why                                                                  |
| -------------------- | ----- | -------------------------------------------------------------------- |
| Spartan (new)        | 1-2   | Half of every hit is half for everyone: it beats only the Vampire.   |
| Sniper (new gap)     | 1-2   | It beat the Guardian; the Spartan is even with it (42/58).           |
| Quake (new gap)      | 2-1   | It lost to the Guardian; nothing else beats it at 62% or more.       |
| Vampire (new gap)    | 1-4   | The Spartan is its fourth loss; a second win tips the Chrono to 4-5. |
| Venom (closed)       | 2-2   | It beats the Bloom now.                                              |
| Bloom (narrowed)     | 5-4   | Was 5-2: it now loses to Venom, the Archer and the Boomerang too.    |
| Storm, Titan, Bomber | -     | Unchanged gaps; the Storm gained its second win (the Spartan).       |
| Berserker            | 5-2   | Unchanged.                                                           |

About 20 targeted attempts (health and bump steps, the Frost's slow length, a whole-roster greedy
search re-playing only the changed balls' pairs at 500 seeds) each fixed one of the Quake and
Vampire and broke a neighbour; the pairs sit in a dense band at 58-63%.

### 5. The Sniper keeps its shape gap

The owner was not fussed. The Sniper's best candidate for a second win is the Titan (58.5%) or the
Spartan (58%); neither is a clean mechanical edge, so it is recorded as a gap.

## Measured

`pnpm balance`, 500 seeds per slot order, every pair (`docs/balance-summary.md`):

| Gate                             | Ruleset 11 | Ruleset 12 |
| -------------------------------- | ---------- | ---------- |
| Each ball overall (45-55%)       | 45.6-53.5  | 45.6-52.6  |
| Weakest side of any pair (22%)   | 24.4       | 23.8       |
| Highest counter (78%)            | 75.2       | 75.0       |
| Pairs outside their floor        | 0          | 0          |
| Median fight (12-30 s)           | 16.2 s     | 15.8 s     |
| Draws (under 5%)                 | 0.5%       | 0.5%       |
| Comebacks (10-20%)               | 18.6%      | 19.8%      |
| ±5% health (warn 15, fail 20)    | 11.7 pts   | 11.7 pts   |
| Shape (with the named gaps)      | passes     | passes     |
| Grey-zone pairs (58-62%, warned) | 34         | 40         |
| CI's balance check (150 seeds)   | passes     | passes     |

The Spartan: 49.4% overall; beats the Vampire 71.7%; loses to the Chrono 72.1% and the Storm
66.8%; grey: the Speedster 58.1% and Sniper 58.0% over it. The Bloom: 49.9%; beats the Berserker
72.0, Frost 71.3, Necromancer 66.7, Ghost 66.4 and Chrono 63.2%; loses to Venom 74.3, the Archer
65.1, Titan 63.3 and Boomerang 62.4%.

Series (`docs/series-measurements.md`): what the player's choices are worth is unchanged with
measured odds (Reveal 11-12.5 points, Showdown 6-10). Phone frame timing (`scripts/frame-timing.ts`,
375 x 812 at 4x CPU throttle, over the Spartan against the Vampire and Storm, the Bloom against
Venom and the Archer, Berserker vs Venom and Bomber vs Speedster): no frame over 16.7 ms.

| Refresh               | Frames | Median |    p95 |    Max | Over 16.7 ms |
| --------------------- | -----: | -----: | -----: | -----: | -----------: |
| 60 Hz (native rAF)    |  7,320 | 0.0 ms | 0.1 ms | 2.0 ms |            0 |
| 90 Hz (fixed driver)  |  8,995 | 0.0 ms | 0.1 ms | 2.3 ms |            0 |
| 120 Hz (fixed driver) |  9,149 | 0.0 ms | 0.2 ms | 2.6 ms |            0 |

## Rejected

- **Flat armor (6 less, never under a quarter), no poison rule:** beats the Inferno 63-68, but
  also the Venom 71-74 (Venom stays at one win). The owner chose the half shield.
- **The Spartan at speed 700:** below the Frost, breaking the Frost's identity as the slowest ball.
- **A shorter pause (0.5 s) for the Bloom:** keeps its old shape closer (4-2), but the bud barely
  shows; the 1 s pause reads and its numbers retune cleanly.
- **The Bloom's pause with the Guardian kept:** four balls off-shape before any retune, no better.
- **Retuning the Frost's slow (4.5 s → 5.5 s)** to give the Quake its loss: the Frost then lost
  its own second loss (4-1).

## Consequences

- `RULESET_VERSION` 12; old links show the older-version notice as usual.
- The UI fixes shipped with this change (no sim): the HUD health bar's fill and ghost are plain bars
  clipped by the track's pill (no pale edge around the fill's end); the series bar's line never
  breaks inside a phrase and, on a desktop wide enough, the panel beside a fight widens to 18rem so
  "Best of 3 · Reveal · Hard" fits on one line without shrinking the court; the Leave series
  confirm puts the question on its own line and Stay and Leave under it, the same size, Stay
  first (`panel-parts-flow.ts` checks all three at 375, 1280 and 1920 wide).

## Addendum (2026-11-13): the Spartan's look

On an iPhone (about 390 wide) the first look did not read as a Spartan. On a small ball a circle reads
as an eye: the planted round shield with the spear line over it looked like an eye and an eyebrow,
the slung shield like an eyeball looking sideways, and the spear line on the ball was too thin to
see. The cream body read as an egg. Visual only: no sim change, ruleset 12 and the known match
results unchanged (a ball's colour is outside the fingerprint, ADR 0022).

The owner chose from three variants on a dev preview page (a front-view helmet on crimson, an
all-bronze helmet, and a helmet in profile on crimson). A first attempt (a bronze ball with a
front-view T-slit and an arched crest) read as a keyhole with an eyebrow, its shield's broken end as
a crack (the Berserker's mark), and the burnt orange too near the Inferno and Chrono.

- **The face is a bronze Corinthian helmet in profile, in both states**: dome, face guard to the
  chin, flared neck guard, a dark almond eye. It looks at the enemy, turning only left or right,
  never upside down, so the face is always upright.
- **A cream crest** with a dark rim runs from the brow over the top to the back and stands a little
  past the ball's edge, so the silhouette changes. Cream, not red: a red crest disappeared into the
  crimson body at phone size. It is drawn after the outline through a new optional
  `BallDesign.over` (kept within an icon's 12% padding); every other design still stays inside its
  ball.
- **Planted: a smooth thick bronze arc** with a dark rim all round hugs the edge facing the enemy,
  with a ring of crimson between it and the helmet, so planted and open differ at a glance at 390
  wide. Thrown: the arc is gone. No break in the arc: a break read as a crack.
- **The spear shows only in flight**, never on the ball. It is the Spartan's main attack (about 55%
  of its damage, measured below), so it is the boldest thing it draws: a long thick bronze shaft and
  a broad bronze head, both outlined in dark.
- **Colours, three main ones**: crimson body `#dc2626`, bronze `#e0a83e` (helmet, shield, spear),
  cream crest `#fef3c7`, with dark rims `#1c0a02`. A deeper crimson cannot be used on the indigo
  floor: a red dark enough to look deep is under 3:1 against it (`#b91c1c` is 2.6:1). `#dc2626`
  passes at 3.5:1 but sits near the Brawler and Magnet in colour alone (CIEDE2000 7.6 and 9.2, about
  as close as the Chrono and Inferno, 8.6); the bronze helmet and cream crest, which neither has,
  are what tell them apart, checked beside both at phone size.
- The look is checked in a real canvas in every engine at phone and desktop size
  (`src/render/spartan-look.browser.test.ts`): the crest upright and past the edge, the eye towards
  the enemy, the shield arc towards the enemy only while planted and clear of the helmet, and the
  spear in flight. It fails on both earlier looks.

The spear, measured over every opponent, 40 seeds, both slot orders (1,680 matches): it does 28
against a bump of 16 (before directness, which scales only bumps), flies straight at where the
nearest enemy is (no lead) at 1500 a second until it hits a ball or minion or reaches a wall (its
2-second life is longer than any flight across the court), and lands about one throw in three
(2,233 of 6,706). That is 55% of the Spartan's damage (54,400 of 98,884); bumps are the other 45%.
