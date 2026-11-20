# 0075: The Balloon, the Banshee and the Kraken, and the Archer at 47 (ruleset 22)

- Status: Accepted
- Date: 2026-11-20
- Amends: ADR 0074 and 0073 (the shape exceptions), ADR 0045 (a defence may also raise a hit; a
  hit may be unblockable), ADR 0009 (a third status, `held`), ADR 0064 (eight new sounds)
- Builds on: ADR 0071 and 0072 (a look shows its ability and where it's up to), ADR 0036 (teaching
  in the arena), ADR 0010 and 0015 (counters from mechanics)
- Proposal: `docs/experiments/new-balls-proposal-8.md` on `proto/new-balls-8` (never merged), its
  recommended run (500 seeds) and its sketches, accepted by the owner as recommended

## Context

Ruleset 21 left ten balls off the strong-only shape (ADR 0074), each waiting for a new kind of hit.
Round 8 of new-ball prototypes measured six ideas against those gaps with a pair-only harness and
recommended three together, plus one number: the Archer at 47 health (from 48), which drops its
strong win over the Thorns to make room for the Balloon. Measured together at 500 seeds, ten balls
off the shape became six, and every hard rule passed.

## Decision

### 1. The three balls (the recommended 500-seed settings, unchanged)

| Ball    | Colour                  | Health | Bump | Speed | Ability                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ----------------------- | -----: | ---: | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Balloon | coral `#ff6b6b`         |     76 |   24 |   760 | Floats: area hits (a zone's strike or a lasting zone's pulse: fire, bombs, shockwaves, lightning) land at 55%; every shot lands 1.4 times as hard. It still sets bombs off.                                                                                                                                                                                                       |
| Banshee | mauve `#a0729f`         |     56 |    4 |   770 | Every 170 ticks (from 2 s in) it wails: 33 to every enemy ball within 320 of its centre, and nothing blocks it: no shield, phasing or floating takes any of it.                                                                                                                                                                                                                   |
| Kraken  | deep sea cyan `#0891b2` |     62 |   16 |   760 | From 1.5 s in, once it holds nothing, it marks a spot where each enemy will be in 0.5 s; then tentacles rise and hold every enemy within 90 of a spot (never a phased one) for 1.5 s, and crush once for 6 a tentacle: 2 for a standard ball or a Slime half, 4 for a grown Titan (by width). It anchors at 30% speed while it holds. Its next call is 200 ticks after the burst. |

One-liners: "Floats: area hits do half; shots hit it harder." (the owner's), "Every few seconds it
wails all around; nothing blocks it." and "Tentacles rise and crush its enemy; big balls get
more." The owner's lines for the Banshee and the Kraken wrapped to three lines at 375 px under the
12 px margin `manual-text.touch.browser.test.ts` keeps, so each was shortened, keeping every idea.
Each has a "How it works" written from its constants.

**Engine (one rule each, for any ball):**

- A defence may raise a hit (`incomingDamageOf` returns more than the hit; `defendHit` no longer
  caps it). Only a cut makes a `hitReduced` event; a raise is a damage event's `raised`. The
  Balloon's area cut is `hitReduced`, so it glances like a shield.
- A `damage` action may be `unblockable`: no defence takes or adds any of it. The Battery stores
  none of a wail, the phased Ghost and planted Spartan take it whole.
- A third status, `held` (ADR 0009): the held ball cruises at 15% of its speed (`HELD_SHARE`),
  after any slow. Refreshes, never stacks, like the others.

None of the prototype's other engine hooks (a head-on lance, a hurled ball, a bomb a ball floats
over) are kept: no ball uses them.

### 2. The Archer at 47 health (from 48)

Its strong win over the Thorns becomes an edge (64.5%), relabelled with its reason; it then beats
the Balloon and Banshee (5/3, named below).

### 3. Counters, measured (500 seeds, every pair labelled by the one rule)

| Ball    | Overall | Strong wins                                       | Strong losses                                     |
| ------- | ------: | ------------------------------------------------- | ------------------------------------------------- |
| Balloon |   49.6% | Inferno 75.3, Bomber 73.2, Storm 73.1, Quake 70.8 | Boomerang 74.0, Archer 71.4, Sniper 70.7          |
| Banshee |   49.0% | Ghost 69.0, Vampire 68.8                          | Chrono 71.0, Archer 66.5, Titan 65.0              |
| Kraken  |   52.1% | Titan 71.2, Spider 70.8, Vampire 70.1             | Storm 77.2, Sniper 72.7, Ghost 68.8, Spartan 66.3 |

Every new pair (78) has an entry in `counter-map-balloon.ts`, `-banshee.ts` or `-kraken.ts` with
its level and a reason from the two mechanics. Why each counter happens:

- **Balloon:** the balls that win through the court lose half their hit and have light bumps; the
  shooters' every hit lands harder from out of reach. The Hex's curse is a share of health and the
  Bloom regrows between its bumps (edges against it).
- **Banshee:** nothing blocks the wail, so the phased Ghost is hit through its fade, and the frail
  Vampire, which heals only from bumps, has nothing to drink. One big wail is just what the Chrono
  rewinds; shooters hit it from outside its ring; the grown Titan has the health to take the wails.
- **Kraken:** a held ball loses its ability (a held Vampire can't bump, so can't heal; an anchored
  Kraken never bounces into the Spider's webs), and a grown Titan takes four tentacles. Standing
  still to squeeze makes it a target for heavy aimed hits (the Storm, Sniper and Spartan, whose
  shield also halves the crush), and the phased Ghost slips the grab.

**The Storm over the Kraken (77.2%, 76.0% on CI's seeds 0-149)** is the roster's steepest pair, a
WARN under the 78% limit. CI's seeds are fixed, so it passes there every time; no tune was needed.
The Inferno under the Balloon (75.3%) is the other strong counter past the aim.

### 4. The roster (500 seeds, `pnpm balance`)

Every hard rule passes for all 28: every ball 45-55% (lowest the Brawler and Necromancer, 45.1%;
highest the Ghost, 53.2%), worst side 22.8%, draws 0.5%, median fight 15.9 s, comebacks 19.4%, ±5%
health moves a rate by at most 14.0 points, every pair inside its band, every ball's shape. CI's
150-seed check passes too.

**Shape: ten off became six.** The Sniper (3/2), Ghost (3/2), Inferno (2/2), Boomerang (3/4) and
Spartan (2/2) are on it; the Storm, Chrono, Thorns and Bomber stay on it. Named exceptions left
(`SHAPE_EXCEPTIONS`, each allowed exactly its gap):

- Titan 1/1: growing evens its fights out; only the Kraken's tentacles and the wail lean far.
- Quake 2/1: small, wide shockwaves chip every ball alike; only the floating Balloon shrugs them.
- Spider 1/3: webs slow every wall-bouncer a little; only the Speedster, living on walls, loses.
- Slime 1/0: its split outlasts one-at-a-time hitters; it beats only the Sniper, and none beat it.
- Vampire 2/7: it heals only from its bumps, so seven balls that hit without a touch beat it.
- Archer 5/3: arrows outrange every frail or slow ball; the Balloon and Banshee add two.

### 5. Identity rules

The Banshee's bump (4) is the roster's weakest: its hit is the wail. "The Archer has the lowest
contact damage" and "the Inferno's own hits are the second lightest" now count the balls that hit
by bumping (`identity.test.ts`). The Storm's strike stays the biggest single ability hit: the
wail is 33, a crush at most 24, and the hardest shot on a Balloon (the spear, 28 × 1.4) 39.

### 6. Looks (the standard of ADR 0071 and 0072)

Each shows its ability and where it is up to, in fractions of r at every size (no detail switches
at a size), drawn by the same design in a fight and on its manual and picker icons, and moving
only as the sim's clock does:

- **Balloon:** a glossy coral balloon with a white gloss and a tied knot standing just proud of its
  edge, and the only shadow on the floor (`BallDesign.floats`, `shadows.ts`). The light comes from
  one fixed side: the shadow trails a touch behind the way it drifts and stretches a little with
  speed, and the knot swings back behind it (`drift.ts`: its velocity followed over 140 ms of
  effect time, so a bounce swings it round rather than snapping it). An area hit glances (the gold
  ring of a cut); a shot pops into it (short white bursts where it struck, `poppedShots`,
  `drawPops`).
- **Banshee:** a wailing spirit, never a second Ghost: long mauve hair framing a pale face and
  streaming below it in locks that break the ball's edge (its own outline), hollow eyes slanting
  in sorrow. Her mouth follows the wail: a slit while she waits, opening as she draws breath (0.6
  s before), gaping on the wail, when her locks lift. The breath glows round her; the wail's ring
  sweeps out to its reach (320, so any ball the ring touches is hit) and fades (`wails.ts`).
- **Kraken:** a deep-sea predator: a dark mantle over its head, narrowed eyes glowing under heavy
  brows with slit pupils, a hooked beak among the roots of its arms, and a tentacle curling up
  each side, rising as its next call nears, stubs while they are out (like the Boomerang, only
  what it holds). Ripples spread on the floor at each spot out to the grab's reach; then 2-4 thick
  tentacles break through the floor out of dark holes round each ball held, coil over it, suckers
  inward, and tighten and swell to the crush, a line from the anchored Kraken's edge to the held
  ball's (`tentacles.ts`).

With reduced motion the ring appears at its reach and fades there, the ripples stand still, a pop
fades where it starts and the Balloon has no drift: its shadow sits still beside it and its knot
hangs straight. The arena's one-time hints read "Float!" (a cut), "Wail!" (its damage)
and "Tentacles!" (the `held` status). Colours (OKLab distance to the nearest ball; contrast on the
floor): the Balloon 0.079 from the Berserker, 6.1:1; the Banshee 0.105 from the Quake (0.205 from
the Ghost), 4.4:1; the Kraken 0.134 from the Quake, 4.6:1. The roster's closest pair stays the
Magnet and Spartan (0.039).

### 7. Sounds (ADR 0064)

Eight new sounds in its style (sines and soft triangles on C major pentatonic, a saw only through a
low-pass, all under a second): the Balloon's rubbery squeak in place of the bump (two voices
stretching up and back over a light hollow thump: it floats, so it never lands heavy), its
wobbling "bwoing" when an area hit glances and its pop when a shot lands harder (a snap, a deep
thoomp as the rubber gives, a ping and a rush of air); the Banshee's airy breath and its wail (two beating voices sliding up
and away); the Kraken's deep bubbles as it calls, a wet slap as the tentacles wrap and three quick
crunches as they crush. Each has a gate rule; `ball-sounds.slow.test.ts` hears every one in real
fights and no third ball's, and `voices-distinct.browser.test.ts` keeps them apart (the first crush
was 0.901 from the Battery's release, over the 0.9 limit; reworked).

## Consequences

- Ruleset 22: golden results regenerated, frozen as `rulesets/r22/`; ruleset 21 links show the
  older-link notice, and open online series keep their frozen ruleset. No migration.
- 28 balls: the bots, Reveal, Showdown and online play read the roster and the map, as before; the
  matchup chart and the ball pages fit at 375 px and on a desktop.
- **Draw cost (ADR 0063).** Each drawn whole in Chromium with the CPU slowed 6×, a phone-sized
  canvas, raster included, the least of nine rounds: the Balloon about 410 µs, the Banshee 860 and
  the Kraken 800, inside round 1's range (the Battery 318, the Titan 1,117). The wail's ring (655)
  and the ripples (750) cost about a Storm warning zone (633); four tentacles coiled round a grown
  Titan about 1,930 (two round a standard ball about half), each drawn as two fills (a dark edge
  under the body) rather than a stroked outline, which alone cost 2,000; the shadow 49. The
  Kraken's mantle is a lens path, not a clip.
- The two new engine rules are general: a future defence can raise a hit, and a future hit can be
  unblockable, with no interaction rule (ADR 0045).
