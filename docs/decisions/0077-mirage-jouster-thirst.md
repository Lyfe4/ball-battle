# 0077: The Mirage, the Jouster and the Vampire's Thirst (ruleset 23)

- Status: Accepted
- Date: 2026-11-21
- Amends: ADR 0076 (the Vampire's allowance over the limit is gone), ADR 0056 (the Speedster's
  identity rule), ADR 0072 (the Vampire's look adds its Thirst), ADR 0064 (five new sounds)
- Builds on: ADR 0071 and 0072 (a look shows its ability and where it's up to), ADR 0036
  (teaching in the arena), ADR 0010 and 0015 (counters from mechanics), ADR 0075 (the last batch)
- Proposal: `docs/experiments/new-balls-proposal-10.md` on `proto/new-balls-10` (never merged),
  its recommended set at the `final5` settings (500 seeds and CI's seeds 0-149), accepted by the
  owner as recommended

## Context

Under ADR 0076's hard limits, one ball was over: the Vampire lost to seven balls outright (it heals
only from its bumps, so every ball that hits without a touch beat it), allowed by name. Round 10
of new-ball prototypes measured eight ideas and recommended two new balls with one ability tweak
for the Vampire and two health numbers, measured together with all 28 balls.

## Decision

### 1. The balls (the `final5` settings, unchanged)

| Ball    | Colour                    | Health | Bump | Speed | Ability                                                                                                                                                                                                                                                                                                       |
| ------- | ------------------------- | -----: | ---: | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mirage  | rose haze `#fda4af`       |     76 | 23.5 |   770 | A copy hangs 170 away on one of eight sides (from 0.5 s in). Every aimed attack at the Mirage aims at the copy. A shot passing within 60 of it (plus the shot's radius), or a strike landing there, pops it; it comes back 230 ticks (3.8 s) later on a side picked at random. The copy has no body.          |
| Jouster | tournament gold `#a16207` |     66 |   11 |   770 | Every 150 ticks (from 1 s in) it turns straight at its nearest enemy and charges 1.5 times as fast for up to 60 ticks, ending on a hit. Any bump of its own lands 3 times as hard head-on (directness 0.85 or more, about 32° off dead on) and at 0.4 otherwise: a lance hit is at most 33, never a one-shot. |

One-liners: "Aimed shots go for the shimmering copy beside it." and "Its lance hits triple
head-on, but a glance only scratches." The owner's lines ("A shimmering copy hangs beside it: aimed
shots go for the copy." and "Its lance hits triple head-on, but barely scratches at a glance.")
wrapped to three lines at 375 px under the 12 px margin `manual-text.touch.browser.test.ts` keeps
(about 51 characters fit), so each was reworded keeping every idea. Each has a "How it works" written from its constants.

**The Vampire's Thirst.** Any hit that isn't a bump (a shot, a strike, a skull, poison, a wail)
makes it 35% faster for 1 s (60 ticks); a second refreshes it. 40% puts it over the Hex at 78.2%,
30% leaves it at 78.0%. Its description is now "Heals off its bumps; a hit from afar speeds it up." (the
longest wording with both ideas that fits two lines), and its "How it works" names the 35% and the second.

**Numbers:** the Necromancer 70 → 71 health (on CI's seeds it is 45.0% without it), the Brawler 66
→ 67 (the Necromancer's +1 alone takes it to 44.9%).

**Engine, one rule each, for any ball:**

- `decoyOf(self, size)`: where an aimed attack at this ball aims instead of its centre. The hook
  context's `aimPointOf` reads it, and `nearestTarget` takes it: which ball is nearest is still
  measured to the ball itself, so a copy never draws a shot meant for another ball (unlike the
  Necromancer's skull, a minion that draws shots by being nearer). The Archer, Storm, Sniper,
  Spartan and Boomerang aim through it.
- `bumpTimesOf(directness)`: how much harder its bump lands by how directly it hit, on top of the
  directness scaling. The whole lance is in the bump, never a `damage` action on hit (ADR 0015).
  A damage event's `times` records it (output only), so the arena and the sound can tell a
  head-on lance from a glance.

The prototype's other engine hooks (the Cowboy's and Fairy's statuses, round 9's area flag) are
not kept: no ball uses them. Before building, the ruleset-23 build and the prototype played the
same 1,740 fights (every new and changed ball against the roster, six seeds a slot order) to the
same tick and health, so the proposal's measurements are this build's.

### 2. The Vampire's allowance goes

`OVER_THE_LIMIT` is removed with its one entry: the Vampire is 3/4. Every ball is held to
`STRONG_LIMITS` alike.

### 3. Counters, measured (500 seeds, every pair labelled by the one rule)

| Ball    | Overall | Strong wins                              | Strong losses                                       | Edges                                                                 |
| ------- | ------: | ---------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| Mirage  |   47.7% | Boomerang 74.3, Archer 68.2              | Hex 66.7, Thorns 65.1                               | over the Spartan; under the Vampire, Bloom, Kraken, Venom             |
| Jouster |   52.5% | Kraken 74.7, Bloom 67.8, Vampire 67.3    | Slime 69.0, Quake 66.6, Thorns 65.1                 | over the Archer, Boomerang, Banshee, Brawler, Magnet; under the Venom |
| Vampire |   51.7% | Hex 77.2, Berserker 75.7, Speedster 65.3 | Storm 73.7, Spartan 73.3, Bomber 72.0, Jouster 67.3 | eleven over, four under                                               |

Every new pair (57) has an entry in `counter-map-mirage.ts` or `counter-map-jouster.ts` with its
level and a reason from the two mechanics; Mirage vs Jouster is even (51.3%). Fifteen existing
pairs changed level and were relabelled with true reasons: the Vampire's Thirst turns its strong
losses to the Archer, Banshee and Kraken into edges and to the Boomerang into even (each hit from
afar sends it in fast), and its even pairs with the Speedster (now a strong win), the Inferno and
the Venom (edges) its way, since their extra hits make it thirsty; the Ghost, even before, now has
the edge (its passes hit without a touch, so the Vampire still drinks nothing). The Necromancer's +1 makes its Storm, Ghost, Bloom and Slime pairs
even, its Sniper pair an edge its way, and the Magnet's strong win an edge; the Brawler's +1 makes
the Hex pair even.

**Thin spot, as measured:** the Mirage vs the Thorns is 65.1%, just strong (62.7% on CI's seeds,
inside CI's allowance; CI judges the map's label). If a later run moves it to an edge, the Mirage
is 2/1 and fails the floor; the first fix is making the Mirage a touch frailer against bumps. The
Jouster vs the Thorns is 65.1% too.

### 4. The roster (500 seeds, `pnpm balance`)

Every hard rule passes for all 30: every ball 45-55% (lowest the Speedster and Battery, 46.1%;
highest the Ghost, 53.0%), worst side 22.5% (the Hex against the thirsty Vampire), draws 0.5%, median fight
15.9 s, comebacks 19.3%, ±5% health moves a rate by at most 17.7 points (the Venom against the
Jouster: a warning, under the 20 that fails), every pair inside its band, no ball over 6 strong
wins or losses, both new balls 2+/2+. CI's 150-seed check passes (worst side 23.0%).

**Shape warnings, 6 → 11** (warnings only, ADR 0076): the Vampire (3/4) and Archer (4/4) are on
it; the Speedster 3/5, Thorns 5/3, Quake 3/1, Necromancer 2/1, Boomerang 2/5, Hex 5/3, Slime 2/0,
Banshee 1/3 and Kraken 2/5 are off it, with the Titan 1/1 and Spider 1/3 as before
(`docs/vision.md` names the mechanic behind each).

### 5. Identity rules

- **The Speedster is still the fastest ball, by a reworded rule** (amends ADR 0056): a single
  stack passes every other ball's cruising speed, and its five stacks (1,280) pass every burst
  that lasts a moment: the Jouster's charge (1,155) and the thirsty Vampire (1,013). The manual
  still names it fastest. Only balls whose ability speeds them up declare `topSpeed`: the
  Speedster, Vampire and Jouster.
- The Storm's strike stays the biggest single ability hit: the copy deals nothing, and the lance
  is a bump.
- The pass-through property holds with the charge's 1,155 (`balls.test.ts`).

### 6. Looks (the standard of ADR 0071 and 0072)

Each shows its ability and where it is up to, in fractions of r at every size (no detail
switches at a size, `state-looks.test.ts`, whose recorder now also records a design's outline and
parts over it), drawn by the same design in a fight and on its manual and picker icons, and moving
only as the sim's clock does:

- **Mirage: a mirage, no face** (after two reviews by the owner: a face and haze bands read as a
  confused face, then dark dunes over a pink sky read as a heavy landscape badge). A light, glassy
  ball with a thin white gloss: its rose is a warm hazy sky, low golden dunes sit on the horizon and
  two thin heat shimmers rise off them and fade; below the horizon is the fake oasis, a cool
  shimmering pool (pale blue) with two ripple lines and the dunes' faint reflection, on warm sand.
  The pool is where its copy is up to: clear while the copy shows, gone the moment it pops (dry
  sand) and fading back in until it returns. Its copy, on the court under the balls
  (`mirage-copy.ts`), is drawn by the same design, so it is plainly the same ball, see-through (62%)
  with a pale wobbling outline and no bar; it shimmers in over 0.3 s. A popped copy bursts into
  three rings of haze sweeping out one after another (`moments.ts`, read from consecutive worlds).
  Designs are told of reduced motion (`DesignView.still`): the heat then holds still. Its colour
  stays rose `#fda4af` (pale sand and cream bases measured too close to the Spider, Frost and
  Inferno); the sand and pool are inside it.
- **Jouster: a tournament knight** (the owner's review: a gold disc with a white wedge read as
  nothing). Its body is a shield quartered in its gold and a heraldic blue; on it stands a closed
  steel great helm, face on, with a narrow eye slit and a breathing cross, and a red feather plume
  curls up from its crown. None of the Spartan's parts: no crest, no profile, no bronze. Its
  tournament lance, white with red spiral stripes and a steel cone hand-guard, is drawn over the
  outline. Raised, it stands upright at the knight's right whichever way it heads; over the second
  before a charge it swings down until it is couched at its right side pointing dead ahead just
  past the edge, stays down through the charge and is raised when the charge ends. Only the lance
  turns with its heading; the knight stays upright. A gold streak trails a charge (`trails.ts`). A
  head-on hit (a damage event's `times` over 1) throws seven splinters round the point and pops a
  big ×3 over it, in the arena's one family, and holds the fight for a 90 ms beat (`impact.ts`,
  however little it dealt); a glancing hit only skids four small gold sparks off sideways
  (`lance-hits.ts`).
- **Vampire's Thirst:** while thirsty its cape flares (the lapels rise high, lined red) and a short
  red streak trails it, easing out over its last 0.2 s. (The fangs' "thirst" of ADR 0072, how much
  of a bump's heal it could keep, is unchanged.)

With reduced motion the Mirage's heat and its copy's outline hold still, the pop's rings stand
still and fade, the
splinters, sparks and ×3 fade where they start, and the streaks (a state, not a movement) draw the
same. The arena's one-time hints read "Copy!" (the first copy) and "Lance!" (the first charge).
Colours (OKLab distance to the nearest ball; contrast on the floor): the Mirage 0.106 from the
Inferno, 8.95:1; the Jouster 0.109 from the Quake, 3.44:1. The roster's closest pair stays the
Magnet and Spartan (0.039).

### 7. Sounds (ADR 0064)

Five new sounds in its style, in `voices/tricks.ts` (sines and soft triangles on C major
pentatonic, a saw only through a low-pass, all under a second): the Mirage's shimmer as its copy
appears (C6, E6 and G6 climbing, each a pair of sines beating, over a rising air swell) and its
glassy pop where the copy bursts (a tick, a sine plip and a D6 bell ping that rings off at once);
the Jouster's charge (three hoofbeats closing up under a short low-passed call), its splinter on a
head-on lance, in place of the bump (a heavy punch, four quick cracks and a hollow knock), and its
spark on a glance (a thin metallic scrape and two tiny pings, quieter than a bump). Each has a gate
rule; `ball-sounds.slow.test.ts` hears every one in real fights and no third ball's, and
`voices-distinct.browser.test.ts` keeps them apart (closest: the splinter 0.819 from the Spartan's
spear hit, under the 0.9 limit).

## Consequences

- Ruleset 23: golden results regenerated, frozen as `rulesets/r23/`; ruleset 22 links show the
  older-link notice, and open online series keep their frozen ruleset. No migration.
- 30 balls: the bots, Reveal, Showdown and online play read the roster and the map, as before; the
  matchup chart and the ball pages fit at 375 px and on a desktop.
- **Draw cost (ADR 0063).** Each drawn whole in Chromium with the CPU slowed 6×, a phone-sized
  canvas, raster included, the least of nine rounds, beside today's balls in the same run (this
  machine varies a lot run to run, so each is read against the others of its run): the thirsty
  Vampire about 710 µs and the Mirage about 880 (the Balloon 600, the Kraken 630-1,140),
  the Jouster about 940-1,290 and the Mirage's copy about 1,300 (the Titan grown 1,900-2,450), the
  charge streak under 250 and a ×3 hit about 500. The copy builds its wobbling outline once (the
  fill, its edge, then the design over it).
- Two new engine rules are general: any future ball can have a decoy or a bump that depends on its
  angle, with no interaction rule (ADR 0045).
