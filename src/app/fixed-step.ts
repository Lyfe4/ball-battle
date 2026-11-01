import { TICK_RATE } from '../sim/constants.ts';

export const TICK_MS = 1000 / TICK_RATE;

/**
 * Longest real time a single frame may count for. After a stall (debugger, slow device) the
 * match resumes rather than fast-forwarding through hundreds of queued ticks.
 */
export const MAX_FRAME_MS = 250;

const TICK_TOLERANCE_MS = 1e-6;

export interface ClockAdvance {
  /** Whole simulation ticks to run this frame. */
  readonly ticks: number;
  /** Leftover real time, carried into the next frame. */
  readonly accumulatorMs: number;
}

/**
 * Converts real elapsed time into a whole number of fixed simulation ticks. The leftover is
 * carried forward, so over time the sim runs at exactly TICK_RATE whatever the display refresh
 * rate. This only decides when ticks run; it never affects what a tick computes.
 */
export function advanceClock(accumulatorMs: number, elapsedMs: number): ClockAdvance {
  const clamped = Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS);
  const total = accumulatorMs + clamped;
  // TICK_MS is not exactly representable, so a total that should be a whole number of ticks can
  // land a hair below it. Without the tolerance a 60 Hz display would alternate 0 and 2 ticks.
  const ticks = Math.floor((total + TICK_TOLERANCE_MS) / TICK_MS);
  return { ticks, accumulatorMs: Math.max(0, total - ticks * TICK_MS) };
}
