// Each ball's shape for `pnpm balance`: its overall win rate, and how many opponents it is strong,
// even and weak against, by the counter map (what the game says) and by the measured results
// (what the fights do), with its average win rate in each group. Pure, so it is tested without
// playing matches; `pnpm balance --write-summary` writes it to docs/balance-summary.md.
import { isFavoured } from '../src/sim/counter-map.ts';
import { COUNTER_BANDS } from './counter-map.ts';

export type Group = 'strong' | 'even' | 'weak';
export const GROUPS: readonly Group[] = ['strong', 'even', 'weak'];

/**
 * A ball is lopsided when its strong and weak counts differ by this many or more, out of 13
 * opponents (about 30% of them). A warning, not a failure: one-sided shapes are worth a look (they
 * make a ball a near-default pick, or a ball few would pick) but can be deliberate, like the
 * Brawler's all-even shape. At the time of writing the map flags the Magnet (+6), Quake (+4) and
 * Ghost (-4), matching what ADR 0026 called out; every other ball is within 3.
 */
export const LOPSIDED_GAP = 4;

/** The measured group of a win rate: outside the even band (45-55%) is strong or weak. */
export function measuredGroup(rate: number): Group {
  if (rate > COUNTER_BANDS.even[1]) return 'strong';
  if (rate < COUNTER_BANDS.even[0]) return 'weak';
  return 'even';
}

export interface GroupStats {
  readonly count: number;
  /** The ball's average win rate against the group; undefined when the group is empty. */
  readonly average: number | undefined;
}

export interface Shape {
  readonly groups: Readonly<Record<Group, GroupStats>>;
  /** Strong minus weak: positive leans strong. */
  readonly gap: number;
  readonly lopsided: boolean;
}

export interface BallSummary {
  readonly id: string;
  readonly name: string;
  readonly winRate: number;
  /** Grouped by the counter map's intended direction. */
  readonly byMap: Shape;
  /** Grouped by the measured win rate against each opponent. */
  readonly measured: Shape;
}

export interface MatchupRate {
  readonly opponent: string;
  /** The ball's win rate against `opponent` (draws count as games). */
  readonly rate: number;
  /** What the counter map intends for the ball. */
  readonly intended: Group;
}

function shapeOf(rates: readonly { readonly rate: number; readonly group: Group }[]): Shape {
  const stats = (group: Group): GroupStats => {
    const members = rates.filter((entry) => entry.group === group);
    return {
      count: members.length,
      average:
        members.length === 0
          ? undefined
          : members.reduce((sum, { rate }) => sum + rate, 0) / members.length,
    };
  };
  const groups = { strong: stats('strong'), even: stats('even'), weak: stats('weak') };
  const gap = groups.strong.count - groups.weak.count;
  return { groups, gap, lopsided: Math.abs(gap) >= LOPSIDED_GAP };
}

export function summariseBall(
  ball: { readonly id: string; readonly name: string },
  winRate: number,
  matchups: readonly MatchupRate[],
): BallSummary {
  return {
    id: ball.id,
    name: ball.name,
    winRate,
    byMap: shapeOf(matchups.map(({ rate, intended }) => ({ rate, group: intended }))),
    measured: shapeOf(matchups.map(({ rate }) => ({ rate, group: measuredGroup(rate) }))),
  };
}

/** What the counter map intends for `ball` against `opponent`. */
export function intendedGroup(ball: string, opponent: string): Group {
  if (isFavoured(ball, opponent)) return 'strong';
  if (isFavoured(opponent, ball)) return 'weak';
  return 'even';
}

/** One measured pair: each side's win rate (draws count as games). */
export interface PairRates {
  readonly x: string;
  readonly y: string;
  readonly xRate: number;
  readonly yRate: number;
}

/** Summaries for `balls` from the measured pairs; each ball's pairs must all have been played. */
export function summarise(
  balls: readonly { readonly id: string; readonly name: string }[],
  winRateOf: (id: string) => number,
  pairs: readonly PairRates[],
): BallSummary[] {
  return balls.map((ball) => {
    const matchups = pairs.flatMap(({ x, y, xRate, yRate }): MatchupRate[] => {
      if (x === ball.id) return [{ opponent: y, rate: xRate, intended: intendedGroup(x, y) }];
      if (y === ball.id) return [{ opponent: x, rate: yRate, intended: intendedGroup(y, x) }];
      return [];
    });
    return summariseBall(ball, winRateOf(ball.id), matchups);
  });
}

const percent = (rate: number | undefined): string =>
  rate === undefined ? '-' : `${(rate * 100).toFixed(1)}%`;

/** "5 (61.2%)": a group's count and its average win rate. */
const cell = ({ count, average }: GroupStats): string =>
  count === 0 ? '0' : `${String(count)} (${percent(average)})`;

const gapText = (shape: Shape): string =>
  `${shape.gap > 0 ? '+' : ''}${String(shape.gap)}${shape.lopsided ? ' WARN' : ''}`;

/** The per-ball shape as console lines for `pnpm balance`. */
export function summaryLines(summaries: readonly BallSummary[]): string[] {
  const head = `  ${'Ball'.padEnd(12)} ${'Win'.padStart(6)}   ${'Map: strong / even / weak'.padEnd(44)} ${'Measured: strong / even / weak'.padEnd(44)}`;
  const rows = summaries.map((ball) => {
    const shape = (s: Shape) =>
      `${GROUPS.map((group) => cell(s.groups[group])).join(' / ')}  ${gapText(s)}`.padEnd(44);
    return `  ${ball.name.padEnd(12)} ${percent(ball.winRate).padStart(6)}   ${shape(ball.byMap)} ${shape(ball.measured)}`;
  });
  return [head, ...rows];
}

/** Balls whose shape is lopsided by the map or the measured results, for the warnings. */
export function lopsidedBalls(summaries: readonly BallSummary[]): BallSummary[] {
  return summaries.filter((ball) => ball.byMap.lopsided || ball.measured.lopsided);
}

export interface SummaryContext {
  readonly seeds: number;
  readonly ruleset: number;
  /** The command that regenerates the file. */
  readonly command: string;
}

/** A pair inside its floor but outside its target band (ADR 0028 addendum): warned, not failed. */
export interface BelowTarget {
  /** "Storm vs Thorns". */
  readonly pair: string;
  /** "Storm favoured", or "even". */
  readonly intended: string;
  /** The favoured side's rate, or both sides' for an even pair, as printed. */
  readonly rates: string;
}

const band = ([low, high]: readonly [number, number]): string =>
  `${String(Math.round(low * 100))}-${String(Math.round(high * 100))}%`;

/** The below-target section of docs/balance-summary.md: every such pair, or "None.". */
export function belowTargetLines(pairs: readonly BelowTarget[]): string[] {
  const { kind, movement, even, kindFloor, movementFloor, evenFloor } = COUNTER_BANDS;
  const intro = [
    '## Below target',
    '',
    `Counter-map pairs inside their floor (kind ${band(kindFloor)}, movement`,
    `${band(movementFloor)}, even ${band(evenFloor)}) but outside their`,
    `target (kind ${band(kind)}, movement ${band(movement)}, even ${band(even)}): a WARN in`,
    '`pnpm balance`, a pair to sharpen rather than a failure (ADR 0028 addendum, ADR 0045).',
    '',
  ];
  if (pairs.length === 0) return [...intro, 'None.', ''];
  return [
    ...intro,
    '| Pair | Intended | Result |',
    '| ---- | -------- | -----: |',
    ...pairs.map(({ pair, intended, rates }) => `| ${pair} | ${intended} | ${rates} |`),
    '',
  ];
}

/** docs/balance-summary.md: the same summary as a table, generated and committed. */
export function summaryMarkdown(
  summaries: readonly BallSummary[],
  context: SummaryContext,
  belowTarget: readonly BelowTarget[] = [],
): string {
  const row = (ball: BallSummary) =>
    `| ${ball.name} | ${percent(ball.winRate)} | ${GROUPS.map((group) => cell(ball.byMap.groups[group])).join(' | ')} | ${gapText(ball.byMap)} | ${GROUPS.map((group) => cell(ball.measured.groups[group])).join(' | ')} | ${gapText(ball.measured)} |`;
  const flagged = lopsidedBalls(summaries);
  return [
    '# Balance summary',
    '',
    `<!-- Generated by \`${context.command}\`. Do not edit by hand. -->`,
    '',
    `Ruleset ${String(context.ruleset)}, ${String(context.seeds)} seeds per slot order, every`,
    'matchup (mirrors excluded). Regenerate after any change to a ball or the combat rules with',
    `\`${context.command}\`.`,
    '',
    'Each group is a count of opponents, with the ball’s average win rate against them in brackets.',
    '**By map** groups opponents by the counter map (favoured, even, unfavoured; ADR 0010).',
    `**Measured** groups them by the result: above ${percent(COUNTER_BANDS.even[1])} is strong, below`,
    `${percent(COUNTER_BANDS.even[0])} weak. **Gap** is strong minus weak; WARN marks a lopsided`,
    `shape (a gap of ${String(LOPSIDED_GAP)} or more either way), a prompt to look rather than a`,
    'failure.',
    '',
    '| Ball | Win | Map: strong | Map: even | Map: weak | Map gap | Measured: strong | Measured: even | Measured: weak | Measured gap |',
    '| ---- | --: | --: | --: | --: | --: | --: | --: | --: | --: |',
    ...summaries.map(row),
    '',
    flagged.length === 0
      ? 'No ball is lopsided.'
      : `Lopsided: ${flagged.map((ball) => ball.name).join(', ')}.`,
    '',
    ...belowTargetLines(belowTarget),
  ].join('\n');
}
