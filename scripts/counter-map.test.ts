import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import {
  checkCounter,
  ciAllowance,
  COUNTER_BANDS,
  COUNTER_MAP,
  counterFor,
  EVEN_PICKS,
  inGreyZone,
  outsideFinalBand,
  SHAPE,
  SHAPE_EXCEPTIONS,
  shapeProblem,
  type CounterEntry,
} from './counter-map.ts';

const favoured: CounterEntry = { x: 'a', y: 'b', intended: 'x', reason: '' };
const even: CounterEntry = { x: 'a', y: 'b', intended: 'even', reason: '' };

/** The balls the map says `id` beats and loses to. */
function countersOf(id: string): { beats: string[]; losesTo: string[] } {
  const beats: string[] = [];
  const losesTo: string[] = [];
  for (const entry of COUNTER_MAP) {
    if (entry.intended === 'even' || (entry.x !== id && entry.y !== id)) continue;
    const winner = entry.intended === 'x' ? entry.x : entry.y;
    const other = entry.x === id ? entry.y : entry.x;
    (winner === id ? beats : losesTo).push(other);
  }
  return { beats, losesTo };
}

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

  it('gives every ball its shape: 2-4 counters each way, within 1, but for the named exceptions', () => {
    for (const { id } of BALLS) {
      const { beats, losesTo } = countersOf(id);
      expect(shapeProblem(id, beats, losesTo), id).toBeUndefined();
    }
  });

  it('names only the known gaps as exceptions (ADR 0045, group 4)', () => {
    expect(Object.keys(SHAPE_EXCEPTIONS).sort()).toStrictEqual(
      ['berserker', 'bloom', 'bomber', 'storm', 'titan', 'venom'].sort(),
    );
  });

  it('keeps each even pick even against everyone but its listed counters (docs/vision.md)', () => {
    expect(Object.keys(EVEN_PICKS)).toStrictEqual(['brawler', 'magnet']);
    expect(EVEN_PICKS['brawler']?.losesTo).toStrictEqual(['thorns']);
    for (const [id, { beats, losesTo }] of Object.entries(EVEN_PICKS)) {
      const own = countersOf(id);
      expect([...own.beats].sort(), id).toStrictEqual([...beats].sort());
      expect([...own.losesTo].sort(), id).toStrictEqual([...losesTo].sort());
    }
  });
});

describe('shapeProblem', () => {
  const some = (count: number) => Array.from({ length: count }, (_, i) => `ball-${String(i)}`);

  it('holds every other ball to SHAPE', () => {
    expect(SHAPE).toStrictEqual({ fewest: 2, most: 4, within: 1 });
    expect(shapeProblem('archer', some(2), some(3))).toBeUndefined();
    expect(shapeProblem('archer', some(1), some(2))).toBeDefined();
    expect(shapeProblem('archer', some(5), some(4))).toBeDefined();
    expect(shapeProblem('archer', some(2), some(4))).toBeDefined();
  });

  it('allows the named exceptions only their own gap', () => {
    expect(shapeProblem('storm', some(1), some(1))).toBeUndefined();
    expect(shapeProblem('storm', some(0), some(1))).toBeDefined();
    expect(shapeProblem('venom', some(1), some(3))).toBeUndefined();
    expect(shapeProblem('venom', some(1), some(4))).toBeDefined();
    expect(shapeProblem('berserker', some(5), some(2))).toBeUndefined();
    expect(shapeProblem('berserker', some(6), some(2))).toBeDefined();
    expect(shapeProblem('bloom', some(5), some(1))).toBeDefined();
  });

  it('holds an even pick to exactly its listed counters', () => {
    expect(shapeProblem('brawler', ['ghost'], ['thorns'])).toBeUndefined();
    expect(shapeProblem('brawler', [], ['thorns'])).toBeDefined();
    expect(shapeProblem('magnet', [], ['thorns'])).toBeUndefined();
    expect(shapeProblem('magnet', ['ghost'], ['thorns'])).toBeDefined();
  });
});

describe('checkCounter', () => {
  it('checks a counter against its 65-72% target, warning near the edges', () => {
    expect(checkCounter(favoured, 0.68, 0.31)).toBe('ok');
    expect(checkCounter(favoured, 0.66, 0.33)).toBe('warn');
    expect(checkCounter(favoured, 0.71, 0.28)).toBe('warn');
    expect(checkCounter({ ...favoured, intended: 'y' }, 0.31, 0.68)).toBe('ok');
  });

  it('counts the target edges themselves as in the target', () => {
    expect(checkCounter(favoured, 0.65, 0.35)).toBe('warn');
    expect(checkCounter(favoured, 0.72, 0.28)).toBe('warn');
    expect(checkCounter(even, 0.45, 0.55)).toBe('warn');
  });

  it('calls a counter between its 62-78% floor and the target below target, not a miss', () => {
    expect(checkCounter(favoured, 0.62, 0.38)).toBe('short');
    expect(checkCounter(favoured, 0.64, 0.36)).toBe('short');
    expect(checkCounter(favoured, 0.75, 0.25)).toBe('short');
    expect(checkCounter(favoured, 0.78, 0.22)).toBe('short');
  });

  it('calls a counter up to 2 points outside its floor NEAR, and further out MISS', () => {
    expect(checkCounter(favoured, 0.61, 0.39)).toBe('near');
    expect(checkCounter(favoured, 0.6, 0.4)).toBe('near');
    expect(checkCounter(favoured, 0.5999, 0.4)).toBe('miss');
    expect(checkCounter(favoured, 0.8, 0.2)).toBe('near');
    expect(checkCounter(favoured, 0.8001, 0.19)).toBe('miss');
  });

  it('treats a rate exactly 2 points out as NEAR despite floating-point rounding', () => {
    // 300/500 = 0.6 and 400/500 = 0.8, computed the way pnpm balance computes rates.
    expect(checkCounter(favoured, 300 / 500, 200 / 500)).toBe('near');
    expect(checkCounter(favoured, 400 / 500, 100 / 500)).toBe('near');
    expect(checkCounter(even, 320 / 500, 180 / 500)).toBe('near');
  });

  it('needs both sides of an even pair in 45-55% for the target and 22-62% for the floor', () => {
    expect(checkCounter(even, 0.5, 0.49)).toBe('ok');
    expect(checkCounter(even, 0.53, 0.46)).toBe('warn');
    expect(checkCounter(even, 0.56, 0.43)).toBe('short');
    expect(checkCounter(even, 0.61, 0.39)).toBe('short');
    // Draws can push the other side under 38%: still even while nobody reaches 62%.
    expect(checkCounter(even, 0.598, 0.369)).toBe('short');
    expect(checkCounter(even, 0.63, 0.37)).toBe('near');
    expect(checkCounter(even, 0.6401, 0.3599)).toBe('miss');
  });

  it('passes a wider miss as NEAR when given a larger allowance, as the CI check does', () => {
    expect(checkCounter(favoured, 0.55, 0.45)).toBe('miss');
    expect(checkCounter(favoured, 0.55, 0.45, 0.087)).toBe('near');
    expect(checkCounter(favoured, 0.52, 0.48, 0.087)).toBe('miss');
  });
});

describe('outsideFinalBand', () => {
  it('uses the final floors with no allowance: counter 62-78%, even sides 22-62%', () => {
    expect(outsideFinalBand(favoured, 0.62, 0.38)).toBe(false);
    expect(outsideFinalBand(favoured, 0.619, 0.38)).toBe(true);
    expect(outsideFinalBand(favoured, 0.78, 0.22)).toBe(false);
    expect(outsideFinalBand(favoured, 0.781, 0.21)).toBe(true);
    expect(outsideFinalBand({ ...favoured, intended: 'y' }, 0.3, 0.7)).toBe(false);
    expect(outsideFinalBand(even, 0.62, 0.38)).toBe(false);
    expect(outsideFinalBand(even, 0.37, 0.63)).toBe(true);
    expect(outsideFinalBand(even, 0.369, 0.598)).toBe(false);
  });
});

describe('inGreyZone', () => {
  it('flags an even pair with a side above 58% up to 62%, and nothing else', () => {
    expect(inGreyZone(even, 0.58, 0.41)).toBe(false);
    expect(inGreyZone(even, 0.581, 0.41)).toBe(true);
    expect(inGreyZone(even, 0.4, 0.62)).toBe(true);
    expect(inGreyZone(even, 0.37, 0.621)).toBe(false);
    expect(inGreyZone(favoured, 0.6, 0.4)).toBe(false);
    expect(COUNTER_BANDS.greyFrom).toBe(0.58);
  });
});

describe('ciAllowance', () => {
  it('is three standard errors of a pair over the sample, never under the full run’s 2 points', () => {
    expect(ciAllowance(300)).toBeCloseTo(0.0866, 4);
    expect(ciAllowance(200)).toBeCloseTo(0.1061, 4);
    expect(ciAllowance(1_000_000)).toBe(COUNTER_BANDS.nearWithin);
  });
});
