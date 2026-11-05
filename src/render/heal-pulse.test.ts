import { describe, expect, it } from 'vitest';
import { healSize } from './heal-pulse.ts';
import { theme } from './theme.ts';

describe('healSize', () => {
  it('grows with the heal as a share of max health, up to full size', () => {
    const full = theme.healFullShare * 100;
    expect(healSize(full, 100)).toBe(1);
    expect(healSize(full * 2, 100)).toBe(1);
    expect(healSize(full * 0.6, 100)).toBeCloseTo(0.6);
  });

  it('keeps a small heal visible but subtle, and a smaller heal never bigger', () => {
    expect(healSize(1, 100)).toBe(theme.healMinSize);
    expect(healSize(5, 60)).toBeLessThan(healSize(10, 60));
  });

  it('draws nothing for no heal', () => {
    expect(healSize(0, 60)).toBe(0);
  });
});
