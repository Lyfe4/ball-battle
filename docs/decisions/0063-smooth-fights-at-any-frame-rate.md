# 0063: Smooth fights at any frame rate, and live fights that catch up gently

- Status: Accepted
- Date: 2026-11-17
- Amends: ADR 0007 (presentation time), ADR 0053 (live fights at 1x)
- Addendum (2026-11-18): Low Power Mode measured; a trail on slow frames and the `?frames` meter
- Addendum (2026-11-18): the trail kept (`?smooth=off` removed); a one-time line on slow frames

## Context

Fights looked choppy on iPhones in Low Power Mode, offline and online: it holds Safari near 30
frames a second, often unevenly, while the sim runs 60 ticks a second. The suspicion was that
frames showed uneven jumps of ticks, and that live play caught up to the server in jumps.

Measured first (the real page at phone size, its animation frames held to a beat, each ball's
drawn centre recorded per frame; the share by which a frame's speed strays from the median, 90th
percentile, between bounces):

| Beat            | Chromium | WebKit |
| --------------- | -------- | ------ |
| 30 fps          | 0.4%     | 2.2%   |
| uneven 25/42 ms | 0.8%     | 3.3%   |

The balls, shots and minions were already drawn between the last two ticks (`interpolate.ts`).
What was not: everything drawn from the tick itself (a design's animation, a boomerang's spin, the
aim line, a zone's pulse, a bomb's fuse, a curse's flicker, a web's fade). On the same playback
pipeline, its speed strayed by 34% at an uneven 25/42 ms beat (1, 2 or 3 ticks a frame), and at
120 Hz it stood still every other frame (100%). A Slime's half split off this tick was drawn at
its new place at once. Live, nothing jumped while a fight played, but a fight that started late
(its start timer fires late on a busy or throttled phone, or a slow frame is cut at 250 ms) stayed
that far behind the other phone for the whole fight: a page busy for 500 ms across Fight!, drawing
at 25/42 ms, stayed 325 world units (about 0.43 s) behind.

## Decision

All of it is presentation (ADR 0007): no sim change, the same ticks, the golden results unchanged.

- **The drawn world's tick is blended too** (`interpolateWorld`): a fraction between the last two
  ticks, so everything drawn from it moves with the balls. Every use in the renderer is a
  comparison or a continuous function of it, so a fraction is safe; what is drawn is still never
  ahead of the sim.
- **A ball split off this tick glides out** of the ball it split from (its side's first ball, ADR
  0059), from where that ball was a tick before.
- **A live fight catches up gently** (`catchUpRate`, `src/app/live-play.ts`): the arena counts the
  real time it has played since Fight! (`playedMs`, including the frame about to play), the live
  driver compares it with the server's moment, and the fight plays faster by its lag over 300 ms
  (at most 1.5x; one ahead eases back, at least 0.85x; within 8 ms it is on time). A 400 ms lag is
  nearly gone within a second at 30, 60 or 120 frames a second, and no frame skips more than half
  its own length ahead. The jump stays only for a page that was away (back from the background, or
  opened late), which has no earlier frame to glide from.

## Measured after

- Tick-driven motion on the playback pipeline: 0% at 120, 60 and 30 fps and at 25/42 ms.
- Balls on the real page (`frame-pacing.touch.browser.test.ts`), Chromium / WebKit: 120 fps
  2.2% / 6.7% (the harness's timers at 8 ms), 60 fps 0.6% / 3.3%, 30 fps 0.3% / 2.2%, uneven
  0.8% / 3.2%: as before, smooth.
- Two phones (`live-sync.online.test.ts`), the friend's drawing at 25/42 ms and busy for 500 ms
  across Fight!: the median gap between the two phones' drawn ball over the last 1.5 s of the
  first 4 s was 325 world units before, 0.3 to 2.0 after (1.2 with neither phone slowed).

## Consequences

- A live fight's speed is no longer exactly 1x on a phone that fell behind: it plays up to 1.5x
  for a moment. Its server end time (`attemptWatchMs`) has room for that.
- Not measurable here: a real iPhone in Low Power Mode. If fights still look choppy there, the
  next suspect is drawing cost on a throttled phone (frames dropped below 30), not pacing.

## Addendum: what Low Power Mode really costs, and a trail at 30 (2026-11-18)

Fights still looked choppy on the owner's iPhone in Low Power Mode on the published build, after
the decision above. Measured first, with no fix assumed (`scripts/low-power-frames.ts`,
`scripts/live-frames.ts --cap 30`): the real page at 390 × 664, frames held to every other one of
the browser's own (as Safari holds them to 30), Chromium with its CPU slowed 6× (and a trace of
its main thread) or WebKit as is.

| Where (frames held to 30)                    | Late frames before | After        | A frame's work (6×)            |
| -------------------------------------------- | ------------------ | ------------ | ------------------------------ |
| Free play, five busy fights, Chromium 6×     | 0.2-0.8%           | 0.2-0.8%     | median 1.8 → 2.2 ms, p95 ≤ 3.9 |
| Spider vs Speedster, WebKit, three runs each | 1.5-2.0%           | 1.4-1.5%     | ≤ 1 ms p95                     |
| Offline Reveal Best of 3, Chromium 6×        | 0% (worst 34 ms)   | 0.1% (50 ms) |                                |
| Live, sender and friend, Chromium 6×         | 0.2% each          | 0.2% each    | no long tasks                  |
| Live, sender and friend, WebKit              | 0% each            | 0% each      |                                |

A late frame is a gap over a beat and a half. Unthrottled, a frame is about 0.25 ms of script and
0.1 ms of style, layout and paint. A first offline run said 9.8% dropped; a CPU profile put the
time in the test driver's role queries (`isElementHiddenForAria`), not the game, and pressing
from inside the page measured 0%.

**So it is the cap, not dropped frames.** At 30 a second each picture moves a ball about 26 world
units, a quarter of its width (8.5 px on a phone), and the eye sees the steps however even they
are. What can't be measured here is a real iPhone's canvas drawing: `?frames` in the URL now
shows the frame rate, the late frames and the worst gap on the phone itself (`frame-meter.ts`).
A steady 30 with few late frames confirms the cap; many late frames would point at drawing cost.

**Decision: a light trail on slow frames** (`motion-smear.ts`). On a frame 24 ms or more after the
last (below about 42 a second), each moving ball trails a band its own width along its path
through the last two pictures, fading from nothing at its back edge two frames ago to 35% at its
back edge now: the jumps are filled in and the eye has a line to follow, as motion blur does for
film. One stroked path, so a bounce has no doubled joint. Trailing only, so nothing is drawn ahead
of the sim; it stops at a step where the ball stood still (a hit-stop) or jumped (a rewind, a
split, a new match); as see-through as a phased ball; off under reduced motion. At 50 a second and
faster nothing changes, so desktops and 60/120 Hz phones look as before. Presentation only (ADR
0007): no sim change. (A `?smooth=off` switch to compare on a phone came with it; removed in the
next addendum.)

**Tried and dropped: even frame pacing** (each frame played as the median beat, the difference
paid back over later frames, so no time is lost). It makes motion worse wherever frame times are
the real display times: speed jitter at 30 fps went from 0.6% to 20.3% (Chromium) and at the
uneven beat from 3.2% to 24.7% (WebKit). Safari stamps each frame with the display's own time, so
there is nothing to even out. Also not taken: trailing shots and minions (small, and the balls are
what the eye follows).

**Kept from coming back:** `frame-pacing.touch.browser.test.ts` now also times each frame's work
(p95 under half a 60 Hz beat; about 0.3-1 ms today) and checks that frames 26 ms or more apart
draw a trail and frames 20 ms or less never do, judged per frame from its real gap (WebKit's
harness timers run near 27 a second at the 60 fps beat). A/B in WebKit, the trail costs no
measurable frames (1.4-1.6% late with it, 1.5-2.0% without).

## Addendum: the trail stays, and a line says why at 30 (2026-11-18)

On the owner's iPhone the trail helped, but a fight at Safari's Low Power Mode cap still can't look
as smooth as at 60, and nothing in the page can lift the cap. So the trail stays as it is, the
comparison switch `?smooth=off` is removed (one code path), `?frames` stays for bug reports, and
the player is told once why, and what fixes it.

**When:** the arena hands each frame's real gap to `slow-frames.ts` while a fight runs (never held
on Fight!, paused under a dialog, away in a hidden tab, or between fights; never the home demo).
Slow means the last 150 frames (about 5 s at 30 a second) averaged 26 ms or more apart, each gap
counted at most 100 ms: an uneven 25/42 ms beat and a 20-a-second old phone count, 40 a second
does not, and a stall or a few at 60 never tip it (a 600 ms stall adds at most 0.6 ms to the
average). The window runs across fights, since a short fight at 2x is only a few seconds.

**What and where:** "Fights look less smooth on this device. Try turning off Low Power Mode or
battery saver." It names both settings (iPhone and Android), says "this device" rather than
"your phone", and is a suggestion, so it stays true on an old phone with neither. It shows only
after a fight, once the Winner moment has passed (the same moment the round screen waits for), in
the HUD under the result in a surface box like the match story's (`frame-tip.ts`), never over the
court and never during a fight, so a live match is never delayed. Two lines at 375 wide, with
about a tenth of the width to spare. A polite status, so a screen reader hears it once. It goes
when the next match starts.

**Once:** `Tips.takeFrameTip` remembers it on the device (`ballbattle.frameTipSeen`); "Show all
tips again" brings it back. It is about the device, not teaching, so the ability-hints switch
leaves it alone.

**Kept from coming back:** `slow-frames.test.ts` (the thresholds) and
`frame-tip.touch.browser.test.ts`: the real page with frames stamped on a clock of their own, a
fight at 60 with a 600 ms stall shows nothing, a fight at 30 shows the line after the result,
under the court, in two lines, and the next fight clears it for good. Shown to fail with the
arena's frames not handed in, and with a detector a single stall could trip.
