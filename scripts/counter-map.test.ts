import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import {
  checkCounter,
  ciAllowance,
  COUNTER_BANDS,
  COUNTER_MAP,
  counterFor,
  SAFE_PICK_COUNTERS,
  SAFE_PICKS,
  type CounterEntry,
} from './counter-map.ts';

const favoured: CounterEntry = { x: 'a', y: 'b', intended: 'x', reason: '' };
const even: CounterEntry = { x: 'a', y: 'b', intended: 'even', reason: '' };

describe('the counter map', () => {
  it('has exactly one entry for every pair of different balls', () => {
    const ids = BALLS.map((ball) => ball.id);
    const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b] as const));
    for (const [a, b] of pairs) expect(counterFor(a, b), `${a} vs ${b}`).toBeDefined();
    expect(COUNTER_MAP).toHaveLength(pairs.length);
    for (const entry of COUNTER_MAP) {
      expect(entry.x).not.toBe(entry.y);
      expect(ids).toContain(entry.x);
      expect(ids).toContain(entry.y);
    }
  });

  it('gives every ball a favoured and an unfavoured matchup, except the safe picks', () => {
    for (const { id } of BALLS.filter((ball) => !SAFE_PICKS.includes(ball.id))) {
      const sides = COUNTER_MAP.filter((entry) => entry.intended !== 'even').map((entry) => {
        const winner = entry.intended === 'x' ? entry.x : entry.y;
        return entry.x === id || entry.y === id ? (winner === id ? 'favoured' : 'unfavoured') : '';
      });
      expect(sides, id).toContain('favoured');
      expect(sides, id).toContain('unfavoured');
    }
  });

  it('keeps every safe pick even against everyone but its one counter (docs/vision.md)', () => {
    expect(SAFE_PICKS).toStrictEqual(['brawler']);
    expect(SAFE_PICK_COUNTERS).toStrictEqual({ brawler: 'thorns' });
    for (const id of SAFE_PICKS) {
      const own = COUNTER_MAP.filter((entry) => entry.x === id || entry.y === id);
      expect(own).toHaveLength(BALLS.length - 1);
      for (const entry of own) {
        const other = entry.x === id ? entry.y : entry.x;
        if (other === SAFE_PICK_COUNTERS[id]) {
          // The counter is favoured against the safe pick, never the other way round.
          const favoured = entry.intended === 'x' ? entry.x : entry.intended === 'y' ? entry.y : '';
          expect(favoured, `${entry.x} vs ${entry.y}`).toBe(other);
        } else {
          expect(entry.intended, `${entry.x} vs ${entry.y}`).toBe('even');
        }
      }
    }
  });
});

describe('checkCounter', () => {
  it('checks the favoured side against 62-72%, warning near the edges', () => {
    expect(checkCounter(favoured, 0.67, 0.32)).toBe('ok');
    expect(checkCounter(favoured, 0.63, 0.36)).toBe('warn');
    expect(checkCounter(favoured, 0.71, 0.28)).toBe('warn');
    expect(checkCounter({ ...favoured, intended: 'y' }, 0.32, 0.67)).toBe('ok');
  });

  it('counts the band edges themselves as in band', () => {
    expect(checkCounter(favoured, 0.62, 0.38)).toBe('warn');
    expect(checkCounter(favoured, 0.72, 0.28)).toBe('warn');
    expect(checkCounter(even, 0.45, 0.55)).toBe('warn');
  });

  it('calls a favoured result up to 2 points outside its band NEAR, and further out MISS', () => {
    // Below the band (62%).
    expect(checkCounter(favoured, 0.615, 0.38)).toBe('near');
    expect(checkCounter(favoured, 0.6, 0.4)).toBe('near');
    expect(checkCounter(favoured, 0.5999, 0.4)).toBe('miss');
    // Above it (72%).
    expect(checkCounter(favoured, 0.74, 0.26)).toBe('near');
    expect(checkCounter(favoured, 0.7401, 0.27)).toBe('miss');
  });

  it('treats a rate exactly 2 points out as NEAR despite floating-point rounding', () => {
    // 300/500 = 0.6 and 370/500 = 0.74, computed the way pnpm balance computes rates.
    expect(checkCounter(favoured, 300 / 500, 200 / 500)).toBe('near');
    expect(checkCounter(favoured, 370 / 500, 130 / 500)).toBe('near');
    expect(checkCounter(even, 215 / 500, 285 / 500)).toBe('near');
  });

  it('needs both sides of an even pair in 45-55%, the worse side deciding', () => {
    expect(checkCounter(even, 0.5, 0.49)).toBe('ok');
    expect(checkCounter(even, 0.53, 0.46)).toBe('warn');
    expect(checkCounter(even, 0.56, 0.43)).toBe('near');
    expect(checkCounter(even, 0.432, 0.566)).toBe('near');
    expect(checkCounter(even, 0.5701, 0.4299)).toBe('miss');
    expect(checkCounter(even, 0.45, 0.4299)).toBe('miss');
    expect(checkCounter(even, 0.5, 0.44)).toBe('near');
  });

  it('passes a wider miss as NEAR when given a larger allowance, as the CI check does', () => {
    expect(checkCounter(favoured, 0.56, 0.44)).toBe('miss');
    expect(checkCounter(favoured, 0.56, 0.44, 0.087)).toBe('near');
    expect(checkCounter(favoured, 0.53, 0.47, 0.087)).toBe('miss');
  });
});

describe('ciAllowance', () => {
  it('is three standard errors of a pair over the sample, never under the full run’s 2 points', () => {
    expect(ciAllowance(300)).toBeCloseTo(0.0866, 4);
    expect(ciAllowance(200)).toBeCloseTo(0.1061, 4);
    expect(ciAllowance(1_000_000)).toBe(COUNTER_BANDS.nearWithin);
  });
});
