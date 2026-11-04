import { describe, expect, it } from 'vitest';
import { MAX_FRAME_MS } from './fixed-step.ts';
import {
  advancePresentation,
  isClockBusy,
  startClock,
  withHitStop,
  withSlowMo,
} from './presentation-clock.ts';

describe('presentation clock', () => {
  it('runs sim and effects at real speed when nothing is going on', () => {
    const { clock, simMs, effectMs } = advancePresentation(startClock(0), 16);
    expect(simMs).toBe(16);
    expect(effectMs).toBe(16);
    expect(isClockBusy(clock)).toBe(false);
  });

  it('holds the sim during the intro while effects play', () => {
    const first = advancePresentation(startClock(100), 60);
    expect(first.simMs).toBe(0);
    expect(first.effectMs).toBe(60);
    // The intro ends 40 ms into this frame; the rest is normal time.
    const second = advancePresentation(first.clock, 60);
    expect(second.simMs).toBe(20);
    expect(second.effectMs).toBe(60);
    expect(isClockBusy(second.clock)).toBe(false);
  });

  it('freezes sim and effects during a hit-stop, then resumes mid-frame', () => {
    const clock = withHitStop(startClock(0), 50);
    const first = advancePresentation(clock, 30);
    expect(first.simMs).toBe(0);
    expect(first.effectMs).toBe(0);
    const second = advancePresentation(first.clock, 30);
    expect(second.simMs).toBe(10);
    expect(second.effectMs).toBe(10);
  });

  it('does not stack overlapping hit-stops', () => {
    expect(withHitStop(withHitStop(startClock(0), 80), 50).hitStopMs).toBe(80);
    expect(withHitStop(withHitStop(startClock(0), 50), 80).hitStopMs).toBe(80);
  });

  it('scales sim and effect time during slow-mo, then returns to normal', () => {
    const clock = withSlowMo(startClock(0), 100, 0.25);
    const first = advancePresentation(clock, 40);
    expect(first.simMs).toBe(10);
    expect(first.effectMs).toBe(10);
    const second = advancePresentation(first.clock, 80);
    // 60 ms of slow-mo left at a quarter, then 20 ms at full speed.
    expect(second.simMs).toBe(35);
    expect(second.clock.slowMoScale).toBe(1);
    expect(isClockBusy(second.clock)).toBe(false);
  });

  it('spends a frame on intro, then hit-stop, then slow-mo, in that order', () => {
    const clock = withSlowMo(withHitStop(startClock(20), 30), 40, 0.5);
    const { simMs, effectMs, clock: after } = advancePresentation(clock, 100);
    // 20 intro (effects only) + 30 frozen + 40 at half + 10 normal.
    expect(simMs).toBe(30);
    expect(effectMs).toBe(50);
    expect(isClockBusy(after)).toBe(false);
  });

  it('clamps a stalled frame and ignores negative elapsed time', () => {
    expect(advancePresentation(startClock(0), 10_000).simMs).toBe(MAX_FRAME_MS);
    expect(advancePresentation(startClock(0), -5).simMs).toBe(0);
  });
});
