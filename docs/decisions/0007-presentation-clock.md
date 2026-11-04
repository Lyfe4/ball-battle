# 0007: Presentation clock and battle feel

- Status: Accepted
- Date: 2026-11-04

## Context

Matches were correct but flat: every hit looked the same, the match started the instant the page
loaded, and a knockout simply stopped the picture and printed the result. Fighting games solve
this with hit-stop (a few frozen frames on a heavy hit), screen shake, squash and stretch, and a
slowed-down finish. Those all play with time, and time is exactly what ADR 0001 keeps away from
the simulation: the sim advances in whole ticks of exactly `DT`, and the same seed must replay the
same match bit for bit.

So the question is where time can bend without the match bending with it.

## Decision

### 1. A pure presentation clock between real time and the fixed step

`src/app/presentation-clock.ts` decides how much **sim time** and **effect time** a frame of real
time is worth. It spends each frame's real time on phases in order:

| Phase    | Sim time     | Effect time  | Used for                                  |
| -------- | ------------ | ------------ | ----------------------------------------- |
| Intro    | 0            | real         | balls pop in; the first tick waits        |
| Hit-stop | 0            | 0            | a heavy hit or a knockout freezes briefly |
| Slow-mo  | real × scale | real × scale | the knockout sequence                     |
| Normal   | real         | real         |                                           |

Sim time feeds the existing fixed-step accumulator (`advanceClock`), which turns it into whole
ticks. The clock only changes **when** ticks run, never which ticks run or what they compute: the
tick sequence is identical to a headless run. It is a plain-data value with pure functions, like
the fixed-step clock, and both are clamped the same way after a stalled frame.

### 2. A pure frame driver

`advanceFrame` in `src/app/playback.ts` combines the two clocks with `step`: it runs the ticks
the frame is worth, and after each one asks the renderer what the tick should feel like (a
hit-stop, slow-mo). A tick that asks for a hit-stop ends the frame there; the time of the ticks
it skipped stays in the accumulator, so they run after the stop instead of being lost. `main.ts`
only wires it to `requestAnimationFrame`.

A test plays whole matches through `advanceFrame` with irregular frame times (1-70 ms with
400 ms stalls), a hit-stop on every damage tick and repeated slow-mo, and checks that every world
and event matches a headless run exactly.

### 3. Effects run on effect time

Render effects (`src/render/effects.ts`) take effect time instead of real time, so a flash
freezes during a hit-stop and the knockout's shards slow down with the slow-mo. Everything is
driven by sim events and stays in the render layer (ADR 0001 rule 4); nothing is added to
`WorldState`.

- **Hit-stop** on heavy hits: 26+ damage to one ball in one tick (a near head-on Brawler hit, a
  lightning strike, a Speedster's hit with a big stack bonus), 45-80 ms by strength; 110 ms on a
  knockout. Measured over 100 seeds per matchup, under a third of non-knockout hits are heavy in
  any matchup, and none in Archer or Vampire mirrors.
- **Screen shake** on knockouts only, at most 7 world units, decaying over 240 ms. Shaking on
  big hits as well fired on up to 44% of hits in a Storm mirror and read as busy.
- **Squash and stretch** along the hit normal on contact hits (up to 14%) and on wall bounces
  (6%), recovering in 150 ms. Wall bounces are read from consecutive worlds, since the sim only
  tells abilities about them.
- **Health ghost**: the part of a health bar just lost stays visible for 300 ms, then drains
  over 450 ms, on the canvas bars and the HUD.
- **Impact particles**: 2-6 dots per contact or arrow hit, by strength, capped at 40 alive.
- **Knockout sequence**: hit-stop, then 500 ms of real time at 0.35 speed, the loser breaks into
  seven wedges, the winner's ring pulses twice, and the result text appears 950 ms of effect
  time after the knockout. A time-limit result appears at once.
- **Intro**: 1.1 s; each ball pops in (the second 160 ms after the first), then a short hold
  before the first tick.
- No floating damage numbers. The strike bolt's `shadowBlur` glow is gone (it was the only
  shadow in the renderer, and canvas shadows are expensive to draw).

Random-looking effects (particles, shards) are seeded from sim facts (tick, ball id) and shake
from effect time, so a replay looks the same. Timings, sizes and colours are in `theme.ts`.

### 4. Reduced motion

With `prefers-reduced-motion: reduce` there is no shake, squash, particles, slow-mo or
breaking apart (a defeated ball fades as before), the intro fades the balls in at full size,
and the winner's ring is steady and fades once. Hit-stops stay: a pause is not movement. The
setting is read live, so changing it mid-match takes effect at once.

## Consequences

- Positive: hits read by weight, the match has a start and an end, and the determinism guarantee
  is untouched: `src/sim` is unchanged and `pnpm balance` output is byte-identical (timing line
  aside).
- Negative: a match takes a little longer to watch (about 1.1 s intro, about 1.5 s knockout
  sequence, a few hit-stops). Wall time no longer equals sim time while a match plays, so
  anything that wants "seconds of match" must read ticks, not the clock.
- Effects keep their own small amount of state (per ball and per burst); every list is bounded
  and tested over whole matches.
