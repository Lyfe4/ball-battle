# 0091: The Hunter and the Tortoise (ruleset 24)

- Status: Accepted
- Date: 2026-11-27
- Amends: ADR 0015 (`contactDamageOf` reads the ball it hits), ADR 0064 (three new sounds)
- Builds on: ADR 0071 and 0072 (a look shows its ability and where it's up to), ADR 0036
  (teaching in the arena), ADR 0010 and 0015 (counters from mechanics), ADR 0043 (zones an enemy
  sets off), ADR 0045 (a defence on every hit), ADR 0075 (the `held` status), ADR 0076 (the shape
  as a warning), ADR 0077 (the last batch)
- Proposals: `proposals-balls-2/hunter.md` (setting B′) and `proposals-balls-2/screening.md`
  (Hunter + Tortoise, its recommended set), and `proposals-balls/PROPOSAL.md` (the Tortoise),
  never merged; accepted by the owner as recommended

## Context

Ruleset 23 left eleven balls off the strong-only shape (ADR 0076), and two balls with no room the
last batch kept hitting: the Frost (3/2, no room for a win; every candidate lost to its slow) and
the Speedster (3/5, a fifth strong loss; every candidate beat it). The Tortoise, the best of that
batch, fixed the Banshee and Necromancer gaps but broke the Frost. The Hunter was built to be
the Frost's predator, and the screening of seven more balls found Hunter + Tortoise the one set
that moved the roster toward the shape.

## Decision

### 1. The two balls

| Ball     | Colour               | Health | Bump | Speed | Ability                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | -------------------- | -----: | ---: | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hunter   | leather `#b07a4f`    |     66 | 24.5 |   760 | Its bump lands harder the slower the ball it hits was moving as it came in: 5.5 times harder for every share slower than 760, at most 2.2 times; 0.7 times softer for every share faster, never under 0.75. The Frost (720) takes 1.29x; a held, slowed, anchored or shield-raised ball 2.2x (up to 54); the Speedster with stacks or a charging Jouster 0.75x. From 2 s in, then every 6 s, it lays a snare where it is: it arms after 0.5 s and lasts 5 s; an enemy that runs into its trap (radius 32) is bitten for 2 and held (the `held` status, 15% speed), with every enemy within 52, for 0.5 s. A phased ball passes over it. |
| Tortoise | olive drab `#8a9a3b` |     68 |   21 |   740 | Every hit it takes, from any source, loses 3, but never more than half of it (`incomingDamageOf`): a 7 shockwave lands at 4, a poison tick of 5 at 3, a 42 strike at 39. An unblockable hit (the wail) skips it, as it skips every defence (ADR 0075). Its own bump is plain.                                                                                                                                                                                                                                                                                                                                                           |

One-liners: "Hits slow prey hardest; leaves snares that hold." and "Its shell takes 3 off every
hit: small hits land half." Each has a "How it works" written from its constants (the Tortoise's
reads the Quake's and Storm's own numbers). The arena's one-time hints read "Snare" (on its first
snare, `tipOn: 'zone'`) and "Shell" (on its first cut, `tipOn: 'self'`).

**Roster order.** The picker groups balls by how they fight, so each joins its neighbours rather
than the end: the Hunter after the Sniper (with the Archer and Sniper, the balls that pick their
target and punish it), the Tortoise after the Titan (the two slow, heavy, plain-bumping bodies).
The order is part of the ruleset (the bots pick from it), so it moves with this bump.

**Settings, and what was tried.**

- **The Hunter is the screening's setting B′** (bump 24.5, 66 health, a snare every 6 s that holds
  0.5 s), with the slow-prey slope raised from 5 to 5.5. The Frost pair was the thin one (66.7% at
  500 seeds, 65.3% on CI's seeds 0-149): at 5.5 it is 68.7% and 68.0%, inside the strong aim
  (68-75%), and nothing else crosses a line (the Thorns pair 50.9 → 54.2%, still even; the
  Tortoise 70.1 → 71.4%; the Speedster, Jouster, Spartan and Kraken pairs unmoved: they are fast,
  or at the cap). At 6 the Thorns pair reaches 56.5% (59.3% on CI's seeds), off its even aim.
- **The Tortoise is the screening's setting, unchanged** (shell 3, at most half, 68 health, speed
  740). The aim was the Speedster at five strong losses rather than six, keeping the Tortoise's
  Banshee and Necromancer fixes. Thirty-eight settings of its own rule were measured on its key
  pairs at 500 seeds (the cut 2-5, the share 0.25-0.6, health 60-72, speed 725-760). The Speedster
  and Necromancer pairs move together with health and speed (68 → 64 health: the Speedster 71.2 →
  63.0, the Necromancer 65.1 → 59.1); only the share separates them, at a rounding cliff (the
  skulls' 11 lands at 7 below a share of 0.364, while the Speedster's 2-10 stack bonuses and
  glancing bumps are cut less). The one setting under the line, a cut of 4 at most a third with 64
  health, puts the Speedster at 64.9% (a tenth under strong) and leaves the Tortoise 2/4, with two
  thin wins (the Necromancer 67.3, the Venom 65.9) and no Boomerang counter; a step either side
  breaks it (63 health loses the Venom win and fails the 2+ floor; a share of 0.37 puts the
  Speedster back at 71.4). Three numbers changed for a knife-edge, so the Tortoise ships as
  screened and **the Speedster stays at six strong losses**, the most allowed (section 3).

**Engine, one rule for any ball:** `contactDamageOf(self, stats, target)` now also gets what it
bumps, `BumpTarget`: the target's speed as it came in, before the bounce (`step` hands
`applyContactDamage` the balls from before `resolveCollisions`). Hitting harder is still only
`contactDamageOf` (ADR 0015); no other ball reads the target. With the Hunter out of the roster
every ruleset-23 golden match replays identically (the screening checked Chromium, Firefox and
WebKit). The snares are the Bomber's machinery (a zone with a swept `trigger`, ADR 0043) carrying
the Kraken's `held` status; the 2 bite exists because a zone's status lands only with its hit.

### 2. Counters, measured (500 seeds, every pair labelled by the one rule)

| Ball     | Overall | Strong wins                                                  | Strong losses                                     | Edges                                                                     |
| -------- | ------: | ------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------- |
| Hunter   |   47.1% | Spartan 71.5, Tortoise 71.4, Frost 68.7                      | Speedster 75.1, Jouster 69.1                      | under the Archer, Bomber, Hex, Spider, Battery, Slime, Banshee and Kraken |
| Tortoise |   48.4% | Venom 76.1, Speedster 71.2, Boomerang 71.1, Necromancer 65.1 | Hunter 71.4, Bloom 70.4, Banshee 68.2, Frost 67.2 | over the Quake and Inferno; under the Titan, Bomber and Kraken            |

Why, from the two mechanics (every pair has an entry with its level and a reason in
`counter-map-hunter.ts` or `counter-map-tortoise.ts`; the pair between them is in the first):

- **The Hunter's prey is whatever moves slowly:** the Frost (the slowest ball), the Spartan behind
  its raised shield, the slow Tortoise (3 off a 28-point bump is little). What hunts it is what
  moves fast: the Speedster's stacks and the Jouster's charge take its softest bump, and the lance
  hits it triple. Balls that hit from afar or are quick (the Battery, the Slime's halves) lean
  against it as edges; the Kraken's hold makes the Hunter the prey.
- **The Tortoise beats balls that win by many small hits** (the Venom's poison, the Boomerang's
  two-way throws, the Speedster's many bumps, the Necromancer's bites) and loses to what a shell
  can't touch or a slow plain bumper can't catch: the wail, the Frost's slow, the Bloom's regrowth
  and the Hunter.
- The Hunter's hoped-for Ghost and Balloon counters never came (46.2 and 45.3%, even) and were
  left as measured (ADR 0015): snares are a small part of its power, and the Balloon's float halves
  only the bite, never the hold (a rule just for it would be an interaction rule, ADR 0045).

No older pair changed level. Four of the Hunter prototype's reasons were untrue to the mechanics
and were rewritten: the Battery stores only strikes and blasts, never bumps; the Vampire heals off
its bumps, not bites; the Hex's curse never turns bumps back; the Mirage's copy draws only aimed
attacks, and the Hunter has none.

**Thin spots, as measured:** the Tortoise over the Necromancer is 65.1% (62.3% on CI's seeds,
inside CI's allowance, which judges the map's label): it is the Necromancer's fix, and the first
place a later change will show. The Venom pair (76.1%, 77.0% on CI's seeds) is the new pair
nearest the 78% limit. The Hunter's Frost pair now has margin (above).

### 3. The roster (500 seeds, `pnpm balance`, 32 balls)

Every hard rule passes: every ball 45-55% (lowest the Necromancer and Inferno, 46.0%; highest the
Bomber, 53.2%), worst side 22.5% (the Hex against the thirsty Vampire, as before), draws 0.6%,
median fight 16.1 s, comebacks 18.7%, ±5% health moves a rate by at most 17.7 points (the Venom
against the Jouster, as before: a warning), every pair inside its band, no ball over 6 strong wins
or losses, both new balls 2+/2+. CI's 150-seed check passes (`pnpm balance:ci`).

**Shape, 11 → 10 balls off it** (a warning, ADR 0076):

| Ball        | Ruleset 23 | Ruleset 24 | Why                                                                   |
| ----------- | ---------- | ---------- | --------------------------------------------------------------------- |
| Hunter      | -          | 3/2        | on it                                                                 |
| Tortoise    | -          | 4/4        | on it                                                                 |
| Necromancer | 2/1        | **2/2**    | fixed: the shell halves its bites                                     |
| Banshee     | 1/3        | **2/3**    | fixed: the wail is the one hit the shell can't touch                  |
| Frost       | 3/2        | 4/3        | on it still: a win (the Tortoise) and its predator (the Hunter)       |
| Spartan     | 2/2        | 2/3        | on it: its raised shield makes it slow prey                           |
| Jouster     | 3/3        | 4/3        | on it: its charge is too fast for the Hunter to hit hard              |
| Venom       | 3/2        | 3/3        | on it: poison is the purest small hit                                 |
| Bloom       | 4/5        | **5/5**    | newly off: its regrowth outlasts the slow Tortoise                    |
| Speedster   | 3/5        | 4/6        | off still: the Hunter is the win it needed, the Tortoise a sixth loss |
| Boomerang   | 2/5        | 2/6        | off still: a sixth loss, its two-way throws halved by the shell       |

Off it, as before: the Thorns 5/3, Quake 3/1, Titan 1/1, Hex 5/3, Spider 1/3, Slime 2/0 and
Kraken 2/5.

**The Speedster and the Boomerang are at the limit of six strong losses.** The next ball that
would beat either of them breaks a hard rule. Before such a ball ships, the Speedster needs a small
boost (or an ability tweak that takes one of its losses away), and the Boomerang likewise: no new
ball can take a loss away. Recorded in `docs/vision.md`.

### 4. Identity rules

- The Storm's strike stays the biggest single ability hit: the snare's bite is 2, the Hunter's
  bump on prey is contact damage, and the Thorns' reflection now counts the hardest of those
  (54 × 0.37).
- The Frost is still the slowest ball (the Tortoise's 740 is faster than its 720).
- The Tortoise is the only flat cut, its shell under a tenth of the strike (`tortoise.test.ts`); a
  snare's hold is at most half the Kraken's grip, the Hunter's plain bump is under the Jouster's
  lance, and it reads its prey, never itself (`hunter.test.ts`).
- The pass-through property holds: neither changes its own speed (`balls.test.ts`).

### 5. Looks (the standard of ADR 0071 and 0072)

The Tortoise shows its ability and where it is up to (the Hunter by owner's waiver shows it on the court), both in fractions of r at every size (no detail switches,
`hunt-shell-looks.test.ts`), drawn by the same design in a fight and on its manual and picker
icons, and moving only as the sim's clock or the shared glance does:

- **Hunter: a hunter under a wolf pelt** (after two reviews by the owner: a jaw trap for a face
  read as a monster's mouth, then an open face with a trap at its side as too cartoony). The
  wolf's head is worn as a hood down low over the ball: its two ears stand up past the edge (at
  most 12% of r), its slanted amber eyes and paler muzzle, down to a dark nose, sit on top, its
  upper fangs hang along the hood's rim over the hunter's brow, and ragged tufts of fur run down
  its sides. Under it the hunter's face is in shadow, only two eyes glinting out of the dark (pale gold with a white point, the brightest thing on the ball, brighter than the wolf's amber, so they read at 30 px), in
  the spirit of the Spartan's helmet hiding its face; its leather (the ball's colour) is the cloak
  round it and a scarf over the mouth. Our own shapes, upright, never turning. At phone size the
  ears and the two eyes carry it. The pelt is a warm brown-grey `#a8907e` (0.120 from the Quake,
  0.093 from the Chrono, 5.6:1 on the floor where the ears break the edge).
- **The Hunter shows no state on the ball: the owner waives ADR 0071 for it.** Its ability shows
  on the court: its snares lie on the floor as a steel jaw trap, set, in its colour, faint for the
  half second before they arm (`snares.ts`, `jaw-trap.ts`); a ball a snare holds has the trap
  clamped round it, snapping in over four ticks, for as long as the hold lasts (`drawSnared`; the
  Kraken's holds keep their tentacles). `hunt-shell-looks.test.ts` holds its look the same whatever
  its snare timer, and drawn alike at every size.
- **Tortoise: a tortoise from above.** A carapace of plates (a lighter hexagonal centre plate,
  seams out to its rim, a rim of shell below with seams across it) over a head with two eyes and
  four feet in its skin, which peek out past its edge while it moves (its own outline, at most 12%
  of r out). When its shell cuts a hit they duck in, and the ring of gold pieces every ball shows
  when a defence takes a hit (the Spartan's and the Balloon's, `glance-ring.ts`) flashes round it;
  they come back out as the glance fades, and stay in while a snare or tentacle holds it. No
  numbers pop up. Designs are told of the glance (`DesignView.glance`, read like the heal). Its
  colour moved from the prototype's olive `#65a30d` (0.057 from the Thorns, and beside the Venom's
  lime it read as the same ball in a fight) to olive drab `#8a9a3b`.

Colours (OKLab distance to the nearest ball; contrast on the floor): the Hunter 0.079 from the
Jouster, 4.63:1; the Tortoise 0.095 from the Thorns, 5.45:1. The roster's closest pair stays the
Magnet and Spartan (0.039). Reduced motion changes nothing: both looks follow state, not time.

### 6. Sounds (ADR 0064)

Three new sounds in its style (`voices/hunt-shell.ts`: sines and soft triangles on C major
pentatonic and filtered noise, all under a second): the Hunter's **snap** as a snare springs (a dry
steel click, the jaws clacking shut and a little spring ring; quieter on a snare that shuts on
nothing), its **thump** in place of the bump when its bump lands half again as hard or more (slow,
held or planted prey: a deep, heavy thump with a slap of leather, lower and longer than a bump),
and the Tortoise's **knock** beside each hit its shell cuts (a soft, hollow wooden knock). Each has
a gate rule; `ball-sounds.slow.test.ts` hears every one in real fights and no third ball's, and
`voices-distinct.browser.test.ts` keeps them apart in Chromium and Firefox. The first knock (a single A4 tap) was 0.910 from the Boomerang's return hit in Chromium, over the 0.9 limit, so it became a low double knock; the closest new sound is now the snap, 0.867 from the Boomerang's catch.

## Consequences

- Ruleset 24: golden results regenerated, frozen as `rulesets/r24/`; ruleset 23 links show the
  older-link notice, and open online series keep their frozen ruleset. No migration.
- 32 balls: the bots, Reveal, Showdown and online play read the roster and the map, as before; the
  bots' tests pass on the new roster unchanged (`SAME_FIGHTS_AS` stays empty, ADR 0073).
- The longest manual entry is now the Speedster's Weak vs (six strong counters and five edges): the
  desktop columns' cards sit 2 px apart with 4 px under them (from 4 and 5) so it still fits
  1280 x 800 (`desktop-layout.wide.browser.test.ts`). The phone keeps its spacing.
- `contactDamageOf` can read its target: a later ball may hit by what it hits, still in one place.
- **Draw cost (ADR 0063).** Each drawn whole by `drawBall` in Chromium with the CPU slowed 6×, a
  phone-sized canvas, raster included, the least of nine rounds, beside today's balls in the same
  run (read against each other): the Hunter about 2,040 µs (its hood, fangs and shadowed face) and the Tortoise about 1,900 (1,540
  ducked: most of it is its outline with the head and feet, drawn for the fill, the flash and the
  edge), against the Kraken and Jouster about 770 and the Balloon 355; both are inside the
  range ADR 0077 accepted for the grown Titan (1,900-2,450). A whole phone frame with a snare on the
  floor and a caught ball costs about 80 µs more than without.
- The Tortoise's mirror draws 5.0% of its fights and the Hunter's 4.0% (mirrors are outside the
  targets): two shells take half of each other's small hits, so some run to the time limit.

## Addendum (2026-11-28): a sprung snare snaps shut

A snare that springs drew the zones' default strike, the Storm's flash and lightning bolt, which
read as a strike from the sky. It now has its own strike look (`strike: 'snap'`,
`drawTrapSnap` in `src/render/snares.ts`): the Hunter's jaw trap snapping shut where it lay, a short
side-to-side shake, a puff of dust and splinters in the pelt's browns, all fading over the strike's
350 ms; with reduced motion the trap shuts and fades in place, the dust still. The style guide shows
it at four strengths, both ways. Render only: no fight changes.
