# Counter pass 2, phase 2: not reached (do not merge)

> **Scripts:** the measuring scripts this cites (under `scripts/`) were never merged to `main`: they
> lived on the experiment's own branch. The numbers here are the record.

Measured 2026-11-08 on `feat/counter-pass-2` (21 balls, ruleset 7 code plus the changes below).
The targets were not met, so nothing ships. This records the closest configuration and what it
would take.

## What was built (on this branch, behind a temporary tuning scaffold `src/sim/tune.ts`)

- **Shock stops heals** (heal cut 50% → 100%, shock 1.5 s → 3 s): Storm vs Vampire 66 → 80, vs Bloom 54 → 77.
- **Stagger** wider (220) and weaker (8), 4 s: Quake vs Archer, Sniper, Boomerang 80-81, vs Storm 70.
- **New rule, chill** (Frost): a slowed ball's wall bounces build nothing (Speedster stacks, Quake
  shockwaves). Frost vs Speedster 82, vs Quake 76.
- **Chrono redesign**: rewinds any ability hit of 12+ or a knockout, then recharges 7 s. Binary by
  kind: Storm 77, Sniper 78, Necromancer 70; even with contact balls.
- **Guardian redesign**: the shield soaks 5 and regrows 1.75 s after breaking. Strong against chip
  (Archer 69, Boomerang 64), weak to Thorns.
- **Boomerang**: a returning boomerang cuts through skulls and flies on.
- A coordinate-descent optimizer (`scripts/tune/opt.ts`) tuned 59 health and ability numbers against
  the new bands, over two maps: the hand-drawn map, then the balanced map closest to how fights fall.

## Closest configuration (500 seeds per slot order, balanced natural map, 65 favoured pairs)

| Target                       | Needed                | Today (ruleset 7) | Closest                                                   |
| ---------------------------- | --------------------- | ----------------- | --------------------------------------------------------- |
| Favoured pairs               | 72-78, fail <66 / >80 | mean 62.1         | mean 65.4; 40 below 66, 2 above 80; 5 in 72-78            |
| Even pairs                   | 45-55, fail 42-58     | 66 fails all told | 31 of 145 outside 42-58                                   |
| No side under 20%            |                       | 28.6              | 18.2 (fails)                                              |
| Each ball 45-55%             |                       | 46.0-52.6         | 45.9-54.4 (passes)                                        |
| Shape within 1               | every ball beats some | 9 balls off       | passes ±1, but Berserker and Bomber have no favoured pair |
| Median fight 15-22 s         |                       | 18.1              | 17.8 (passes)                                             |
| Draws under 5%               |                       | 0.6               | 0.7 (passes)                                              |
| Comebacks (loser led by 25+) | 10-20%                | 14.7              | 14.3 (passes)                                             |

73 pairs fail in total (from 66 at ruleset 7 under the new bands, with a different map).

## Why it falls short

- **Only binary rules sharpen selectively.** Every rule that acts on a kind of ball (shock vs
  healers, stagger vs aimers, chill vs wall users, Chrono vs big ability hits) moved its pairs
  10-25 points and left the rest alone. Every continuous lever (damage, health, reflect share,
  speed per stack, burn rate) stretched a ball's whole row: favoured pairs and their even
  neighbours moved together. The optimizer confirms it: it accepted almost no ability-strength
  changes, because each gain on a favoured pair cost an even pair.
- **The natural matrix is lopsided.** Under the closest config, 102 pairs sit at 58% or more one
  way. Venom (3 favoured, 9 unfavoured), Necromancer (1/7), Chrono (4/8) and Frost (2/6) lose
  broadly, while Archer (9/5), Storm (8/3) and Vampire (8/4) win broadly. A balanced map must call
  some of those even, and they fail as even pairs.

## What it would take

- About **one binary rule per ball** aimed at its favoured kind (roughly 15 more than today's five),
  each worth about +0.6 logit (+8% effective health) in its pairs only, with its own spark, words
  and tests. Today's ADR 0028 guidance of "about one per ball" allows this count, but it is the
  whole roster's worth of new mechanics.
- **Redesigns for the broad losers** (Venom, Necromancer, Frost) and the broad winners (Archer,
  Storm), so the natural matrix is balanced before rules sharpen it.
- **Berserker and Bomber need a counter of their own**: neither has a mechanic that favours it
  against any kind of ball.
- Then a full retune: at 200 seeds a pair has ±3.5 points of noise, so the last steps need 500.
