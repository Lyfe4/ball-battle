# 0071: Six balls show their state: the Titan, Berserker, Speedster, Thorns, Boomerang and Battery

- Status: Accepted
- Date: 2026-11-19
- Amends: ADR 0034 (the Titan's look), ADR 0043 (the Boomerang's look), ADR 0045 (the Berserker's
  cracks and the Titan's visor), ADR 0056 (the Battery's cells)
- Builds on: ADR 0032 (Sticker Pop), ADR 0039 (the phone arena is the screen), ADR 0063 (smooth
  fights at any frame rate)

## Context

The rule for a ball's look: it shows its ability and where it's up to (stacks, rage, stored charge,
growth), clearly enough to follow mid-fight on a phone (390 × 664). The Slime, Spartan, Hex and
Chrono meet it. Six didn't:

- **Titan:** a helm with a visor and rivets said "armoured", not "grows and gets heavier".
- **Berserker:** its cracks appeared for no clear reason and it often ended covered in them. The
  design drew one crack at 0 rage and spread its 3 rage over 6 cracks (0-3 rage showed 1, 3, 4, 6),
  and the bump that spends rage usually stores one again at once (below), so it never went clean.
- **Speedster:** up to 5 stacks, but the streaks were 0.2 r apart behind its dart: on a desktop 5
  read as 4 (the middle one ran into the dart), and on a phone 1-2 stacks drew one streak and 3-5
  drew two.
- **Thorns, Boomerang, Battery** (a lighter touch): the Thorns' spikes sat inside a round ball; the
  Boomerang still drew its boomerang while it was in the air, so two showed; the Battery's four
  cells read as "one hit, one cell", but it stores a third of each big hit, in any amount.

Prototyped on a branch with a gallery (old beside new, every state, at phone and desktop size)
and reviewed three times by the owner on an iPhone.

## Decision

Looks only: no sim, ability, balance or ruleset change, golden results unchanged.

- **Titan: an ancient stone colossus.** Its face fills the ball: a massive brow of two rounded
  brow bones across the top third casts a band of shadow with small round eyes deep in it and a
  broad stone nose; a mouth is cut straight across a broad jaw with a cleft chin; the forehead is
  lit and one side shaded. The body already grows on screen, so the face says big and heavy, and
  the brow deepens as it grows.
- **The Titan never switches detail at a size.** It is the one ball whose size changes mid-fight,
  so a part that switched on at a size would jump as it grew. It ignores `simple`, draws every part
  at every size in fractions of r, and only its brow deepens, smoothly. `titan.test.ts` holds it to
  that across 41 sizes from start to full: the same parts in the same order, phone and desktop
  drawn alike, nothing moving more than 0.02 r between neighbouring sizes, and the brow deeper at
  full size.
- **Berserker: one crack is one stored hit.** Three faint seams, one per hit of rage it can hold
  (MAX_RAGE). Each hit it takes cracks one open, dark with a yellow glow; at three they meet in the
  middle, white-hot. The bump that spends it closes them, and the hit back in that bump opens one
  again, exactly as the sim has it.
- **Speedster: a five-bar gauge.** The dart, wrapped at the back by five bars, one per stack: each
  wall bounce lights one, a bump empties them, and the empty bars stay faint so it always reads
  as "3 of 5". Five bars at every size, long enough to count on a phone. At 5 the dart's heart
  lights white.
- **Thorns: the silhouette is the warning.** Its spikes break out of its edge (the body's outline,
  up to 11% of r out, inside an icon's padding), a dark spine in each. It stores nothing, so its
  look never changes.
- **Boomerang: only what it holds.** The bent bar while the boomerang is in hand; while it is in
  the air, only a faint shape until the catch. Designs can read how many of the ball's own
  projectiles are in the air (`DesignView.shotsOut`).
- **Battery: one smooth fill.** An empty battery outline across the ball from the start, filled
  with yellow in proportion to what it has stored (up to CAPACITY) and drained on its bump. No
  cells: a hit stores a share, not a unit.
- **Designs scale the alpha they are drawn at** (`alpha * …`, never an absolute value), so a
  defeated or phased ball stays see-through.

The manual and picker icons are drawn by the same designs (`drawBallIcon`), so they match the
fight. None of the six has a HUD marker of its own.

**Descriptions made true to the sim (wording only).** The Berserker's "how it works" now says hits
at the same moment store one rage (every `onDamageTaken` in a tick sees the same snapshot),
reflected spikes store none (damage from `onDamageTaken` actions fires no further hooks), and the
hit it takes back in its releasing bump starts the next (`onHitBall` empties the rage, then
`onDamageTaken` counts that hit; pinned by `berserker.test.ts`). The Speedster's says a corner adds
two stacks, and that its extra damage is a hit of its own that spikes never reflect; its
description says "next bump" rather than "next hit" (popping a minion doesn't spend its stacks).
Text only: no ruleset bump (ADR 0022).

## Tried and dropped

- **Titan as tree rings** (rings at fixed world sizes, so the body grew out past them): read as a
  target, and clashed with the Sniper's crosshair. Off-centre, wobbly log rings didn't fix that.
- **Titan as a small stone-giant face** (three variations: a heavy brow slab, carved brow blocks
  with gritted teeth, a lit boulder): read as small grumpy emoji in the middle of a ball, too much
  empty green; and their white details switched on at a size, a visible jump as it grew. Their
  best parts were kept: the brow getting heavier, the intensity, the lit and shaded stone.
- **Titan colossus variations "Lintel" (a flat brow and slit eyes) and "Glower" (a V brow and a
  tusked underbite, which read a little like a beard):** the owner chose "Weathered".
- **The Battery's four cells** (the second round lit them yellow, horizontal): one hit part-filling a
  cell felt wrong.
- **A Boomerang wind-up** (the bar turning back before each throw): read as a tick mark, and the
  throw comes the moment it is due anyway.

## Consequences

- **Draw cost (ADR 0063).** Each ball drawn whole by `drawBall` over its states, Chromium with the
  CPU slowed 6×, per ball per frame: the Titan about 90 µs (the helm was about 35; seven fills inside
  a clip to the ball), the Thorns about 90 (was about 48; its spiky outline is drawn twice, for the
  fill and the outline), the others within 10 µs of before. The worst adds about 0.05 ms to a frame
  whose median was 2.2 ms at 6× (about 2%); `frame-pacing.touch.browser.test.ts` (p95 frame work
  and the Low Power trail) passes.
- **Low Power Mode and reduced motion.** The trail on slow frames is a band in the ball's colour,
  independent of its design. None of the six moves on its own: every change follows sim state
  (rage, stacks, stored charge, the Titan's radius, a boomerang in the air), so reduced motion has
  nothing to hold still.
- **Balls worth a later look** (not changed): the Necromancer never shows when its next skeleton
  comes; the Bomber's spark flickers all the time rather than burning down to its next drop; the
  Quake doesn't show whether its next wall hit will shock; the Spider doesn't show how many webs it
  has out; the Vampire shows a heal but not how hungry it is.
