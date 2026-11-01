import { describe, expect, it } from 'vitest';
import { nextFloat, nextRange, seedRng, type RngState } from './rng.ts';

function sequence(seed: number, count: number): number[] {
  let state: RngState = seedRng(seed);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const result = nextFloat(state);
    values.push(result.value);
    state = result.state;
  }
  return values;
}

describe('rng', () => {
  it('matches reference mulberry32 output for a known seed', () => {
    // Values from the canonical closure-based mulberry32 with seed 42. If this fails, the
    // algorithm changed and every recorded seed would replay differently.
    expect(sequence(42, 5)).toStrictEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
      0.17481389874592423,
    ]);
  });

  it('produces the same sequence for the same seed', () => {
    expect(sequence(1234, 1000)).toStrictEqual(sequence(1234, 1000));
  });

  it('produces different sequences for different seeds', () => {
    expect(sequence(1, 100)).not.toStrictEqual(sequence(2, 100));
  });

  it('returns values in [0, 1)', () => {
    for (const value of sequence(7, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is pure: the same state always yields the same result', () => {
    const state = seedRng(99);
    expect(nextFloat(state)).toStrictEqual(nextFloat(state));
  });

  it('normalises seeds to uint32', () => {
    expect(seedRng(-1)).toBe(0xffffffff);
    expect(seedRng(0x1_0000_0005)).toBe(5);
    expect(seedRng(3.9)).toBe(3);
    expect(seedRng(Number.NaN)).toBe(0);
    expect(seedRng(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('scales nextRange into [min, max)', () => {
    let state = seedRng(5);
    for (let i = 0; i < 1000; i++) {
      const result = nextRange(state, -3, 8);
      expect(result.value).toBeGreaterThanOrEqual(-3);
      expect(result.value).toBeLessThan(8);
      state = result.state;
    }
  });
});
