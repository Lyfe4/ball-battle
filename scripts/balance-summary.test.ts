import { describe, expect, it } from 'vitest';
import {
  intendedGroup,
  LOPSIDED_GAP,
  measuredGroup,
  summarise,
  summaryLines,
  summaryMarkdown,
} from './balance-summary.ts';

describe('measuredGroup', () => {
  it('groups by the better side’s level, from the ball’s side (ADR 0073)', () => {
    expect(measuredGroup(0.65, 0.34)).toBe('strong');
    expect(measuredGroup(0.649, 0.35)).toBe('edge');
    expect(measuredGroup(0.58, 0.41)).toBe('edge');
    expect(measuredGroup(0.57, 0.42)).toBe('even');
    expect(measuredGroup(0.41, 0.58)).toBe('edged');
    expect(measuredGroup(0.3, 0.69)).toBe('weak');
  });
});

describe('intendedGroup', () => {
  it('reads the counter map’s level from either side', () => {
    expect(intendedGroup('thorns', 'brawler')).toBe('strong');
    expect(intendedGroup('brawler', 'thorns')).toBe('weak');
    expect(intendedGroup('storm', 'thorns')).toBe('edge');
    expect(intendedGroup('thorns', 'storm')).toBe('edged');
    expect(intendedGroup('brawler', 'storm')).toBe('even');
  });
});

describe('summarise', () => {
  // Thorns is a strong counter to the Brawler; the Storm has an edge on Thorns; the Brawler and
  // the Storm are even.
  const balls = [
    { id: 'brawler', name: 'Brawler' },
    { id: 'thorns', name: 'Thorns' },
    { id: 'storm', name: 'Storm' },
  ];
  const pairs = [
    { x: 'brawler', y: 'thorns', xRate: 0.3, yRate: 0.69 },
    { x: 'brawler', y: 'storm', xRate: 0.5, yRate: 0.49 },
    { x: 'thorns', y: 'storm', xRate: 0.38, yRate: 0.61 },
  ];
  const [brawler, thorns] = summarise(balls, () => 0.5, pairs);

  it('reads each pair from both sides, grouped by the map and by the result', () => {
    expect(brawler?.byMap.groups.weak).toStrictEqual({ count: 1, average: 0.3 });
    expect(brawler?.byMap.groups.even).toStrictEqual({ count: 1, average: 0.5 });
    expect(brawler?.byMap.groups.strong).toStrictEqual({ count: 0, average: undefined });
    expect(brawler?.measured.groups.weak.count).toBe(1);
    expect(thorns?.byMap.groups.strong).toStrictEqual({ count: 1, average: 0.69 });
    expect(thorns?.byMap.groups.edged).toStrictEqual({ count: 1, average: 0.38 });
    expect(thorns?.measured.groups.edged.count).toBe(1);
    // The gap counts strong counters only: Thorns is one up.
    expect(thorns?.measured.gap).toBe(1);
    expect(thorns?.beats.map((m) => m.opponent)).toStrictEqual(['brawler']);
    expect(thorns?.edgedBy.map((m) => m.opponent)).toStrictEqual(['storm']);
  });

  it(`warns when strong wins and losses differ by ${String(LOPSIDED_GAP)} or more`, () => {
    const opponents = ['a', 'b', 'c', 'd', 'e'];
    const lopsided = summarise(
      [{ id: 'x', name: 'X' }],
      () => 0.6,
      opponents.map((y, index) => ({
        x: 'x',
        y,
        xRate: [0.65, 0.65, 0.3, 0.5, 0.5][index] ?? 0.5,
        yRate: [0.3, 0.3, 0.65, 0.5, 0.5][index] ?? 0.5,
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
  });

  it('prints a row per ball, and the same rows as a Markdown table', () => {
    const summaries = summarise(balls, () => 0.5, pairs);
    expect(summaryLines(summaries)).toHaveLength(1 + balls.length);
    const markdown = summaryMarkdown(summaries, {
      seeds: 500,
      ruleset: 2,
      command: 'pnpm balance:summary',
    });
    expect(markdown).toContain('| Thorns | 50.0% | 1 (69.0%) | 0 | 0 | 1 (38.0%) | 0 | +1 |');
    expect(markdown).toContain('`pnpm balance:summary`');
    expect(markdown).toContain('## Off the aim\n');
    expect(markdown).toContain('| Thorns | Brawler 69.0% | - | Storm 38.0% | - |');
    expect(markdown).toContain('| Brawler | - | - | - | Thorns 30.0% |');
    expect(markdown).toContain('None.');
    expect(markdown).toContain('## The shape\n');
    expect(markdown).toContain('Every ball fits the shape.');
  });

  it('lists every ball off the shape as a warning, with its strong counters', () => {
    const summaries = summarise(balls, () => 0.5, pairs);
    const markdown = summaryMarkdown(
      summaries,
      { seeds: 500, ruleset: 3, command: 'x' },
      [],
      [
        { id: 'brawler', beats: [], losesTo: ['thorns'] },
        { id: 'thorns', beats: ['brawler'], losesTo: [] },
      ],
    );
    expect(markdown).toContain('Off the shape in this run:');
    expect(markdown).toContain('| Thorns | 1 | 0 |');
    // The even pick fits with exactly its counters.
    expect(markdown).not.toContain('| Brawler | 0 | 1 |');
    expect(markdown).toContain('no ball has more than 6 strong wins or 6 strong losses');
    expect(markdown).toContain('Brawler beats nobody and loses to Thorns');
  });

  it('lists every pair off its aim in the summary file', () => {
    const summaries = summarise(balls, () => 0.5, pairs);
    const markdown = summaryMarkdown(summaries, { seeds: 500, ruleset: 3, command: 'x' }, [
      { pair: 'Storm vs Thorns', intended: 'Storm strong', rates: '66.7%' },
      { pair: 'Thorns vs Frost', intended: 'even', rates: '57.1% / 41.6%' },
    ]);
    expect(markdown).toContain('| Storm vs Thorns | Storm strong | 66.7% |');
    expect(markdown).toContain('| Thorns vs Frost | even | 57.1% / 41.6% |');
    expect(markdown).not.toContain('None.');
  });
});
