# Proposal: new looks for six balls (prototype, not for merging)

Branch `proto/ball-looks`. Looks only: no sim, ability, balance or ruleset change, golden results
unchanged (`src/golden` passes), no `RULESET_VERSION` bump. The render reads one more thing from
the world, how many of a ball's own projectiles are in the air (`DesignView.shotsOut`), and never
writes to it.

**Round 2 (after the owner's review):** the Berserker, Speedster, Thorns and Boomerang are approved
as they are. The Battery is now one smooth fill. The Titan's rings are dropped: it is now a stone
giant's face, in three variations to pick from (`?titan=brow|carved|boulder`, below).

Gallery on the deploy preview: `/ballgallery.html` (animated, old beside new, phone and desktop
size, the icon, a Free play link per ball) and `/ballgallery.html?strips` (every state at once,
old above new). The gallery and the `scripts/proto-*` files exist only on this branch.

## The six designs

| Ball      | New look, in one sentence                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titan     | A stone giant's face, one of three (below).                                                                                                                                                                                                                |
| Berserker | Three faint seams, one per hit of rage it can store (the sim's MAX_RAGE is 3): each hit it takes cracks one open, dark with a yellow glow; at 3 they meet in the middle, white-hot; the bump that lets it out closes them.                                 |
| Speedster | Its dart, wrapped at the back by a five-bar speed gauge: each wall bounce lights a bar, a bump empties them, the empty bars stay faint so it always reads as "3 of 5", and at 5 the dart's heart lights white. Five bars at every size.                    |
| Thorns    | Its spikes now break out of its edge, so its silhouette itself is the warning (the only spiky ball); it stores nothing, so the look never changes.                                                                                                         |
| Boomerang | It shows its boomerang only while it holds it: thrown, the ball keeps a faint empty shape until the catch, so you never see two boomerangs at once.                                                                                                        |
| Battery   | An empty battery outline lying across it from the start, filled smoothly with yellow in proportion to what it has stored (a third of each big strike, blast or burst, up to 40) and drained on its bump; no cells, since a hit stores a share, not a unit. |

### The Titan: three stone-giant faces (pick one)

The body already grows on screen, so the face says big and heavy. Each is drawn in the dark accent
on the Titan's green, reads at phone size, and is unlike the Spartan's helmet and the Ghost's and
Slime's faces. Try each in a fight: the gallery's Free play links add `&titan=brow|carved|boulder`;
the choice is kept for the browser tab (sessionStorage), so the manual and picker icons match.

- **A, Brow:** one heavy slab of brow dipping in a frown over small square eyes and a flat, set
  mouth; the only one that reacts to growth, its brow getting heavier as the Titan grows.
- **B, Carved:** a face cut in stone: two brow blocks slanting down to a glare, slit eyes, and a
  wide stone jaw gritting its teeth (the gaps between the teeth at full size only).
- **C, Boulder:** a chiselled rock with a lit face and a shaded face, one thick frowning ridge of
  brow, two small dark eyes and a grim, set mouth.

The switch is prototype-only (`src/app/titan-look.ts`, applied when the ball designs load); the
final build keeps the chosen face and drops the other two and the switch.

Why the Berserker was confusing: the old design drew **one crack at rage 0** and spread 3 rage
over 6 cracks (0, 1, 2, 3 rage showed 1, 3, 4, 6 cracks), and the bump that releases rage usually
stores one again at once (below), so it never went back to clean. Now one crack is exactly one
stored hit. The Speedster's old streaks were parallel lines 0.2 r apart behind the dart, too close to
count at a glance (the middle one runs into the dart, so 5 read as 4), and at phone size it drew one
streak for 1-2 stacks and two for 3-5.

Icons, the in-fight look and HUD: the picker and manual icons are drawn by the same design
(`drawBallIcon`), so they match by construction; none of the six has a HUD marker of its own.

## Screenshots (this folder)

- `<ball>-phone.png`, `<ball>-desktop.png`: every state, old above new, at a 390 px phone arena's
  scale and a 1280 px desktop arena's scale (the gallery's `?strips` view).
- `gallery-phone.png`, `gallery-desktop.png`: the animated gallery.
- `fight-*.png`: the new looks in real Free play fights (phone 390 x 664, desktop 1280 x 800, and
  the Berserker with reduced motion); `fight-titan-<face>-brawler-*.png` for each Titan face.

## Descriptions against the sim (wording only)

Speedster ("Wall bounces build speed and damage for its next hit"; how it works: a stack per wall
bounce up to 5, 10% faster each, 2 extra damage a stack on its next bump): matches. Two details the
text doesn't say: a corner bounce adds two stacks, and the extra damage is a separate ability hit,
so directness doesn't scale it and Thorns doesn't reflect it (unlike the Berserker's and Battery's
extra, which are part of the bump).

Berserker ("Every hit it takes builds rage; its next bump lets it out"):

1. **The bump that lets it out usually stores one again.** Hooks run in phases: the bump's
   `onHitBall` empties the rage, then `onDamageTaken` counts the hit it took back in the same bump.
   So after a trade it holds 1, not 0 (pinned by `berserker.test.ts`, "only the hit it takes back
   is stored again"). Suggested wording for how it works: "Its next bump lets it all out; the hit
   it takes back in that bump starts the next."
2. **Several hits in one tick store one rage.** Every `onDamageTaken` in a tick sees the same
   snapshot, so a poison tick and a bump landing together store 1, not 2. "Every hit" slightly
   overstates; rare enough to leave, or "every hit it takes (one a moment)".
3. **Damage dealt by another ball's `onDamageTaken` (Thorns' reflected spikes) never stores
   rage:** that damage fires no hooks, by design. "Of any kind" in how it works is not quite true
   for spikes. Suggested: "Every hit it takes, of any kind but reflected spikes, stores rage".

## Draw cost (ADR 0063)

Each ball drawn whole by `drawBall` (body, markings, outline) over every state of its gallery
timeline, best of 6 passes, Chromium, microseconds per ball per frame (`draw-cost.txt`):

| Ball      | Old (1x / 6x slower CPU) | New (1x / 6x)   |
| --------- | ------------------------ | --------------- |
| Titan A   | 3.3 / 34-36              | 4.1 / 45-47     |
| Titan B   | 3.1-3.3 / 31-35          | 4.3-4.5 / 46-48 |
| Titan C   | 2.8-3.1 / 28-31          | 4.3-4.5 / 43-46 |
| Berserker | 3.3 / 33                 | 4.2 / 42        |
| Speedster | 3.2 / 31                 | 3.7-4.0 / 36-41 |
| Thorns    | 4.5-5.0 / 46-50          | 8.0-9.5 / 85-94 |
| Boomerang | 2.3-2.5 / 25             | 2.7-2.8 / 27-28 |
| Battery   | 2.8-3.1 / 30             | 3.3 / 34        |

(Round 2 numbers for the Titan and Battery; the first round's tree rings cost 85 µs at 6x.) The
Thorns' spiky outline costs the most, about 0.05 ms more a frame at 6x; each Titan face about
0.012 ms more and the Battery 0.004 ms, against a frame whose median was 2.2 ms at 6x (ADR 0063). `frame-pacing.touch.browser.test.ts`
(p95 frame work under half a 60 Hz beat, and the trail on frames 26 ms or more apart) passes.

## Low Power Mode and reduced motion

- The Low Power trail (`motion-smear.ts`) is a band in the ball's colour along its path, drawn
  under the ball, independent of its design: unchanged, and its test passes.
- None of the new designs moves on its own: every change follows sim state (rage, stacks, stored
  charge, the Titan's radius, a boomerang in the air), so there is nothing for reduced motion to
  hold still. Checked in a fight with reduced motion (`fight-berserker-venom-phone-reduced.png`).

## Checks run

`pnpm typecheck`, ESLint and Prettier on every changed file, `pnpm test` (187 files, 1226
tests), and the whole browser suite in Chromium (54 files, 155 tests, golden results included),
then the built gallery and a `?titan=` fight under `pnpm preview`'s production headers (no
console errors). Fixed in round 2: designs now scale the alpha they are drawn at (a defeated or
phased ball stayed partly opaque), and the gallery's stylesheet uses the allowed desktop media
query (`layout-queries.test.ts` failed on it in the first push's CI). CI's WebKit phones job fails
on `press.touch.browser.test.ts` (a brightness read mid-transition); it fails the same way on main
after #113, so it is not this branch's. Not
run: Firefox and WebKit, `test:slow`, `balance` (nothing they measure changed).

## Other balls worth a later look (not changed)

- **Necromancer**: its hood never shows when its next skeleton comes (`nextSummonTick`).
- **Bomber**: the fuse spark flickers all the time; it could burn down towards the next drop
  (`nextDropTick`).
- **Quake**: static strata; nothing shows whether its next wall hit will shock (`readyTick`).
- **Spider**: static spider; it could show how many webs it has out (`webs`).
- **Vampire**: heals more on little health; the look shows a heal, not how hungry it is (health).

The rest (Archer, Storm, Sniper, Chrono, Bloom, Spartan, Slime, Ghost, Magnet, Hex) already show
their state; Brawler, Frost, Venom and Inferno keep no state of their own to show.

## To finish if adopted

Keep the chosen Titan face, drop the other two and `src/app/titan-look.ts` (and its import in
`ball-designs/index.ts`); an ADR for the six looks; the style guide's captions and states for these six
(`src/styleguide/sections*.ts` still describe streaks, cracks and a merged gauge); a wording change
for the Berserker's how it works if wanted. Drop `src/gallery`, `ballgallery.html`, its
`vite.config.ts` input, `scripts/proto-*` and this folder.
