import { describe, expect, it } from 'vitest';
import { cueAlpha, cueScale, ruleCuePoints } from './rule-cue.ts';
import { theme } from './theme.ts';

describe('the rule cue', () => {
  it('is a closed four-point spark inside a unit box', () => {
    const points = ruleCuePoints();
    expect(points).toHaveLength(8);
    for (const [x, y] of points) {
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
    }
  });

  it('pops past full size, settles at 1, and never moves with reduced motion', () => {
    expect(cueScale(1, false)).toBe(0);
    expect(cueScale(0.85, false)).toBeCloseTo(theme.ruleCuePop);
    expect(cueScale(0.5, false)).toBe(1);
    expect(cueScale(1, true)).toBe(1);
    expect(cueScale(0.9, true)).toBe(1);
  });

  it('holds full opacity, then fades out over the end', () => {
    expect(cueAlpha(1)).toBe(1);
    expect(cueAlpha(0.4)).toBe(1);
    expect(cueAlpha(0.2)).toBeCloseTo(0.5);
    expect(cueAlpha(0)).toBe(0);
  });
});
