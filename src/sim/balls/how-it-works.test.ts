import { describe, expect, it } from 'vitest';
import { percentOf, secondsOf } from './how-it-works.ts';
import { BALLS } from './index.ts';

describe('How it works (ADR 0049)', () => {
  it('reads ticks as seconds to one decimal, and shares as whole percentages', () => {
    expect(secondsOf(180)).toBe('3');
    expect(secondsOf(105)).toBe('1.8');
    expect(secondsOf(26)).toBe('0.4');
    expect(percentOf(0.37)).toBe('37%');
    expect(percentOf(0.42)).toBe('42%');
  });

  it('is written for every ball, in a few short lines', () => {
    for (const ball of BALLS) {
      const rules = ball.howItWorks ?? [];
      expect({ ball: ball.id, lines: rules.length > 0 && rules.length <= 3 }).toStrictEqual({
        ball: ball.id,
        lines: true,
      });
      for (const rule of rules) expect(rule.length, `${ball.id}: ${rule}`).toBeLessThanOrEqual(150);
    }
  });
});
