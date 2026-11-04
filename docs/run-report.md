# Run report: readability, counter density, best of 3

A three-stage unattended run (started 2026-11-05). Each stage was pushed to `main` only with every
local check passing and CI green on the previous push.

## State at the start

1. Eleven balls (Brawler, Speedster, Vampire, Archer, Storm, Frost, Thorns, Venom, Berserker,
   Sniper, Quake), each a data-driven definition with action-returning hooks, in a pure,
   deterministic, fixed 60 Hz sim (ADR 0001-0015).
2. `pnpm balance 500` passes every target: every ball 46.3-52.2% overall, worst side 31.3%,
   draws 0.6%, median 18.3 s, worst ±5% sensitivity 13.7 points; 12 counter-map pairs sit in
   `NEAR`.
3. Counter density is uneven: the Speedster is in 7 counter relationships, Thorns has 1 favoured
   and 4 unfavoured, and Venom, Berserker, Sniper and Quake have one of each; Archer, Storm and
   Frost have only one unfavoured.
4. The app is Quick match only: a two-slot picker, the HUD with Replay / New match, the matchup
   and seed in the URL, and battle feel on a presentation clock (ADR 0007). Rendering drew the
   latest tick, with no interpolation.
5. `docs/vision.md` plans best-of-3 against a bot as the next step; mirror-draw replay was decided
   there but not built. CI was green on `e66a625`.

## Stage 1: readability (presentation only)

### Plan

Measure refresh rate against the tick rate; interpolate everything that moves between the last
two ticks by the accumulator fraction; add a remembered 1× / 2× speed toggle that scales the whole
presentation clock; prove the tick sequence is unchanged at both speeds; judge honestly whether it
is comfortable to watch.

### Diagnosis

Measured in the app's own browser pane with `requestAnimationFrame` (600 frames): median frame
11.1 ms, so **about 90 Hz** (p10 11.0 ms, p90 16.7 ms). Feeding those real frame times through the
game's fixed-step accumulator, **164 of 600 frames (27%) ran no tick**. Before this stage those
frames were not even redrawn, so each tick stayed on screen for one frame or two in an irregular
pattern (`1011011011…`): judder.

The same accumulator at common refresh rates (computed with the game's tick tolerance):

| Display | Frames that repeat a position | Each tick is held for |
| ------- | ----------------------------- | --------------------- |
| 60 Hz   | 0%                            | 1 frame               |
| 75 Hz   | 20%                           | 1 or 2 frames         |
| 90 Hz   | 33%                           | 1 or 2 frames         |
| 120 Hz  | 50%                           | 2 frames (even)       |
| 144 Hz  | 58%                           | 2 or 3 frames         |
| 165 Hz  | 64%                           | 2 or 3 frames         |
| 240 Hz  | 75%                           | 4 frames (even)       |

So on 75, 90, 144 and 165 Hz displays the motion stuttered unevenly (a ball at ~780 units/s moves
13 world units per tick, a visible hop when held for an uneven number of frames). On 120 and 240
Hz it was even but showed only 60 distinct positions a second. ADR 0001 had predicted this.

### What was built

- `src/render/interpolate.ts`: `interpolateWorld(previous, current, alpha)` returns a world for
  drawing with ball and projectile positions blended. Everything else (health, statuses, zones,
  tick) is the current world's, so the picture is never ahead of the sim. A projectile fired this
  tick is traced back along its velocity to its launch point; one that ended this tick is not
  drawn (its hit shows as a spark). The Sniper's laser is drawn from the blended ball, so it moves
  smoothly too. Zones don't move.
- `Playback.previous` and `interpolationAlpha(playback)` in `src/app/playback.ts`: the world before
  the latest tick, and the banked share of the next tick, clamped to 0-1. A finished match draws
  its final world (alpha 1). During a hit-stop the bank can exceed a tick, which clamps to the
  tick just played, so the freeze shows the actual hit.
- Match start, Replay and New match all go through `startPlayback`, which sets `previous` to the
  starting world, so a new match never smears from the old one.
- The frame loop now redraws every frame while a match runs (balls move between ticks).
- `src/app/speed.ts` and `src/ui/speed-toggle.ts`: a **Speed 1× / 2×** toggle under the HUD, a
  labelled group of two `aria-pressed` buttons with 44 px tap targets. At 2× each frame's real
  time is doubled before it reaches the presentation clock, so ticks, the intro, hit-stops,
  slow-mo and every effect run twice as fast together. The choice is remembered in
  `localStorage` (`ballbattle.speed`); reading and writing are wrapped in try/catch and any
  failure or unknown value means 1×.

Measured after the change, same pane: **4 of 300 frames** were identical to the previous one (the
hit-stops), against 27% of frames that ran no tick before.

### Tests

- `interpolate.test.ts`: blend at 0, 1 and between; only positions change; alpha clamps; a new
  match returns the world itself; new and removed projectiles; every blended ball stays inside the
  arena over a whole Speedster vs Archer match.
- `playback.test.ts`: the existing "plays exactly like a headless run despite irregular frames,
  hit-stops and slow-mo" test now also runs three matchups at 2× (through the real `scaleFrame`),
  so **results and replays are identical at either speed**; 2× runs twice the ticks for the same
  real time; `previous` tracking; alpha clamping and the finished-match case.
- `speed.test.ts`: parsing, remembering, a throwing `localStorage` getter or method, a tampered
  value. The 2× tests were shown to fail with `scaleFrame` disabled.
- `src/sim` is untouched, and `pnpm balance 500` output is **byte-identical** to the run before
  the stage (`cmp`).

### Is it comfortable to watch?

Better, not yet comfortable, honestly. Interpolation removes the uneven hops, which was the
strain that came from the renderer. What remains is the speed itself: balls cross the 1000-unit
arena in about 1.3 s, two of them bounce off walls several times a second, and a hit lands every
second or so. On a phone-sized arena that is a lot of fast movement to track. 2× is for viewers
who already know the balls; it does not help with tracking.

Two proposals, **not built** (the brief asked for proposals only):

1. **A very subtle motion trail.** Two or three ghost discs at the ball's positions 1-3 ticks
   back (they are in `previous` and could be kept in a small render-side ring buffer), at 10-20%
   opacity, off under `prefers-reduced-motion`. It tells the eye where a ball came from, so a
   bounce is easier to follow. Trade-offs: more overdraw per ball, and it can look like a smear
   at 2×; it must not hide the zone warnings drawn under the balls.
2. **"Slower balls, harder hits" retune.** Scale every cruise speed by about 0.75 (Speedster 800 →
   600, Frost 720 → 540) and raise contact and ability damage so median match length stays near
   18 s. Fewer contacts per second at the same match length means each hit matters more and
   reads better. Trade-offs: it is a sim and balance change, so every seed replays differently and
   every counter must be re-measured; speed-dependent counters change shape (the Speedster
   outrunning the Storm and the Sniper, the Quake's short warning, the Frost's slow); the
   Archer's and Sniper's projectile speeds and every warning time would need re-tuning together;
   fewer, larger hits make the ±5% sensitivity steeper (ADR 0004). Worth a dedicated stage with
   its own ADR, not a tweak.

### Decisions made on your behalf

- **The toggle sits under the HUD status, always visible** (not inside the result panel), so it can
  be changed mid-match. Alternative: a settings menu, which this app doesn't have yet.
- **The speed is per viewer, not in the URL.** A shared link replays the same match at the
  viewer's own speed. Alternative: `?speed=2` in the link.
- **The HUD health ghost stays on real time** (a CSS transition, ADR 0007 addendum), so at 2× it
  trails slightly behind the canvas bars. Minor; left as is.
- **A projectile that ended this tick is dropped from the blended picture** rather than drawn on
  to its hit point for the remaining fraction of a tick. The spark marks the hit.

### Questions for you

- Do you want the motion trail or the slower-balls retune (or both) as a next stage?

### Unsure about

- The diagnosis ran in the app's own browser pane (about 90 Hz). I could not measure your
  display; the table above covers the common rates. When the pane was hidden, `requestAnimationFrame`
  stopped, so the after-measurement is a single 300-frame run.

## Stage 2: counter density

### Plan

Measure before promoting: for every leaning pair, find out whether a mechanic specific to that
pair explains it (ablation, then per-opponent hit rates and damage rates). Promote only real
mechanisms. Where none exists, prototype small pair-specific interactions in a throwaway harness
(roster variants played in parallel worker threads), measure each on its own pair, then build the
ones that land, tune strength with as few stats as possible, and confirm with `pnpm balance 500`.

### What was found

- **None of the four suggested leans had a pair-specific mechanism**, so none was promoted on its
  own. Quake vs Venom (55.7): shockwaves hit 13% of the time against every ball, Venom included;
  the lean is a small damage-per-second edge stretched by Venom's long fights. Berserker vs Archer
  (54.9): its health pool, and rage helps it _less_ than average there. Berserker vs Venom (55.1)
  and Archer vs Sniper (53.6): nothing specific either.
- **One measured mechanism did exist:** leading arrows land most often on the slowest ball (75%
  against the Frost, 65% against the Speedster), as ADR 0012 already noted.

### What was built (ADR 0016)

| Mechanic                                                            | Counter it creates | Result |
| ------------------------------------------------------------------- | ------------------ | ------ |
| Poison numbs rage: a poisoned Berserker keeps 20% of its rage bonus | Venom > Berserker  | 60.2%  |
| `statusResistance` field; the Berserker can't be slowed             | Berserker > Frost  | 58.3%  |
| The Frost keeps 80% of a poison's duration (8 ticks become 6)       | Frost > Venom      | 67.0%  |
| A new `staggered` status from Quake shockwaves (3.5 s): can't aim   | Quake > Archer     | 61.3%  |
|                                                                     | Quake > Storm      | 57.5%  |
|                                                                     | Quake > Sniper     | 66.1%  |
| (existing) arrows land on the slowest ball, Frost health 82 → 80    | Archer > Frost     | 57.6%  |

Stat changes, each tuning a counter's strength: Quake health 72 → 71, Frost health 82 → 80,
`POISON_NUMB` 0.8. Each mechanic only touches its own pairs. Tests cover each interaction and
the resistance rounding, and each new test was shown to fail with its mechanic disabled (six
mutants, all caught). The staggered status has its own ring (broken pale-stone arcs), in the style
guide.

`pnpm balance 500`: **every target passes**. Per ball 46.7-53.0% (Quake highest), worst side
31.3%, draws 0.6%, median 18.3 s, worst ±5% sensitivity 13.7 points (unchanged). The Brawler is
still even against all but Thorns.

### Counter counts (favoured / unfavoured)

| Ball      | Before | After | 2/2? |
| --------- | ------ | ----- | ---- |
| Speedster | 3 / 4  | 3 / 4 | yes  |
| Vampire   | 3 / 2  | 3 / 2 | yes  |
| Archer    | 2 / 1  | 3 / 2 | yes  |
| Storm     | 3 / 1  | 3 / 2 | yes  |
| Frost     | 2 / 1  | 3 / 3 | yes  |
| Venom     | 1 / 1  | 2 / 2 | yes  |
| Berserker | 1 / 1  | 2 / 2 | yes  |
| Sniper    | 1 / 1  | 1 / 2 | no   |
| Quake     | 1 / 1  | 4 / 1 | no   |
| Thorns    | 1 / 4  | 1 / 4 | no   |

**Still short, and why:** the Sniper has no second prey (its shot hits 13-18% against every ball,
and no ball holds a line better than another); the Quake has no second predator (only the Frost
exploits its need for walls); Thorns' spikes only punish contact, and its other contact-heavy
opponent, the Berserker, feeds its rage on every reflection. **The Speedster hub is unchanged at
7**: the only clean lever (a longer Quake warning) weakened the stagger and broke four Quake pairs.
Details in ADR 0016 §7.

The README's counters section now lists every counter in plain language.

### Decisions made on your behalf

- **Interaction mechanics instead of promoting leans.** Alternative: promote the four leans with
  stat nudges. Rejected because none had a pair-specific mechanism, which the hard rules forbid.
- **Archer > Frost is mapped as a counter** after the Frost lost 2 health. Its mechanism (arrows
  land on the slowest ball) was measured and recorded in ADR 0012, but it only reaches the band
  because the Frost got less sturdy. Alternative: keep the Frost at 82, which left Berserker > Frost
  at 55.7, a MISS. This is the one call I'm least sure about; see below.
- **Stagger is 3.5 s** because shockwaves land about once every 9 s; at 1 s it did nothing.
- **Sniper shots don't stagger** (measured: shots hit too rarely to matter, and it would have
  added Sniper-vs-aimer relationships without reaching any band).
- **The Berserker's and Quake's picker descriptions changed** to mention the new rules ("can't be
  slowed", "stops its enemy aiming").

### Questions for you

- Are you happy with **interaction rules** (poison numbs rage, rage ignores the cold, shockwaves
  stagger aimers) as the way to make counters? They are readable, but each is one more rule to
  learn. The alternative for the remaining gaps is new balls designed as prey/predators for the
  Sniper, Quake and Thorns.
- The Quake is now the strongest ball (53.0%) with four favoured matchups. Fine, or should the
  next balance pass trim it?

### Unsure about

- Three of the seven new counters sit in WARN or NEAR (Berserker > Frost 58.3, Archer > Frost 57.6,
  Quake > Storm 57.5), and the existing Frost > Quake fell from 58.4 to 57.1 (NEAR). They pass, but
  they are soft.
- Archer > Frost (see above): a real mechanism, but tipped into the band by a stat change.
