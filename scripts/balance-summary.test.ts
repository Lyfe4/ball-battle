import { describe, expect, it } from 'vitest';
import {
  intendedGroup,
  LOPSIDED_GAP,
  lopsidedBalls,
  measuredGroup,
  summarise,
  summaryLines,
  summaryMarkdown,
} from './balance-summary.ts';

describe('measuredGroup', () => {
  it('puts a counter’s rate (62% or more, or 38% or less) in strong or weak', () => {
    expect(measuredGroup(0.62)).toBe('strong');
    expect(measuredGroup(0.619)).toBe('even');
    expect(measuredGroup(0.5)).toBe('even');
    expect(measuredGroup(0.381)).toBe('even');
    expect(measuredGroup(0.38)).toBe('weak');
  });
});

describe('intendedGroup', () => {
  it('reads the counter map from either side', () => {
    expect(intendedGroup('thorns', 'brawler')).toBe('strong');
    expect(intendedGroup('brawler', 'thorns')).toBe('weak');
    expect(intendedGroup('brawler', 'storm')).toBe('even');
  });
});

describe('summarise', () => {
  // Thorns is favoured over the Brawler by the map; the Brawler is even with the Archer.
  const balls = [
    { id: 'brawler', name: 'Brawler' },
    { id: 'thorns', name: 'Thorns' },
    { id: 'archer', name: 'Archer' },
  ];
  const pairs = [
    { x: 'brawler', y: 'thorns', xRate: 0.36, yRate: 0.63 },
    { x: 'brawler', y: 'archer', xRate: 0.5, yRate: 0.49 },
    { x: 'thorns', y: 'archer', xRate: 0.3, yRate: 0.68 },
  ];
  const [brawler, thorns] = summarise(balls, () => 0.5, pairs);

  it('reads each pair from both sides, grouped by the map and by the result', () => {
    expect(brawler?.byMap.groups.weak).toStrictEqual({ count: 1, average: 0.36 });
    expect(brawler?.byMap.groups.even).toStrictEqual({ count: 1, average: 0.5 });
    expect(brawler?.byMap.groups.strong).toStrictEqual({ count: 0, average: undefined });
    expect(brawler?.measured.groups.weak.count).toBe(1);
    // Thorns: strong vs the Brawler by the map and the result; the Archer is weak for it by the map and the result.
    expect(thorns?.byMap.groups.strong).toStrictEqual({ count: 1, average: 0.63 });
    expect(thorns?.byMap.groups.weak.count).toBe(1);
    expect(thorns?.measured.groups.strong.count).toBe(1);
    expect(thorns?.measured.groups.weak).toStrictEqual({ count: 1, average: 0.3 });
    expect(thorns?.measured.gap).toBe(0);
  });

  it(`warns when strong and weak differ by ${String(LOPSIDED_GAP)} or more`, () => {
    const opponents = ['a', 'b', 'c', 'd', 'e'];
    const lopsided = summarise(
      [{ id: 'x', name: 'X' }],
      () => 0.6,
      opponents.map((y, index) => ({
        x: 'x',
        y,
        xRate: [0.65, 0.65, 0.3, 0.5, 0.5][index] ?? 0.5,
        yRate: 0.3,
      })),
    );
    expect(lopsided[0]?.measured.gap).toBe(1);
    expect(lopsided[0]?.measured.lopsided).toBe(false);
    const more = summarise(
      [{ id: 'x', name: 'X' }],
      () => 0.6,
      opponents.map((y) => ({ x: 'x', y, xRate: 0.65, yRate: 0.3 })),
    );
    expect(more[0]?.measured.lopsided).toBe(true);
    expect(lopsidedBalls(more).map((ball) => ball.id)).toStrictEqual(['x']);
  });

  it('prints a row per ball, and the same rows as a Markdown table', () => {
    const summaries = summarise(balls, () => 0.5, pairs);
    expect(summaryLines(summaries)).toHaveLength(1 + balls.length);
    const markdown = summaryMarkdown(summaries, {
      seeds: 500,
      ruleset: 2,
      command: 'pnpm balance:summary',
    });
    expect(markdown).toContain('| Thorns | 50.0% | 1 (63.0%) | 0 | 1 (30.0%) | 0 |');
    expect(markdown).toContain('`pnpm balance:summary`');
    expect(markdown).toContain('## Below target\n');
    expect(markdown).toContain('| Thorns | Brawler 63.0% | Archer 30.0% |');
    expect(markdown).toContain('| Brawler | - | Thorns 36.0% |');
    expect(markdown).toContain('None.');
  });

  it('lists every pair below its target band in the summary file', () => {
    const summaries = summarise(balls, () => 0.5, pairs);
    const markdown = summaryMarkdown(summaries, { seeds: 500, ruleset: 3, command: 'x' }, [
      { pair: 'Storm vs Thorns', intended: 'Storm favoured', rates: '56.7%' },
      { pair: 'Thorns vs Frost', intended: 'even', rates: '57.1% / 41.6%' },
    ]);
    expect(markdown).toContain('| Storm vs Thorns | Storm favoured | 56.7% |');
    expect(markdown).toContain('| Thorns vs Frost | even | 57.1% / 41.6% |');
    expect(markdown).not.toContain('None.');
  });
});
