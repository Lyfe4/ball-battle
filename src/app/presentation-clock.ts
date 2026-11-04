import { MAX_FRAME_MS } from './fixed-step.ts';

/**
 * How real time turns into playback time (ADR 0007). Pure presentation: it only decides how much
 * sim time and effect time a frame is worth. The sim still advances in whole ticks of exactly DT,
 * in the same order, so the tick sequence (and so the match) never changes.
 *
 * Time is spent on the phases in this order:
 *  1. Intro: effects play, the sim waits (the first tick is delayed).
 *  2. Hit-stop: everything freezes, sim and effects.
 *  3. Slow-mo: sim and effects both run at `slowMoScale`.
 *  4. Normal speed.
 */
export interface PresentationClock {
  readonly introMs: number;
  readonly hitStopMs: number;
  readonly slowMoMs: number;
  readonly slowMoScale: number;
}

export interface PresentationAdvance {
  readonly clock: PresentationClock;
  /** Sim time to feed the fixed-step accumulator. */
  readonly simMs: number;
  /** How far effect time (flashes, particles, the knockout sequence) moves. */
  readonly effectMs: number;
}

export function startClock(introMs: number): PresentationClock {
  return { introMs: Math.max(0, introMs), hitStopMs: 0, slowMoMs: 0, slowMoScale: 1 };
}

/** Freezes playback for `ms`. Overlapping hit-stops don't stack: the longer one wins. */
export function withHitStop(clock: PresentationClock, ms: number): PresentationClock {
  return { ...clock, hitStopMs: Math.max(clock.hitStopMs, ms) };
}

/** Slows playback to `scale` for `ms` of real time, replacing any slow-mo already running. */
export function withSlowMo(clock: PresentationClock, ms: number, scale: number): PresentationClock {
  return { ...clock, slowMoMs: Math.max(0, ms), slowMoScale: Math.min(1, Math.max(0, scale)) };
}

/** True while the clock is doing something other than running at normal speed. */
export function isClockBusy(clock: PresentationClock): boolean {
  return clock.introMs > 0 || clock.hitStopMs > 0 || clock.slowMoMs > 0;
}

/**
 * Splits `realMs` of elapsed real time across the phases. The elapsed time is clamped like the
 * fixed-step clock's, so a stalled tab resumes instead of fast-forwarding.
 */
export function advancePresentation(clock: PresentationClock, realMs: number): PresentationAdvance {
  let left = Math.min(Math.max(realMs, 0), MAX_FRAME_MS);
  let simMs = 0;
  let effectMs = 0;

  const intro = Math.min(left, clock.introMs);
  left -= intro;
  effectMs += intro;

  const hitStop = Math.min(left, clock.hitStopMs);
  left -= hitStop;

  const slowMo = Math.min(left, clock.slowMoMs);
  left -= slowMo;
  simMs += slowMo * clock.slowMoScale;
  effectMs += slowMo * clock.slowMoScale;

  simMs += left;
  effectMs += left;

  return {
    clock: {
      introMs: clock.introMs - intro,
      hitStopMs: clock.hitStopMs - hitStop,
      slowMoMs: clock.slowMoMs - slowMo,
      slowMoScale: clock.slowMoMs - slowMo > 0 ? clock.slowMoScale : 1,
    },
    simMs,
    effectMs,
  };
}
