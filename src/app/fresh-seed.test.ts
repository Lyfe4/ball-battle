import { describe, expect, it } from 'vitest';
import { generateSeed } from './fresh-seed.ts';

describe('generateSeed', () => {
  it('returns a uint32', () => {
    const seed = generateSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffff_ffff);
  });
});
