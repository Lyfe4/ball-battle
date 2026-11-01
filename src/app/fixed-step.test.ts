import { describe, expect, it } from 'vitest';
import { advanceClock, MAX_FRAME_MS, TICK_MS } from './fixed-step.ts';

function ticksOver(frameMs: number, frames: number): number {
  let accumulatorMs = 0;
  let ticks = 0;
  for (let i = 0; i < frames; i++) {
    const result = advanceClock(accumulatorMs, frameMs);
    ticks += result.ticks;
    accumulatorMs = result.accumulatorMs;
  }
  return ticks;
}

describe('advanceClock', () => {
  it('runs 60 ticks per second at any refresh rate', () => {
    for (const hz of [30, 60, 75, 120, 144, 240]) {
      const ticks = ticksOver(1000 / hz, hz * 10);
      // Within one tick of exact after ten seconds: the remainder is carried, not dropped.
      expect(Math.abs(ticks - 600)).toBeLessThanOrEqual(1);
    }
  });

  it('carries leftover time into the next frame', () => {
    const first = advanceClock(0, TICK_MS * 1.5);
    expect(first.ticks).toBe(1);
    expect(first.accumulatorMs).toBeCloseTo(TICK_MS * 0.5, 9);
    expect(advanceClock(first.accumulatorMs, TICK_MS * 0.5).ticks).toBe(1);
  });

  it('caps a long stall instead of fast-forwarding', () => {
    const result = advanceClock(0, 60_000);
    // 250 ms is exactly 15 ticks at 60 Hz.
    expect(result.ticks).toBe(15);
    expect(MAX_FRAME_MS).toBe(250);
  });

  it('ignores negative elapsed time', () => {
    expect(advanceClock(0, -500)).toStrictEqual({ ticks: 0, accumulatorMs: 0 });
  });
});
