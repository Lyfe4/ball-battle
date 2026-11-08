import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import {
  checkCounter,
  ciAllowance,
  COUNTER_BANDS,
  outsideFinalBand,
  COUNTER_MAP,
  counterFor,
  SAFE_PICK_COUNTERS,
  SAFE_PICKS,
  WITHOUT_FAVOURED,
  WITHOUT_UNFAVOURED,
  type CounterEntry,
} from './counter-map.ts';

const favoured: CounterEntry = { x: 'a', y: 'b', intended: 'x', band: 'movement', reason: '' };
const kind: CounterEntry = { ...favoured, band: 'kind' };
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

  it('labels every favoured pair with its band, and no even pair', () => {
    for (const entry of COUNTER_MAP) {
      const label = `${entry.x} vs ${entry.y}`;
      if (entry.intended === 'even') expect(entry.band, label).toBeUndefined();
      else expect(['kind', 'movement'], label).toContain(entry.band);
    }
  });

  it('gives every ball a favoured and an unfavoured matchup, except the safe picks and the listed', () => {
    const without = (side: 'favoured' | 'unfavoured') =>
      BALLS.filter(({ id }) => !SAFE_PICKS.includes(id))
        .filter(({ id }) =>
          COUNTER_MAP.every((entry) => {
            if (entry.intended === 'even' || (entry.x !== id && entry.y !== id)) return true;
            const winner = entry.intended === 'x' ? entry.x : entry.y;
            return (winner === id) !== (side === 'favoured');
          }),
        )
        .map(({ id }) => id);
    expect(without('favoured')).toStrictEqual(WITHOUT_FAVOURED);
    expect(without('unfavoured')).toStrictEqual(WITHOUT_UNFAVOURED);
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
  it('checks a movement counter against its 62-72% target, warning near the edges', () => {
    expect(checkCounter(favoured, 0.67, 0.32)).toBe('ok');
    expect(checkCounter(favoured, 0.63, 0.36)).toBe('warn');
    expect(checkCounter(favoured, 0.71, 0.28)).toBe('warn');
    expect(checkCounter({ ...favoured, intended: 'y' }, 0.32, 0.67)).toBe('ok');
  });

  it('checks a kind counter against its sharper 72-78% target', () => {
    expect(checkCounter(kind, 0.75, 0.25)).toBe('ok');
    expect(checkCounter(kind, 0.73, 0.27)).toBe('warn');
    expect(checkCounter(kind, 0.67, 0.33)).toBe('short');
  });

  it('counts the target edges themselves as in the target', () => {
    expect(checkCounter(favoured, 0.62, 0.38)).toBe('warn');
    expect(checkCounter(favoured, 0.72, 0.28)).toBe('warn');
    expect(checkCounter(kind, 0.78, 0.22)).toBe('warn');
    expect(checkCounter(even, 0.45, 0.55)).toBe('warn');
  });

  it('calls a favoured side between the 58% floor and the target below target, not a miss', () => {
    expect(checkCounter(favoured, 0.61, 0.39)).toBe('short');
    expect(checkCounter(favoured, 0.58, 0.42)).toBe('short');
    expect(checkCounter(favoured, 0.75, 0.25)).toBe('short');
  });

  it('holds a kind counter to its 66% floor: a pair has to win enough to count (ADR 0045)', () => {
    expect(checkCounter(kind, 0.67, 0.33)).toBe('short');
    expect(checkCounter(kind, 0.79, 0.21)).toBe('short');
    expect(checkCounter(kind, 0.645, 0.355)).toBe('near');
    expect(checkCounter(kind, 0.6, 0.4)).toBe('miss');
  });

  it('calls a favoured result up to 2 points outside its floor NEAR, and further out MISS', () => {
    // Below the floor (58%).
    expect(checkCounter(favoured, 0.575, 0.42)).toBe('near');
    expect(checkCounter(favoured, 0.56, 0.44)).toBe('near');
    expect(checkCounter(favoured, 0.5599, 0.44)).toBe('miss');
    // Above a movement counter's floor (76%) and a kind counter's (80%).
    expect(checkCounter(favoured, 0.78, 0.22)).toBe('near');
    expect(checkCounter(favoured, 0.7801, 0.21)).toBe('miss');
    expect(checkCounter(kind, 0.82, 0.18)).toBe('near');
    expect(checkCounter(kind, 0.8201, 0.17)).toBe('miss');
  });

  it('treats a rate exactly 2 points out as NEAR despite floating-point rounding', () => {
    // 280/500 = 0.56, 390/500 = 0.78 and 200/500 = 0.4, computed the way pnpm balance computes rates.
    expect(checkCounter(favoured, 280 / 500, 220 / 500)).toBe('near');
    expect(checkCounter(favoured, 390 / 500, 110 / 500)).toBe('near');
    expect(checkCounter(even, 200 / 500, 300 / 500)).toBe('near');
  });

  it('needs both sides of an even pair in 45-55% for the target and 42-58% for the floor', () => {
    expect(checkCounter(even, 0.5, 0.49)).toBe('ok');
    expect(checkCounter(even, 0.53, 0.46)).toBe('warn');
    expect(checkCounter(even, 0.56, 0.43)).toBe('short');
    expect(checkCounter(even, 0.426, 0.571)).toBe('short');
    expect(checkCounter(even, 0.5, 0.44)).toBe('short');
    expect(checkCounter(even, 0.59, 0.41)).toBe('near');
    expect(checkCounter(even, 0.6001, 0.3999)).toBe('miss');
    expect(checkCounter(even, 0.45, 0.3999)).toBe('miss');
  });

  it('passes a wider miss as NEAR when given a larger allowance, as the CI check does', () => {
    expect(checkCounter(favoured, 0.52, 0.48)).toBe('miss');
    expect(checkCounter(favoured, 0.52, 0.48, 0.087)).toBe('near');
    expect(checkCounter(favoured, 0.49, 0.51, 0.087)).toBe('miss');
  });
});

describe('outsideFinalBand', () => {
  it('uses the final floors with no allowance: kind 66-80%, movement 58-76%, even 42-58%', () => {
    expect(outsideFinalBand(kind, 0.65, 0.35)).toBe(true);
    expect(outsideFinalBand(kind, 0.66, 0.34)).toBe(false);
    expect(outsideFinalBand(kind, 0.81, 0.19)).toBe(true);
    expect(outsideFinalBand(favoured, 0.58, 0.42)).toBe(false);
    expect(outsideFinalBand(favoured, 0.57, 0.43)).toBe(true);
    expect(outsideFinalBand({ ...kind, intended: 'y' }, 0.3, 0.7)).toBe(false);
    expect(outsideFinalBand(even, 0.58, 0.42)).toBe(false);
    expect(outsideFinalBand(even, 0.41, 0.59)).toBe(true);
  });
});

describe('ciAllowance', () => {
  it('is three standard errors of a pair over the sample, never under the full run’s 2 points', () => {
    expect(ciAllowance(300)).toBeCloseTo(0.0866, 4);
    expect(ciAllowance(200)).toBeCloseTo(0.1061, 4);
    expect(ciAllowance(1_000_000)).toBe(COUNTER_BANDS.nearWithin);
  });
});
