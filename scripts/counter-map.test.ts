import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import {
  checkCounter,
  COUNTER_MAP,
  counterFor,
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

  it('keeps every safe pick even against everyone (docs/vision.md)', () => {
    expect(SAFE_PICKS).toStrictEqual(['brawler']);
    for (const id of SAFE_PICKS) {
      const own = COUNTER_MAP.filter((entry) => entry.x === id || entry.y === id);
      expect(own).toHaveLength(BALLS.length - 1);
      for (const entry of own) expect(entry.intended, `${entry.x} vs ${entry.y}`).toBe('even');
    }
  });
});

describe('checkCounter', () => {
  it('checks the favoured side against 58-70%, warning near the edges', () => {
    expect(checkCounter(favoured, 0.64, 0.35)).toBe('ok');
    expect(checkCounter(favoured, 0.59, 0.4)).toBe('warn');
    expect(checkCounter(favoured, 0.69, 0.3)).toBe('warn');
    expect(checkCounter(favoured, 0.57, 0.42)).toBe('miss');
    expect(checkCounter(favoured, 0.72, 0.28)).toBe('miss');
    expect(checkCounter({ ...favoured, intended: 'y' }, 0.35, 0.64)).toBe('ok');
  });

  it('needs both sides of an even pair in 45-55%', () => {
    expect(checkCounter(even, 0.5, 0.49)).toBe('ok');
    expect(checkCounter(even, 0.53, 0.46)).toBe('warn');
    expect(checkCounter(even, 0.56, 0.43)).toBe('miss');
    expect(checkCounter(even, 0.45, 0.44)).toBe('miss');
  });
});
