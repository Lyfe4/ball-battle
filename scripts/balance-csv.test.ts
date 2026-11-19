import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';
import { BALLS_HEADER, ballsCsv, bandResult, MATRIX_HEADER, matrixCsv } from './balance-csv.ts';
import { summarise } from './balance-summary.ts';
import type { CounterEntry } from './counter-map.ts';

const counter: CounterEntry = { x: 'a', y: 'b', intended: 'x', reason: '' };
const even: CounterEntry = { x: 'a', y: 'b', intended: 'even', reason: '' };

describe('bandResult', () => {
  it('reads a counter against its target (65-72%) and floor (62-78%)', () => {
    expect(bandResult(counter, 0.69, 0.3).result).toBe('pass');
    expect(bandResult(counter, 0.66, 0.33)).toStrictEqual({
      result: 'warn',
      note: 'near a target edge',
    });
    expect(bandResult(counter, 0.63, 0.36)).toStrictEqual({
      result: 'warn',
      note: 'below the target',
    });
    expect(bandResult(counter, 0.75, 0.24).note).toBe('above the target');
    expect(bandResult(counter, 0.61, 0.38).result).toBe('near');
    expect(bandResult(counter, 0.59, 0.4).result).toBe('miss');
  });

  it('reads the favoured side when the map favours the second ball', () => {
    expect(bandResult({ ...counter, intended: 'y' }, 0.3, 0.69).result).toBe('pass');
  });

  it('calls an even pair with a side at 58-62% the grey zone, but a miss a miss', () => {
    expect(bandResult(even, 0.5, 0.49).result).toBe('pass');
    expect(bandResult(even, 0.56, 0.43)).toStrictEqual({
      result: 'warn',
      note: 'outside the target',
    });
    expect(bandResult(even, 0.6, 0.39).result).toBe('grey zone');
    expect(bandResult(even, 0.66, 0.33).result).toBe('miss');
  });
});

describe('matrixCsv', () => {
  const name = (id: string) => id.toUpperCase();
  // The map favours Thorns over the Brawler; the Brawler and the Storm are even.
  const csv = matrixCsv(
    [
      { x: 'brawler', y: 'thorns', xWins: 31, yWins: 68, draws: 1, games: 100 },
      { x: 'brawler', y: 'storm', xWins: 50, yWins: 50, draws: 0, games: 100 },
    ],
    7,
    name,
  );

  it('writes one row per pair with rates as percentages of all fights', () => {
    expect(csv.split('\n')).toStrictEqual([
      MATRIX_HEADER.join(','),
      '7,BRAWLER,THORNS,31.0,68.0,1.0,100,B favoured,pass,',
      '7,BRAWLER,STORM,50.0,50.0,0.0,100,even,pass,',
      '',
    ]);
  });

  it('refuses a pair the counter map does not know', () => {
    expect(() =>
      matrixCsv([{ x: 'brawler', y: 'nobody', xWins: 1, yWins: 1, draws: 0, games: 2 }], 7, name),
    ).toThrow(/not in the counter map/);
  });
});

describe('ballsCsv', () => {
  it('lists counters with rates and names the weakest win; a ball that beats nobody has none', () => {
    const balls = [
      { id: 'brawler', name: 'Brawler' },
      { id: 'thorns', name: 'Thorns' },
      { id: 'magnet', name: 'Magnet' },
    ];
    const pairs = [
      { x: 'brawler', y: 'thorns', xRate: 0.25, yRate: 0.74 },
      { x: 'brawler', y: 'magnet', xRate: 0.5, yRate: 0.5 },
      { x: 'thorns', y: 'magnet', xRate: 0.7, yRate: 0.3 },
    ];
    const rows = ballsCsv(
      summarise(balls, () => 0.5, pairs),
      7,
    ).split('\n');
    expect(rows[0]).toBe(BALLS_HEADER.join(','));
    expect(rows[1]).toBe('7,Brawler,50.0,0,,1,Thorns 25.0,,');
    expect(rows[2]).toBe('7,Thorns,50.0,2,Brawler 74.0; Magnet 70.0,0,,Magnet,70.0');
  });
});

// The committed sheet must describe this build: run `pnpm balance:matrix` after a ruleset bump.
describe('the committed matchup sheet', () => {
  const read = (file: string) =>
    readFileSync(new URL(`../docs/${file}`, import.meta.url), 'utf8')
      .trim()
      .split('\n');

  it('docs/balance-matrix.csv has every pair once, for the current ruleset', () => {
    const [header, ...rows] = read('balance-matrix.csv');
    expect(header).toBe(MATRIX_HEADER.join(','));
    const names = BALLS.map((ball) => ball.name);
    const expected = names.flatMap((x, i) => names.slice(i + 1).map((y) => `${x},${y}`));
    expect(rows.map((row) => row.split(',').slice(1, 3).join(','))).toStrictEqual(expected);
    expect(rows.every((row) => row.startsWith(`${String(RULESET_VERSION)},`))).toBe(true);
  });

  it('docs/balance-balls.csv has every ball in roster order, for the current ruleset', () => {
    const [header, ...rows] = read('balance-balls.csv');
    expect(header).toBe(BALLS_HEADER.join(','));
    expect(rows.map((row) => row.split(',')[1])).toStrictEqual(BALLS.map((ball) => ball.name));
    expect(rows.every((row) => row.startsWith(`${String(RULESET_VERSION)},`))).toBe(true);
  });
});
