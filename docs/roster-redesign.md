# Roster redesign: design

Approved 2026-11-08 with the decisions below, which override the rest of this document where they
differ. It ships in four groups, one pull request each (section 5); ADR 0045 records what each group
changed and measured. The rough prototype measured here is on the branch `roster-redesign/design`
(`src/sim/redesign/`, read only by `scripts/redesign/`), kept until the last group ships.

**The idea in one line:** every ability acts on a _kind_ of hit or a kind of ball (small hits, big
hits, bumps, wall bounces, aimed shots), the same way on everyone. That replaces the three pair rules,
and it is what gave the sharpest counters in the prototype.

## 0. Decisions (approved 2026-11-08)

1. **Two counter bands.** A counter that acts on a kind of hit (armor, fade, rewind, poison against
   rewind, spikes against bumps, lifesteal against shots) targets 72-78% and fails below 66 or above 80. A movement or position counter (fast against shooters, skeletons drawing shots, a giant
   against shooters, pulls, cold against fast) targets 62-72% and fails below 58 or above 76. Every
   favoured pair in the map names its band (`band: 'kind' | 'movement'`).
2. **Wrong-way counters** (Quake over Magnet, Berserker over Bloom, Bomber over Necromancer, Frost
   over Magnet) either work with the ball's existing simple ability or are marked even. No rule is
   added to force one.
3. **Nothing too extreme:** Guardian vs Venom (94), Ghost vs Inferno (84), Chrono vs Sniper (81) and
   any other pair above 80, or with a side under 20, comes into band.
4. **Reasons are true and obvious.** "Drinks while the Ghost fades" is not a reason if nothing hurts
   a fading Ghost: Vampire vs Ghost and Bloom vs Ghost get a real, guessable reason or change. Frost
   vs Magnet gets plain wording.
5. **Berserker, Bomber and Quake get real edges from their own ability:** the Berserker as "burst
   beats sustain" (Guardian, Bloom, Vampire-type balls), the Bomber as "area beats fast and swarms"
   (Speedster, Necromancer), the Quake as "shockwaves clear swarms and punish brawlers". Their
   numbers change, or their ability is simplified, until they win those pairs.
6. **Plain wording, no hidden numbers in descriptions:** the Guardian "Every hit it takes does a
   bit less" (the tiny-hit detail stays in code), the Chrono "Rewinds big hits, then recharges".

The principles stay: every ball does one clear thing that works the same on any ball; no rule exists
only where two specific abilities meet; counters a player can guess by watching; balanced shapes; the
Brawler the plain even pick.

**Gates for each group** (the final targets apply only after group 4): every hard rule from today
still passes for the whole roster (no side of any pair under 25%, each ball 40-60%, median fight
12-30 s, draws under 5%, sensitivity); the number of pairs failing the new bands goes down compared
with ruleset 7 and no ball of the group fails more pairs than before; comebacks (the loser once led
by 25+ points of health) stay 10-20%. A group that can't pass ships nothing.

## 1. Roles

| Ball        | Role       | Ability (one sentence)                                                       | Change from today                                                          |
| ----------- | ---------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Brawler     | Plain      | No tricks: hits hard and takes a beating.                                    | Kept.                                                                      |
| Speedster   | Fast       | Wall bounces build speed, and its next bump cashes it in.                    | Kept.                                                                      |
| Vampire     | Lifesteal  | Heals half of the damage its bumps deal.                                     | Bumps only, 45% → 50%; shock no longer halves it. Health 58 → 59.          |
| Archer      | Shooter    | Shoots a leading arrow every 2 s; frail up close.                            | Stagger no longer holds its aim. Health 50 → 46.                           |
| Storm       | Caller     | Calls a big lightning strike on its enemy every 2 s, after a warning.        | No shock, no stagger. Strike 31 → 36.                                      |
| Frost       | Cold       | Every hit slows its enemy for 3 s.                                           | Kept. Its counters now come from what speed feeds: wall bounces.           |
| Thorns      | Spikes     | Every bump it takes hurts the attacker back.                                 | Kept.                                                                      |
| Venom       | Poison     | Bumps poison its enemy: small damage every half second.                      | Poison no longer numbs rage.                                               |
| Berserker   | Rage       | Huge health; the more hurt it is, the harder it hits.                        | Nothing numbs it. Burst beats sustain (decision 5); group 1: see ADR 0045. |
| Sniper      | Heavy shot | Locks on and fires one heavy shot every 2 s.                                 | Stagger no longer breaks the lock.                                         |
| Quake       | Shockwaves | Every wall hit sends out a shockwave that hurts anything near it.            | **New:** damage only (radius 200, 11), no stagger.                         |
| Magnet      | Grabber    | Every 2 s it pulls its enemy in.                                             | Kept. Bump 25 → 24.                                                        |
| Ghost       | Fade       | After every hit it takes it fades for half a second, and nothing hurts it.   | **New:** replaces timed phasing and the spectral hit. Health 77 → 80.      |
| Necromancer | Skeletons  | Raises skeletons that wander and bite; aimed attacks go for the nearest one. | Kept (aimed attacks already go for the nearest enemy thing, for anyone).   |
| Chrono      | Rewind     | Rewinds big hits, then recharges.                                            | **New:** every big hit, not one knockout a match. Health 78 → 66.          |
| Titan       | Giant      | Grows bigger as the match goes on.                                           | Kept. Health 85 → 84.                                                      |
| Inferno     | Fire trail | Leaves a trail of fire that burns whoever crosses it.                        | Kept.                                                                      |
| Boomerang   | Thrower    | Its boomerang hits on the way out and on the way back.                       | Stagger no longer holds its aim.                                           |
| Bomber      | Bombs      | Drops a bomb every 2.5 s; it blows when touched or after 3.5 s.              | Bombs 11 → 12, every 2.2 → 2.5 s, so the Chrono can rewind a blast.        |
| Guardian    | Armor      | Every hit it takes does a bit less.                                          | **New:** armor on every hit replaces the one-hit shield. Health 63 → 74.   |
| Bloom       | Regrowth   | Always regrowing: heals 1 every two-thirds of a second.                      | **New:** steady regrowth, not only when left alone. Health 68 → 58.        |

## 2. Intended counter map

52 favoured pairs and 158 even. Every ball's strong and weak counts are within 1 (the Brawler: none
strong, one weak). Each name carries the prototype's measured win rate (100 seeds per slot order,
about ±7 points per pair).

Rules of thumb a player can learn by watching:

- **Hit kinds (the sharp ones):** armor beats chip; fading beats repeated small hits; rewind beats big
  ability hits; small hits beat rewind; spikes beat bumpers; shooters (which never touch) beat spikes.
- **Movement:** fast beats aimed shots; cold beats wall-bouncers; skeletons draw aimed shots; fire and
  shockwaves clear skeletons; grabbers beat shooters; a growing giant crushes frail shooters but is a
  big target for heavy shots and strikes.
- **Healing:** lifesteal and regrowth outlast long, low-damage brawls; big hits outpace regrowth;
  lifesteal can't drink from a shooter.

**Brawler** (52% overall)

- Strong vs: none
- Weak vs: Thorns 30 (Every hard bump hurts it back)
- Even: Speedster 52, Vampire 55, Archer 47, Storm 49, Frost 53, Venom 50, Berserker 53, Sniper 45, Quake 55, Magnet 64, Ghost 61, Necromancer 56, Chrono 56, Titan 47, Inferno 49, Boomerang 46, Bomber 53, Guardian 61, Bloom 60

**Speedster** (51% overall)

- Strong vs: Archer 70 (Too fast to aim at, and it closes in); Sniper 65 (Too fast to aim at, and it closes in); Boomerang 74 (Too fast for the boomerang either way)
- Weak vs: Frost 39 (The cold slows it, so it builds no speed); Bomber 39 (Runs over more bombs than anyone)
- Even: Brawler 48, Vampire 48, Storm 56, Thorns 40, Venom 50, Berserker 45, Quake 45, Magnet 39, Ghost 68, Necromancer 48, Chrono 42, Titan 42, Inferno 62, Guardian 42, Bloom 59

**Vampire** (53% overall)

- Strong vs: Guardian 60 (Drinks faster than the armor slows it); Ghost 70 (Drinks while the Ghost fades)
- Weak vs: Archer 41 (It cannot drink from a shooter); Boomerang 40 (It cannot drink from a shooter)
- Even: Brawler 45, Speedster 52, Storm 46, Frost 50, Thorns 51, Venom 49, Berserker 58, Sniper 50, Quake 59, Magnet 59, Necromancer 58, Chrono 61, Titan 59, Inferno 46, Bomber 52, Bloom 60

**Archer** (49% overall)

- Strong vs: Thorns 60 (Arrows never touch the spikes); Vampire 59 (It cannot drink from a shooter); Chrono 62 (Arrows are too small to rewind); Frost 52 (Too slow to reach the Archer; every arrow lands)
- Weak vs: Speedster 30 (Too fast to aim at, and it closes in); Titan 34 (Grows too big for the frail Archer to avoid); Necromancer 32 (Skeletons draw the arrows); Magnet 34 (Pulls the frail shooter into a brawl)
- Even: Brawler 53, Storm 50, Venom 49, Berserker 44, Sniper 51, Quake 55, Ghost 52, Inferno 52, Boomerang 46, Bomber 52, Guardian 46, Bloom 60

**Storm** (50% overall)

- Strong vs: Titan 57 (Too big to leave the warning circle); Bloom 55 (Big strikes outpace its regrowth); Frost 55 (Too slow to leave the warning circle)
- Weak vs: Chrono 23 (Rewinds every big strike); Magnet 38 (Pulls the caller into a brawl)
- Even: Brawler 51, Speedster 44, Vampire 54, Archer 50, Thorns 52, Venom 51, Berserker 46, Sniper 50, Quake 57, Ghost 49, Necromancer 56, Inferno 55, Boomerang 55, Bomber 51, Guardian 48

**Frost** (51% overall)

- Strong vs: Speedster 61 (The cold slows it, so it builds no speed); Quake 60 (The cold slows it, so it hits fewer walls); Magnet 50 (wrong way, decision 2; wording to fix in group 3)
- Weak vs: Archer 48 (Too slow to reach the Archer; every arrow lands); Storm 45 (Too slow to leave the warning circle)
- Even: Brawler 47, Vampire 50, Thorns 38, Venom 48, Berserker 45, Sniper 47, Ghost 68, Necromancer 52, Chrono 53, Titan 57, Inferno 43, Boomerang 41, Bomber 52, Guardian 58, Bloom 53

**Thorns** (53% overall)

- Strong vs: Brawler 70 (Every hard bump hurts it back); Titan 64 (Its huge bumps hurt it back); Magnet 74 (It pulls the spikes into itself); Berserker 57 (Its raging bumps hurt it back)
- Weak vs: Archer 40 (Arrows never touch the spikes); Sniper 32 (The shot never touches the spikes); Boomerang 44 (The boomerang never touches the spikes); Venom 38 (Poison does the work, never the spikes)
- Even: Speedster 60, Vampire 49, Storm 48, Frost 62, Quake 51, Ghost 50, Necromancer 53, Chrono 55, Inferno 40, Bomber 54, Guardian 52, Bloom 63

**Venom** (48% overall)

- Strong vs: Chrono 79 (Poison ticks are too small to rewind); Thorns 62 (Poison does the work, never the spikes)
- Weak vs: Ghost 39 (It fades after each tick, so the poison misses); Guardian 6 (Armor blocks half of each poison tick); Bloom 45 (Regrows faster than the poison chips)
- Even: Brawler 50, Speedster 50, Vampire 51, Archer 51, Storm 49, Frost 52, Berserker 51, Sniper 49, Quake 54, Magnet 39, Necromancer 50, Titan 37, Inferno 55, Boomerang 45, Bomber 46

**Berserker** (52% overall)

- Strong vs: Bloom 46 (Raging hits outpace its regrowth); Guardian 58 (Raging hits go through the armor)
- Weak vs: Thorns 43 (Its raging bumps hurt it back)
- Even: Brawler 47, Speedster 55, Vampire 42, Archer 56, Storm 54, Frost 55, Venom 49, Sniper 47, Quake 55, Magnet 57, Ghost 65, Necromancer 52, Chrono 54, Titan 51, Inferno 54, Boomerang 49, Bomber 54

**Sniper** (50% overall)

- Strong vs: Thorns 68 (The shot never touches the spikes); Titan 63 (A huge target: the heavy shot never misses); Bloom 58 (Heavy shots outpace its regrowth)
- Weak vs: Speedster 35 (Too fast to aim at, and it closes in); Chrono 19 (Rewinds every heavy shot); Necromancer 42 (Skeletons draw the heavy shot); Magnet 44 (Pulls the shooter into a brawl)
- Even: Brawler 55, Vampire 50, Archer 49, Storm 50, Frost 53, Venom 51, Berserker 53, Quake 56, Ghost 52, Inferno 50, Boomerang 48, Bomber 54, Guardian 56

**Quake** (46% overall)

- Strong vs: Necromancer 60 (Every shockwave clears the skeletons); Magnet 38 (Pulls itself into the shockwaves)
- Weak vs: Frost 40 (The cold slows it, so it hits fewer walls)
- Even: Brawler 45, Speedster 55, Vampire 41, Archer 45, Storm 43, Thorns 49, Venom 46, Berserker 45, Sniper 44, Ghost 32, Chrono 54, Titan 41, Inferno 50, Boomerang 47, Bomber 51, Guardian 48, Bloom 48

**Magnet** (52% overall)

- Strong vs: Archer 66 (Pulls the frail shooter into a brawl); Sniper 56 (Pulls the shooter into a brawl); Storm 62 (Pulls the caller into a brawl)
- Weak vs: Frost 50 (The cold slows it, so it pulls itself in slowly); Thorns 26 (It pulls the spikes into itself); Quake 62 (Pulls itself into the shockwaves)
- Even: Brawler 36, Speedster 61, Vampire 41, Venom 61, Berserker 43, Ghost 49, Necromancer 59, Chrono 44, Titan 46, Inferno 50, Boomerang 53, Bomber 56, Guardian 53, Bloom 67

**Ghost** (49% overall)

- Strong vs: Venom 61 (It fades after each tick, so the poison misses); Inferno 84 (It fades after each burn, so the fire misses)
- Weak vs: Vampire 30, Bloom 30 (reasons rejected by decision 4: find the real one or change the matchup in group 2)
- Even: Brawler 39, Speedster 32, Archer 48, Storm 51, Frost 32, Thorns 50, Berserker 35, Sniper 48, Quake 68, Magnet 51, Necromancer 56, Chrono 44, Titan 45, Boomerang 77, Bomber 52, Guardian 42

**Necromancer** (48% overall)

- Strong vs: Archer 68 (Skeletons draw the arrows); Sniper 58 (Skeletons draw the heavy shot); Boomerang 66 (Skeletons draw the boomerang)
- Weak vs: Quake 40 (Every shockwave clears the skeletons); Inferno 36 (The fire clears the skeletons); Bomber 54 (Every blast clears the skeletons)
- Even: Brawler 44, Speedster 52, Vampire 42, Storm 44, Frost 48, Thorns 47, Venom 50, Berserker 48, Magnet 41, Ghost 44, Chrono 28, Titan 44, Guardian 50, Bloom 50

**Chrono** (50% overall)

- Strong vs: Sniper 81 (Rewinds every heavy shot); Storm 77 (Rewinds every big strike); Bomber 74 (Rewinds every big blast)
- Weak vs: Venom 21 (Poison ticks are too small to rewind); Inferno 32 (Burns are too small to rewind); Archer 38 (Arrows are too small to rewind)
- Even: Brawler 44, Speedster 58, Vampire 39, Frost 47, Thorns 45, Berserker 46, Quake 46, Magnet 55, Ghost 56, Necromancer 72, Titan 48, Boomerang 36, Guardian 47, Bloom 41

**Titan** (52% overall)

- Strong vs: Archer 66 (Grows too big for the frail Archer to avoid); Boomerang 58 (Grows too big for the frail thrower to avoid)
- Weak vs: Thorns 36 (Its huge bumps hurt it back); Sniper 37 (A huge target: the heavy shot never misses); Storm 43 (Too big to leave the warning circle)
- Even: Brawler 53, Speedster 58, Vampire 41, Frost 43, Venom 63, Berserker 49, Quake 59, Magnet 54, Ghost 55, Necromancer 56, Chrono 52, Inferno 35, Bomber 57, Guardian 59, Bloom 64

**Inferno** (49% overall)

- Strong vs: Chrono 68 (Burns are too small to rewind); Necromancer 64 (The fire clears the skeletons)
- Weak vs: Ghost 16 (It fades after each burn, so the fire misses); Guardian 27 (Armor blocks part of each burn)
- Even: Brawler 51, Speedster 38, Vampire 53, Archer 48, Storm 45, Frost 57, Thorns 60, Venom 45, Berserker 46, Sniper 50, Quake 50, Magnet 50, Titan 65, Boomerang 43, Bomber 48, Bloom 46

**Boomerang** (49% overall)

- Strong vs: Thorns 56 (The boomerang never touches the spikes); Vampire 60 (It cannot drink from a shooter)
- Weak vs: Speedster 26 (Too fast for the boomerang either way); Titan 42 (Grows too big for the frail thrower to avoid); Necromancer 34 (Skeletons draw the boomerang)
- Even: Brawler 54, Archer 54, Storm 45, Frost 59, Venom 55, Berserker 51, Sniper 52, Quake 53, Magnet 47, Ghost 23, Chrono 64, Inferno 57, Bomber 54, Guardian 31, Bloom 52

**Bomber** (47% overall)

- Strong vs: Necromancer 46 (Every blast clears the skeletons); Speedster 61 (Runs over more bombs than anyone)
- Weak vs: Chrono 26 (Rewinds every big blast)
- Even: Brawler 47, Vampire 48, Archer 48, Storm 49, Frost 48, Thorns 46, Venom 54, Berserker 46, Sniper 46, Quake 49, Magnet 44, Ghost 48, Titan 43, Inferno 52, Boomerang 46, Guardian 48, Bloom 48

**Guardian** (52% overall)

- Strong vs: Venom 94 (Armor blocks half of each poison tick); Inferno 73 (Armor blocks part of each burn)
- Weak vs: Vampire 40 (Drinks faster than the armor slows it); Bloom 35 (Regrows faster than the armored ball hurts); Berserker 42 (Raging hits go through the armor)
- Even: Brawler 39, Speedster 58, Archer 54, Storm 52, Frost 42, Thorns 48, Sniper 44, Quake 52, Magnet 47, Ghost 58, Necromancer 50, Chrono 53, Titan 41, Boomerang 69, Bomber 52

**Bloom** (48% overall)

- Strong vs: Venom 55 (Regrows faster than the poison chips); Ghost 70 (Regrows while the Ghost fades); Guardian 65 (Regrows faster than the armored ball hurts)
- Weak vs: Sniper 42 (Heavy shots outpace its regrowth); Storm 45 (Big strikes outpace its regrowth); Berserker 54 (Raging hits outpace its regrowth)
- Even: Brawler 40, Speedster 41, Vampire 40, Archer 40, Frost 47, Thorns 37, Quake 52, Magnet 33, Necromancer 50, Chrono 59, Titan 36, Inferno 54, Boomerang 48, Bomber 52

### The grid

Row against column: the row ball's measured win rate. ▲ the row ball is meant to be favoured, ▼ meant
to be unfavoured, no mark meant to be even.

|         | Bra | Spd | Vam | Arc | Sto | Fro | Tho | Ven | Bsk | Sni | Qua | Mag | Gho | Nec | Chr | Tit | Inf | Boo | Bom | Gua | Blo |
| ------- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| **Bra** |   · |  52 |  55 |  47 |  49 |  53 | ▼30 |  50 |  53 |  45 |  55 |  64 |  61 |  56 |  56 |  47 |  49 |  46 |  53 |  61 |  60 |
| **Spd** |  48 |   · |  48 | ▲70 |  56 | ▼39 |  40 |  50 |  45 | ▲65 |  45 |  39 |  68 |  48 |  42 |  42 |  62 | ▲74 | ▼39 |  42 |  59 |
| **Vam** |  45 |  52 |   · | ▼41 |  46 |  50 |  51 |  49 |  58 |  50 |  59 |  59 | ▲70 |  58 |  61 |  59 |  46 | ▼40 |  52 | ▲60 |  60 |
| **Arc** |  53 | ▼30 | ▲59 |   · |  50 | ▲52 | ▲60 |  49 |  44 |  51 |  55 | ▼34 |  52 | ▼32 | ▲62 | ▼34 |  52 |  46 |  52 |  46 |  60 |
| **Sto** |  51 |  44 |  54 |  50 |   · | ▲55 |  52 |  51 |  46 |  50 |  57 | ▼38 |  49 |  56 | ▼23 | ▲57 |  55 |  55 |  51 |  48 | ▲55 |
| **Fro** |  47 | ▲61 |  50 | ▼48 | ▼45 |   · |  38 |  48 |  45 |  47 | ▲60 | ▲50 |  68 |  52 |  53 |  57 |  43 |  41 |  52 |  58 |  53 |
| **Tho** | ▲70 |  60 |  49 | ▼40 |  48 |  62 |   · | ▼38 | ▲57 | ▼32 |  51 | ▲74 |  50 |  53 |  55 | ▲64 |  40 | ▼44 |  54 |  52 |  63 |
| **Ven** |  50 |  50 |  51 |  51 |  49 |  52 | ▲62 |   · |  51 |  49 |  54 |  39 | ▼39 |  50 | ▲79 |  37 |  55 |  45 |  46 |  ▼6 | ▼45 |
| **Bsk** |  47 |  55 |  42 |  56 |  54 |  55 | ▼43 |  49 |   · |  47 |  55 |  57 |  65 |  52 |  54 |  51 |  54 |  49 |  54 | ▲58 | ▲46 |
| **Sni** |  55 | ▼35 |  50 |  49 |  50 |  53 | ▲68 |  51 |  53 |   · |  56 | ▼44 |  52 | ▼42 | ▼19 | ▲63 |  50 |  48 |  54 |  56 | ▲58 |
| **Qua** |  45 |  55 |  41 |  45 |  43 | ▼40 |  49 |  46 |  45 |  44 |   · | ▲38 |  32 | ▲60 |  54 |  41 |  50 |  47 |  51 |  48 |  48 |
| **Mag** |  36 |  61 |  41 | ▲66 | ▲62 | ▼50 | ▼26 |  61 |  43 | ▲56 | ▼62 |   · |  49 |  59 |  44 |  46 |  50 |  53 |  56 |  53 |  67 |
| **Gho** |  39 |  32 | ▼30 |  48 |  51 |  32 |  50 | ▲61 |  35 |  48 |  68 |  51 |   · |  56 |  44 |  45 | ▲84 |  77 |  52 |  42 | ▼30 |
| **Nec** |  44 |  52 |  42 | ▲68 |  44 |  48 |  47 |  50 |  48 | ▲58 | ▼40 |  41 |  44 |   · |  28 |  44 | ▼36 | ▲66 | ▼54 |  50 |  50 |
| **Chr** |  44 |  58 |  39 | ▼38 | ▲77 |  47 |  45 | ▼21 |  46 | ▲81 |  46 |  55 |  56 |  72 |   · |  48 | ▼32 |  36 | ▲74 |  47 |  41 |
| **Tit** |  53 |  58 |  41 | ▲66 | ▼43 |  43 | ▼36 |  63 |  49 | ▼37 |  59 |  54 |  55 |  56 |  52 |   · |  35 | ▲58 |  57 |  59 |  64 |
| **Inf** |  51 |  38 |  53 |  48 |  45 |  57 |  60 |  45 |  46 |  50 |  50 |  50 | ▼16 | ▲64 | ▲68 |  65 |   · |  43 |  48 | ▼27 |  46 |
| **Boo** |  54 | ▼26 | ▲60 |  54 |  45 |  59 | ▲56 |  55 |  51 |  52 |  53 |  47 |  23 | ▼34 |  64 | ▼42 |  57 |   · |  54 |  31 |  52 |
| **Bom** |  47 | ▲61 |  48 |  48 |  49 |  48 |  46 |  54 |  46 |  46 |  49 |  44 |  48 | ▲46 | ▼26 |  43 |  52 |  46 |   · |  48 |  48 |
| **Gua** |  39 |  58 | ▼40 |  54 |  52 |  42 |  48 | ▲94 | ▼42 |  44 |  52 |  47 |  58 |  50 |  53 |  41 | ▲73 |  69 |  52 |   · | ▼35 |
| **Blo** |  40 |  41 |  40 |  40 | ▼45 |  47 |  37 | ▲55 | ▼54 | ▼42 |  52 |  33 | ▲70 |  50 |  59 |  36 |  54 |  48 |  52 | ▲65 |   · |

## 3. Feasibility (prototype, 100 seeds per slot order)

| Target               | Needed                    | Ruleset 7 (phase-2 doc, 500 seeds) | Prototype                                           |
| -------------------- | ------------------------- | ---------------------------------- | --------------------------------------------------- |
| Favoured pairs       | 72-78, fail <66 or >80    | mean 62.1                          | mean 63; 5 of 52 in 72-78; 36 fail (33 low, 3 high) |
| Even pairs           | 45-55, fail outside 42-58 | 66 fail                            | 94 of 158 in 45-55; 37 fail                         |
| No side under 20%    |                           | 28.6                               | 6 (Guardian vs Venom, 94)                           |
| Each ball 45-55%     |                           | 46.0-52.6                          | **46-53, passes**                                   |
| Shapes within 1      |                           | 9 balls off                        | **passes** by the map                               |
| Median fight 15-22 s |                           | 18.1                               | **18.1**                                            |
| Draws under 5%       |                           | 0.6                                | **0.6**                                             |
| Comebacks 10-20%     |                           | 14.7                               | **15.3**                                            |

What the numbers say:

- **Hit-kind abilities are sharp and selective.** Armor vs poison 94, fading vs fire 84, rewind vs the
  Sniper 81, the Storm 77 and the Bomber 74, poison vs rewind 79, spikes vs the Magnet 74. They move
  only the pairs of their kind, and they start _above_ the band, so they tune down rather than up.
  Counter pass 2 found the same with pair rules; here there are none.
- **Movement counters are real but soft:** fast vs shooters 65-74, cold vs fast 61, skeletons vs aim
  58-68, giant vs shooters 58-66. Random bounces average them out over an 18 s fight.
- **Four guesses are wrong in this sim** and need a different ability or a different map entry: Quake
  over Magnet (38), Berserker over Bloom (46), Bomber over Necromancer (46), Frost over Magnet (50).
  Also soft: the Frost as a target (Archer 52, Storm 55) and Bloom over Venom (55).
- **Even pairs mostly hold:** 94 of 158 in 45-55 with no per-pair tuning. The worst: Speedster and
  Frost vs Ghost (32 each), Venom vs Titan (37), Thorns vs Frost (38), Brawler vs Magnet (64).
- Only each ball's overall rate was tuned (health and bump damage, five rounds). No ability strength
  was tuned to the map yet.

Hardest pairs: the four wrong guesses, then Archer > Frost, Storm > Frost, Storm > Bloom,
Bloom > Venom, Magnet > Sniper and Boomerang > Thorns (52-56), and the three too sharp
(Guardian > Venom 94, Ghost > Inferno 84, Chrono > Sniper 81).

## 4. Removed cross-ball rules

| Rule today                                                    | What replaces it                                                                                                                                                                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shock halves heals (Storm vs Vampire and Bloom)               | The Storm has no shock. Healers lose to what anyone can see: big hits outpace regrowth (Sniper, Storm, Berserker over Bloom) and lifesteal can't drink from a shooter (Archer, Boomerang over Vampire).   |
| Stagger stops aim (Quake vs Archer, Storm, Sniper, Boomerang) | The Quake's shockwave only hurts. Shooters lose to the fast Speedster, the Magnet's pull and the Necromancer's skeletons (aimed attacks go for the nearest enemy thing, already the rule for every ball). |
| Poison numbs rage (Venom vs Berserker)                        | Gone. Venom's edges are now its kind of damage: poison ticks are too small to rewind (Chrono) and never touch the spikes (Thorns).                                                                        |

Left unused by the redesign, to delete when it ships: the `shocked` and `staggered` statuses, timed
phasing (only the old Ghost used it), the `shielded` status and `SHIELD_SOAK` (the Guardian's armor
replaces it), the three rule cues and their words.

New in the sim: one optional, universal definition query, `incomingDamageOf(self, amount)` ("what a
hit does to me"), used by armor and fading on both damage paths (`combat.ts` and the `damage` action).
No ball in ruleset 7 declares it, so today's game plays bit for bit the same (the sim tests pass).

## 5. Build order

One pull request per group, each with its ruleset bump, golden results, counter-map entries, words and
tests. Until the last group the existing gate stays (ADR 0028: favoured floor 58, even 42-58), so each
group can merge alone; the new bands switch on with group 4.

1. **Rules out (7): Storm, Quake, Berserker, Vampire, Archer, Sniper, Boomerang.** Shipped as
   ruleset 8 (ADR 0045, which records the numbers and what is left for later groups). Every ball that
   applies, suffers or names one of the three rules, so the rules, their statuses, cues, words and
   `rule-text` tests go in one change. It also takes away the old edges of two broad winners (Storm,
   Vampire) and trims the third (Archer).
2. **Hit-kind defenders (5): Chrono, Guardian, Ghost, Bloom, Venom.** The new kind abilities and
   `incomingDamageOf`; they key on the same split (chip vs big hits), so they are tuned together. Fixes
   the broad losers Venom and Chrono and removes the shield.
3. **Chip and hazards (5): Necromancer, Inferno, Bomber, Frost, Thorns.** Mostly numbers and map
   entries; the wrong guesses Bomber over Necromancer and Frost over Magnet are fixed or replaced here.
4. **The rest and the new bands (4): Brawler, Speedster, Magnet, Titan.** Stat tuning, the Quake over
   Magnet replacement, a whole-map pass at 500 seeds per order and the new bands in
   `scripts/counter-map.ts`. (Four balls: the whole-map pass is the size of the other three.)

## 6. What I think is unreachable, and the honest alternative

- **72-78 on every favoured pair is not reachable with movement counters.** Speed, range, size and cold
  top out around 60-70 in the prototype while overall rates stay fair. That matches counter pass 2:
  continuous levers stretch a whole row. Only hit-kind counters reach 75 without dragging their even
  neighbours along. Two honest options:
  - **(a) Every favoured pair from a hit kind,** 2 strong and 2 weak per ball (about 42 pairs), and
    movement edges called even. Clean 75s, a flatter map, and movement becomes flavour.
  - **(b) Two bands:** hit-kind counters 72-78, movement counters 62-72. More counters, honest about
    which ones are sharp, and the bot can read the band. I'd pick (b): it keeps lessons players see
    ("fast beats shooters") in the map.
- **No side under 20%** fights how sharp kind counters naturally are (94). Reachable, by softening armor
  and fading, not for free.
- **All 158 even pairs in 45-55** is about ±7 points of noise at 100 seeds; it needs 500 seeds per
  order, and I'd expect 15-20% of even pairs to settle at 42-45 or 55-58.

## Reproduce

```bash
node scripts/redesign/measure.ts --seeds 100 --grid --set bloom.every=40,bloom.hp=58,berserker.rage=13,storm.damage=36,storm.cooldown=120,chrono.hp=66,chrono.bigHit=12,ghost.fade=30,ghost.hp=80,magnet.dmg=24,archer.hp=46,titan.hp=84,guardian.hp=74,vampire.hp=59,bomber.blast=12,bomber.every=150,bomber.blastRadius=100,quake.damage=11
```

`--roster today` plays ruleset 7 instead, and `--out run.json` keeps the rates. A run takes about 35 s
on 16 cores. I wrote a smaller script than counter pass 2's `scripts/tune/`, which tunes ruleset 7's
definitions through `tune.ts`: the redesign is a separate roster, so its switch is which roster to load.
