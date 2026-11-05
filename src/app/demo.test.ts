import { describe, expect, it } from 'vitest';
import { isFavoured } from '../sim/counter-map.ts';
import { DEMO_PAIRS, demoAt } from './demo.ts';

describe('home demo', () => {
  it('only demos counters, favoured ball in slot A, each with its reason', () => {
    expect(DEMO_PAIRS.length).toBeGreaterThan(10);
    for (const { matchup, reason } of DEMO_PAIRS) {
      expect(isFavoured(matchup.a, matchup.b)).toBe(true);
      expect(reason).not.toBe('');
    }
  });

  it('cycles through every pair from any start, including a large random one', () => {
    const count = DEMO_PAIRS.length;
    expect(demoAt(count)).toBe(demoAt(0));
    expect(demoAt(-1)).toBe(demoAt(count - 1));
    expect(demoAt(4_294_967_295)).toBe(demoAt(4_294_967_295 % count));
  });
});
