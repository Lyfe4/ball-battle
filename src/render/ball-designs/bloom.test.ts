import { describe, expect, it } from 'vitest';
import { PAUSE_TICKS } from '../../sim/balls/bloom.ts';
import { petalsClosed } from './bloom.ts';

describe('Bloom look', () => {
  it('stays a shut bud through its wait and opens only over its last third of a second', () => {
    const hit = 100;
    const until = hit + PAUSE_TICKS;
    // Shut from the hit until a third of a second (20 ticks) before the wait ends.
    for (let tick = hit; tick <= until - 20; tick++) expect(petalsClosed(until, tick)).toBe(1);
    // Then it opens steadily, half open 10 ticks before the end, and is open once it regrows.
    expect(petalsClosed(until, until - 10)).toBeCloseTo(0.5, 10);
    expect(petalsClosed(until, until - 1)).toBeGreaterThan(0);
    expect(petalsClosed(until, until)).toBe(0);
    expect(petalsClosed(0, hit)).toBe(0);
  });
});
