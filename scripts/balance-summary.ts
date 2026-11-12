// Each ball's shape for `pnpm balance`: its overall win rate, and how many opponents it is strong,
// even and weak against, by the counter map (what the game says) and by the measured results
// (what the fights do), with its average win rate in each group. Pure, so it is tested without
// playing matches; `pnpm balance --write-summary` writes it to docs/balance-summary.md.
import { isFavoured } from '../src/sim/counter-map.ts';
import { COUNTER_BANDS, EVEN_PICKS, SHAPE, SHAPE_EXCEPTIONS } from './counter-map.ts';

export type Group = 'strong' | 'even' | 'weak';
export const GROUPS: readonly Group[] = ['strong', 'even', 'weak'];

/**
 * A ball is lopsided when its strong and weak counts differ by this many or more: the shape rule
 * wants them within 1 (ADR 0045, group 4). A warning, not a failure; the map's own shape is pinned
 * by scripts/counter-map.test.ts.
 */
export const LOPSIDED_GAP = 2;

/**
 * The measured group of a win rate: a counter's 62% or more is strong, 38% or less weak (the other
 * side near 62%), everything between even (ADR 0045, group 4).
 */
export function measuredGroup(rate: number): Group {
  const counterAt = COUNTER_BANDS.counterFloor[0];
  if (rate >= counterAt) return 'strong';
  if (rate <= 1 - counterAt) return 'weak';
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
  /** The map's counters for the ball, each with its measured win rate, sharpest first. */
  readonly beats: readonly MatchupRate[];
  readonly losesTo: readonly MatchupRate[];
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
    beats: matchups.filter((m) => m.intended === 'strong').sort((p, q) => q.rate - p.rate),
    losesTo: matchups.filter((m) => m.intended === 'weak').sort((p, q) => p.rate - q.rate),
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
  const { counter, even, counterFloor, evenFloor } = COUNTER_BANDS;
  const intro = [
    '## Below target',
    '',
    `Counter-map pairs inside their floor (counter ${band(counterFloor)}, even ${band(evenFloor)})`,
    `but outside their target (counter ${band(counter)}, even ${band(even)}): a WARN in`,
    '`pnpm balance`, a pair to sharpen rather than a failure. An even pair with a side over 58%',
    'is in the grey zone (ADR 0045, group 4).',
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
    `**Measured** groups them by the result: ${percent(COUNTER_BANDS.counterFloor[0])} or more is strong,`,
    `${percent(1 - COUNTER_BANDS.counterFloor[0])} or less weak. **Gap** is strong minus weak; WARN marks a lopsided`,
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
    ...counterLines(summaries),
    ...gapLines(),
    ...belowTargetLines(belowTarget),
  ].join('\n');
}

/** The counters section of docs/balance-summary.md: each ball's ▲ and ▼ by the map, measured. */
export function counterLines(summaries: readonly BallSummary[]): string[] {
  const nameOf = (id: string) => summaries.find((ball) => ball.id === id)?.name ?? id;
  const list = (matchups: readonly MatchupRate[]) =>
    matchups.length === 0
      ? '-'
      : matchups.map(({ opponent, rate }) => `${nameOf(opponent)} ${percent(rate)}`).join(', ');
  return [
    '## Counters',
    '',
    'Each ball’s counters by the map, with its measured win rate against each.',
    '',
    '| Ball | Beats (▲) | Loses to (▼) |',
    '| ---- | --------- | ------------ |',
    ...summaries.map((ball) => `| ${ball.name} | ${list(ball.beats)} | ${list(ball.losesTo)} |`),
    '',
  ];
}

/**
 * The known gaps section of docs/balance-summary.md: the balls allowed off the roster's shape
 * (scripts/counter-map.ts), each a gap for a future ball to fill (ADR 0045, 0047, docs/vision.md).
 */
export function gapLines(): string[] {
  const name = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
  const evenPicks = Object.entries(EVEN_PICKS).map(
    ([id, { beats, losesTo }]) =>
      `${name(id)} beats ${beats.map(name).join(', ') || 'nobody'} and loses to ${losesTo.map(name).join(', ')}`,
  );
  return [
    '## Known gaps',
    '',
    `Every ball has ${String(SHAPE.fewest)}-${String(SHAPE.most)} counters each way, the two counts within ${String(SHAPE.within)}, except`,
    'these, which `pnpm balance` allows by name and nothing else: gaps for future balls to fill',
    `(ADR 0045, 0047, docs/vision.md). The even picks have exactly their counters: ${evenPicks.join('; ')}.`,
    '',
    '| Ball | Counters each way | Wins and losses within |',
    '| ---- | ----------------: | ---------------------: |',
    ...Object.entries(SHAPE_EXCEPTIONS).map(
      ([id, { fewest, most, within }]) =>
        `| ${name(id)} | ${String(fewest)}-${String(most)} | ${String(within)} |`,
    ),
    '',
  ];
}
