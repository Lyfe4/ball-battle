import { describe, expect, it } from 'vitest';
import { READ_SAMPLE, sampledReadWeight } from './read-count.ts';

describe('a read’s sampled weight', () => {
  it('is READ_SAMPLE or nothing, and averages one read', () => {
    const draws = Array.from({ length: 20_000 }, sampledReadWeight);
    expect(new Set(draws)).toStrictEqual(new Set([0, READ_SAMPLE]));
    // Mean 1 with a spread of 3 a draw: 0.021 for 20,000, so ±0.1 is beyond five spreads.
    const mean = draws.reduce((sum, draw) => sum + draw, 0) / draws.length;
    expect(Math.abs(mean - 1)).toBeLessThan(0.1);
  });
});
