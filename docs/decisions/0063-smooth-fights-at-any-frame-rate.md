# 0063: Smooth fights at any frame rate, and live fights that catch up gently

- Status: Accepted
- Date: 2026-11-17
- Amends: ADR 0007 (presentation time), ADR 0053 (live fights at 1x)

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
