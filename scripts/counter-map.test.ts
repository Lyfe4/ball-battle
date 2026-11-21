import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import {
  checkCounter,
  ciAllowance,
  BEFORE_THE_FLOOR,
  COUNTER_MAP,
  counterFor,
  counterProblem,
  EVEN_PICKS,
  FIFTH_FROM_ONE_MECHANIC,
  findingsIn,
  labelOf,
  measuredOf,
  SHAPE,
  shapeWarning,
  STRONG_LIMITS,
  strongCountersIn,
  type CounterEntry,
} from './counter-map.ts';

const strong: CounterEntry = { x: 'a', y: 'b', intended: 'x', level: 'strong', reason: '' };
const edge: CounterEntry = { x: 'a', y: 'b', intended: 'x', level: 'edge', reason: '' };
const even: CounterEntry = { x: 'a', y: 'b', intended: 'even', reason: '' };

/** The balls the map says `id` beats and loses to outright (strong counters). */
function strongCountersOf(id: string): { beats: string[]; losesTo: string[] } {
  const beats: string[] = [];
  const losesTo: string[] = [];
  for (const entry of COUNTER_MAP) {
    if (entry.intended === 'even' || entry.level !== 'strong') continue;
    if (entry.x !== id && entry.y !== id) continue;
    const winner = entry.intended === 'x' ? entry.x : entry.y;
    const other = entry.x === id ? entry.y : entry.x;
    (winner === id ? beats : losesTo).push(other);
  }
  return { beats, losesTo };
}

/** The committed matchup sheet (`pnpm balance:matrix`, 500 seeds): each pair's two win rates. */
function sheet(): { a: string; b: string; aRate: number; bRate: number }[] {
  const text = readFileSync(new URL('../docs/balance-matrix.csv', import.meta.url), 'utf8');
  const id = (name: string) => BALLS.find((ball) => ball.name === name)?.id ?? name;
  return text
    .trim()
    .split('\n')
    .slice(1)
    .map((row) => {
      const [, a = '', b = '', aPct = '', bPct = ''] = row.split(',');
      return { a: id(a), b: id(b), aRate: Number(aPct) / 100, bRate: Number(bPct) / 100 };
    });
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

  it('labels every pair by the one rule, from the committed 500-seed sheet (ADR 0073)', () => {
    const rows = sheet();
    expect(rows).toHaveLength(COUNTER_MAP.length);
    const wrong = rows.flatMap(({ a, b, aRate, bRate }) => {
      const entry = counterFor(a, b);
      if (entry === undefined) return [`${a} vs ${b}: not in the map`];
      const measured = measuredOf(Math.max(aRate, bRate));
      const favoured = measured === 'even' ? undefined : aRate > bRate ? a : b;
      const mapFavoured = entry.intended === 'even' ? undefined : entry[entry.intended];
      return labelOf(entry) === measured && mapFavoured === favoured
        ? []
        : [`${a} vs ${b}: labelled ${labelOf(entry)}, measures ${measured}`];
    });
    expect(wrong).toStrictEqual([]);
  });

  it('gives every edge a reason of its own, short enough for a phone card', () => {
    for (const entry of COUNTER_MAP) {
      const pair = `${entry.x} vs ${entry.y}`;
      expect(entry.reason, pair).not.toMatch(/still to be written/i);
      // A favoured pair's reason says why one side leans, never that neither does.
      if (entry.intended !== 'even') {
        expect(entry.reason, pair).not.toMatch(/neither|evens out|: even\.?$/i);
      }
      expect(entry.reason.length, pair).toBeLessThanOrEqual(97);
    }
  });

  it('keeps every ball inside the hard limits on its strong counters (ADR 0076)', () => {
    for (const { id } of BALLS) {
      const { beats, losesTo } = strongCountersOf(id);
      expect(counterProblem(id, beats, losesTo), id).toBeUndefined();
    }
  });

  it('names exactly the ruleset 22 roster as added before the floor', () => {
    expect(BEFORE_THE_FLOOR).toStrictEqual(BALLS.slice(0, 28).map((ball) => ball.id));
  });

  it('keeps each even pick even against everyone but its listed counters (docs/vision.md)', () => {
    expect(Object.keys(EVEN_PICKS)).toStrictEqual(['brawler']);
    expect(EVEN_PICKS['brawler']?.losesTo).toStrictEqual(['thorns']);
    for (const [id, { beats, losesTo }] of Object.entries(EVEN_PICKS)) {
      const own = strongCountersOf(id);
      expect([...own.beats].sort(), id).toStrictEqual([...beats].sort());
      expect([...own.losesTo].sort(), id).toStrictEqual([...losesTo].sort());
    }
  });
});

describe('counterProblem', () => {
  const some = (count: number) => Array.from({ length: count }, (_, i) => `ball-${String(i)}`);

  it('fails a seventh strong win or loss on any ball', () => {
    expect(STRONG_LIMITS).toStrictEqual({ most: 6, newFewest: 2 });
    expect(counterProblem('titan', some(6), some(6))).toBeUndefined();
    expect(counterProblem('titan', some(7), some(2))).toBe('7 strong wins, at most 6');
    expect(counterProblem('titan', some(2), some(7))).toBe('7 strong losses, at most 6');
    expect(counterProblem('cowboy', some(7), some(3))).toBeDefined();
  });

  it('holds the Vampire to the same limit as every ball (its allowance went in ruleset 23)', () => {
    expect(counterProblem('vampire', some(3), some(6))).toBeUndefined();
    expect(counterProblem('vampire', some(3), some(7))).toBe('7 strong losses, at most 6');
  });

  it('needs 2 strong wins and 2 strong losses of a ball added after ruleset 22', () => {
    expect(counterProblem('cowboy', some(2), some(2))).toBeUndefined();
    expect(counterProblem('cowboy', some(6), some(2))).toBeUndefined();
    expect(counterProblem('cowboy', some(1), some(3))).toBe(
      'a new ball needs 2+ strong wins and losses, has 1/3',
    );
    expect(counterProblem('cowboy', some(3), some(1))).toBeDefined();
    // The balls before the floor keep what they have: the Slime beats one and loses to none.
    expect(counterProblem('slime', some(1), some(0))).toBeUndefined();
    expect(counterProblem('brawler', some(0), some(1))).toBeUndefined();
  });
});

describe('shapeWarning', () => {
  const some = (count: number) => Array.from({ length: count }, (_, i) => `ball-${String(i)}`);

  it('warns on any ball off SHAPE, with its counts', () => {
    expect(SHAPE).toStrictEqual({ fewest: 2, most: 4, within: 1 });
    expect(shapeWarning('venom', some(2), some(3))).toBeUndefined();
    expect(shapeWarning('venom', some(4), some(4))).toBeUndefined();
    expect(shapeWarning('venom', some(1), some(2))).toBe('1/2, the shape wants 2-4 strong wins');
    expect(shapeWarning('venom', some(5), some(4))).toBeDefined();
    expect(shapeWarning('venom', some(2), some(4))).toBe(
      '2/4, the shape wants wins and losses within 1',
    );
    // Today's balls off the shape warn; none is excused by name.
    expect(shapeWarning('speedster', some(3), some(5))).toBeDefined();
    expect(shapeWarning('slime', some(1), some(0))).toBeDefined();
  });

  it('allows a fifth on one side only where one visible mechanic gives it', () => {
    expect(Object.keys(FIFTH_FROM_ONE_MECHANIC)).toStrictEqual(['bloom']);
    // The Bloom may lose to five (any hit shuts the bud), still within 1 of its wins.
    expect(shapeWarning('bloom', some(4), some(5))).toBeUndefined();
    expect(shapeWarning('bloom', some(4), some(6))).toBeDefined();
    expect(shapeWarning('bloom', some(3), some(5))).toBeDefined();
    expect(shapeWarning('bloom', some(5), some(5))).toBeDefined();
  });

  it('holds an even pick to exactly its listed counters', () => {
    expect(shapeWarning('brawler', [], ['thorns'])).toBeUndefined();
    expect(shapeWarning('brawler', ['ghost'], ['thorns'])).toBeDefined();
  });
});

describe('strongCountersIn', () => {
  const pairs = [
    { x: 'thorns', y: 'brawler', xRate: 0.7, yRate: 0.29 },
    { x: 'storm', y: 'thorns', xRate: 0.6, yRate: 0.39 },
    { x: 'storm', y: 'brawler', xRate: 0.3, yRate: 0.66 },
  ];

  it('counts measured strong counters only in a full run, and the map’s in the CI check', () => {
    const measured = strongCountersIn(['thorns', 'brawler'], pairs, false);
    expect(measured).toStrictEqual([
      { id: 'thorns', beats: ['brawler'], losesTo: [] },
      { id: 'brawler', beats: ['storm'], losesTo: ['thorns'] },
    ]);
    // The map calls the Brawler and the Storm even, so the CI check doesn't count that pair.
    const fromMap = strongCountersIn(['brawler'], pairs, true);
    expect(fromMap).toStrictEqual([{ id: 'brawler', beats: [], losesTo: ['thorns'] }]);
  });

  it('turns each finding into "ball: finding"', () => {
    const counters = strongCountersIn(['thorns', 'brawler'], pairs, false);
    expect(findingsIn(counters, shapeWarning)).toStrictEqual([
      'thorns: 1/0, the shape wants 2-4 strong wins',
      'brawler: an even pick beats nobody and loses to thorns only',
    ]);
    expect(findingsIn(counters, counterProblem)).toStrictEqual([]);
  });
});

describe('measuredOf', () => {
  it('labels by the better side: 65% or more strong, 58% up to 65% an edge, else even', () => {
    expect(measuredOf(0.78)).toBe('strong');
    expect(measuredOf(0.65)).toBe('strong');
    expect(measuredOf(650 / 1000)).toBe('strong');
    expect(measuredOf(0.6499)).toBe('edge');
    expect(measuredOf(0.58)).toBe('edge');
    expect(measuredOf(580 / 1000)).toBe('edge');
    expect(measuredOf(0.5799)).toBe('even');
    expect(measuredOf(0.5)).toBe('even');
  });
});

describe('checkCounter', () => {
  it('passes a strong counter at 68-75%, warns at 65-68% and 75-78%, misses outside 65-78%', () => {
    expect(checkCounter(strong, 0.7, 0.29)).toBe('ok');
    expect(checkCounter(strong, 0.68, 0.31)).toBe('ok');
    expect(checkCounter(strong, 0.75, 0.25)).toBe('ok');
    expect(checkCounter(strong, 0.66, 0.33)).toBe('warn');
    expect(checkCounter(strong, 0.65, 0.35)).toBe('warn');
    expect(checkCounter(strong, 0.77, 0.23)).toBe('warn');
    expect(checkCounter(strong, 0.78, 0.22)).toBe('warn');
    expect(checkCounter(strong, 0.649, 0.35)).toBe('miss');
    expect(checkCounter(strong, 0.781, 0.21)).toBe('miss');
    expect(checkCounter({ ...strong, intended: 'y' }, 0.29, 0.7)).toBe('ok');
  });

  it('passes an edge at 59-64%, warns within a point of 58% or 65%, misses outside 58-65%', () => {
    expect(checkCounter(edge, 0.61, 0.38)).toBe('ok');
    expect(checkCounter(edge, 0.59, 0.4)).toBe('ok');
    expect(checkCounter(edge, 0.64, 0.35)).toBe('ok');
    expect(checkCounter(edge, 0.585, 0.41)).toBe('warn');
    expect(checkCounter(edge, 0.58, 0.41)).toBe('warn');
    expect(checkCounter(edge, 0.645, 0.35)).toBe('warn');
    // 65% is a strong counter, so an edge there is mislabelled.
    expect(checkCounter(edge, 0.65, 0.35)).toBe('miss');
    expect(checkCounter(edge, 0.579, 0.42)).toBe('miss');
  });

  it('passes an even pair with neither side over 55%, warns at 55-58%, misses at 58%', () => {
    expect(checkCounter(even, 0.5, 0.49)).toBe('ok');
    expect(checkCounter(even, 0.45, 0.55)).toBe('ok');
    expect(checkCounter(even, 0.56, 0.43)).toBe('warn');
    expect(checkCounter(even, 0.42, 0.575)).toBe('warn');
    expect(checkCounter(even, 0.58, 0.41)).toBe('miss');
    expect(checkCounter(even, 0.38, 0.6)).toBe('miss');
  });

  it('has no gap and no grey zone: every rate passes exactly one label', () => {
    for (let wins = 500; wins <= 780; wins += 1) {
      const rate = wins / 1000;
      const passing = [strong, edge, even].filter(
        (entry) => checkCounter(entry, rate, 1 - rate) !== 'miss',
      );
      expect(passing.map(labelOf), String(rate)).toStrictEqual([measuredOf(rate)]);
    }
  });

  it('has no NEAR in a full run, and passes a near miss as NEAR in the CI check', () => {
    expect(checkCounter(strong, 0.64, 0.36)).toBe('miss');
    expect(checkCounter(strong, 0.64, 0.36, ciAllowance(300))).toBe('near');
    expect(checkCounter(edge, 0.55, 0.45, ciAllowance(300))).toBe('near');
    expect(checkCounter(edge, 0.49, 0.5, ciAllowance(300))).toBe('miss');
    expect(checkCounter(even, 0.36, 0.64, ciAllowance(300))).toBe('near');
  });
});

describe('ciAllowance', () => {
  it('is three standard errors of a pair over the sample', () => {
    expect(ciAllowance(300)).toBeCloseTo(0.0866, 4);
    expect(ciAllowance(200)).toBeCloseTo(0.1061, 4);
  });
});
