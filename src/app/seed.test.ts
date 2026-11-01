import { describe, expect, it } from 'vitest';
import { generateSeed, parseSeed } from './seed.ts';

describe('parseSeed', () => {
  it('accepts decimal integers in the uint32 range', () => {
    expect(parseSeed('0')).toBe(0);
    expect(parseSeed('42')).toBe(42);
    expect(parseSeed(' 1234 ')).toBe(1234);
    expect(parseSeed('4294967295')).toBe(0xffff_ffff);
  });

  it('rejects missing, malformed and out-of-range values', () => {
    for (const raw of [null, '', 'abc', '12abc', '-1', '1.5', '1e3', '0x10', '4294967296']) {
      expect(parseSeed(raw)).toBeUndefined();
    }
  });
});

describe('generateSeed', () => {
  it('returns a uint32', () => {
    const seed = generateSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffff_ffff);
  });
});
