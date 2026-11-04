import { describe, expect, it } from 'vitest';
import {
  ghostDone,
  ghostHealth,
  introLook,
  progress,
  shakeOffset,
  squashScale,
  winnerRing,
} from './motion.ts';
import { theme } from './theme.ts';

describe('motion curves', () => {
  it('measures progress from 0 to 1 and clamps', () => {
    expect(progress(100, 50, 200)).toBe(0);
    expect(progress(100, 200, 200)).toBe(0.5);
    expect(progress(100, 900, 200)).toBe(1);
    expect(progress(0, 0, 0)).toBe(1);
  });

  it('squashes most at the start and recovers fully', () => {
    expect(squashScale(0.2, 0)).toStrictEqual({ along: 0.8, across: 1.1 });
    expect(squashScale(0.2, 1)).toStrictEqual({ along: 1, across: 1 });
    expect(squashScale(0.2, 0.5).along).toBeGreaterThan(0.8);
  });

  it('shakes within the cap and stops when done', () => {
    for (let t = 0; t < 300; t += 7) {
      const offset = shakeOffset(1000, 0, t);
      const cap = theme.shakeKnockoutOffset;
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(cap);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(cap);
    }
    expect(shakeOffset(theme.shakeKnockoutOffset, 1, 123)).toStrictEqual({ x: 0, y: 0 });
    // Same time, same offset: a replay shakes identically.
    expect(shakeOffset(5, 0.3, 77)).toStrictEqual(shakeOffset(5, 0.3, 77));
  });

  it('holds the ghost at the old health, then drains it to the new health', () => {
    const entry = { from: 60, startMs: 1000 };
    expect(ghostHealth(entry, 40, 1000)).toBe(60);
    expect(ghostHealth(entry, 40, 1000 + theme.ghostHoldMs)).toBe(60);
    const mid = ghostHealth(entry, 40, 1000 + theme.ghostHoldMs + theme.ghostDrainMs / 2);
    expect(mid).toBeGreaterThan(40);
    expect(mid).toBeLessThan(60);
    const end = 1000 + theme.ghostHoldMs + theme.ghostDrainMs;
    expect(ghostHealth(entry, 40, end)).toBe(40);
    expect(ghostDone(entry, end)).toBe(true);
    expect(ghostDone(entry, end - 1)).toBe(false);
  });

  it('never shows the ghost below the real health, so a heal covers it', () => {
    expect(ghostHealth({ from: 50, startMs: 0 }, 55, 10)).toBe(55);
    expect(ghostHealth(undefined, 33, 10)).toBe(33);
  });

  it('pops each ball in during the intro, the second a little later', () => {
    expect(introLook(0, 0, false)).toStrictEqual({ scale: 0, alpha: 0 });
    expect(introLook(1, theme.introStaggerMs - 1, false).scale).toBe(0);
    const peak = introLook(0, theme.introPopMs * 0.7, false);
    expect(peak.scale).toBeCloseTo(1 + theme.introOvershoot, 9);
    expect(introLook(1, theme.introStaggerMs + theme.introPopMs, false)).toStrictEqual({
      scale: 1,
      alpha: 1,
    });
    // The whole intro fits in its time, with a hold before the first tick.
    expect(theme.introStaggerMs + theme.introPopMs).toBeLessThan(theme.introMs);
    expect(theme.introMs).toBeLessThan(1500);
  });

  it('fades the intro in at full size with reduced motion', () => {
    expect(introLook(0, theme.introPopMs / 2, true)).toStrictEqual({ scale: 1, alpha: 0.5 });
  });

  it('pulses the winner ring, or holds it still with reduced motion', () => {
    const start = winnerRing(0, false);
    expect(start).toStrictEqual({ growth: 0, alpha: 1 });
    expect(winnerRing(0.25, false).growth).toBeCloseTo(theme.winnerRingGrowth / 2, 9);
    expect(winnerRing(1, false).alpha).toBe(0);
    expect(winnerRing(0.25, true)).toStrictEqual({ growth: 0, alpha: 0.75 });
  });
});
