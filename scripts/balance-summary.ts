// Each ball's shape for `pnpm balance`: its overall win rate, and how many opponents it is a strong
// counter to, has an edge on, is even with, is edged by and is countered by (ADR 0073), by the
// counter map (what the game says) and by the measured results (what the fights do), with its
// average win rate in each group. Pure, so it is tested without playing matches;
// `pnpm balance --write-summary` writes it to docs/balance-summary.md.
import { standingOf } from '../src/sim/counter-map.ts';
import {
  EVEN_PICKS,
  FIFTH_FROM_ONE_MECHANIC,
  LEVEL_BANDS,
  measuredOf,
  SHAPE,
  shapeWarning,
  STRONG_LIMITS,
  type StrongCounters,
} from './counter-map.ts';

/** A ball's standing against one opponent: strong, an edge, even, edged, or weak (countered). */
export type Group = 'strong' | 'edge' | 'even' | 'edged' | 'weak';
export const GROUPS: readonly Group[] = ['strong', 'edge', 'even', 'edged', 'weak'];

/** How each group is headed in the summary. */
const GROUP_TITLES: Readonly<Record<Group, string>> = {
  strong: '▲▲ strong',
  edge: '▲ edge',
  even: '= even',
  edged: '▼ edge',
  weak: '▼▼ strong',
};

/**
 * A ball is lopsided when its strong wins and losses differ by this many or more: the shape wants
 * them within 1 (ADR 0045, group 4, ADR 0073). Marked in the gap column; like the whole shape, a
 * warning, not a failure (ADR 0076).
 */
export const LOPSIDED_GAP = 2;

/** The measured group of a pair, from the ball's own win rate and its opponent's (ADR 0073). */
export function measuredGroup(rate: number, theirs: number): Group {
  const level = measuredOf(Math.max(rate, theirs));
  if (level === 'even') return 'even';
  if (rate >= theirs) return level === 'strong' ? 'strong' : 'edge';
  return level === 'strong' ? 'weak' : 'edged';
}

export interface GroupStats {
  readonly count: number;
  /** The ball's average win rate against the group; undefined when the group is empty. */
  readonly average: number | undefined;
}

export interface Shape {
  readonly groups: Readonly<Record<Group, GroupStats>>;
  /** Strong wins minus strong losses: positive leans strong. */
  readonly gap: number;
  readonly lopsided: boolean;
}

export interface BallSummary {
  readonly id: string;
  readonly name: string;
  readonly winRate: number;
  /** Grouped by the counter map's levels. */
  readonly byMap: Shape;
  /** Grouped by the measured win rates against each opponent. */
  readonly measured: Shape;
  /** The map's strong counters for the ball, each with its measured win rate, sharpest first. */
  readonly beats: readonly MatchupRate[];
  readonly losesTo: readonly MatchupRate[];
  /** The map's edges for and against the ball, the same way. */
  readonly edges: readonly MatchupRate[];
  readonly edgedBy: readonly MatchupRate[];
}

export interface MatchupRate {
  readonly opponent: string;
  /** The ball's win rate against `opponent` (draws count as games). */
  readonly rate: number;
  /** The opponent's win rate against the ball. */
  readonly theirs: number;
  /** What the counter map says of the ball against `opponent`. */
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
  const groups = Object.fromEntries(GROUPS.map((group) => [group, stats(group)])) as Record<
    Group,
    GroupStats
  >;
  const gap = groups.strong.count - groups.weak.count;
  return { groups, gap, lopsided: Math.abs(gap) >= LOPSIDED_GAP };
}

export function summariseBall(
  ball: { readonly id: string; readonly name: string },
  winRate: number,
  matchups: readonly MatchupRate[],
): BallSummary {
  const sharpest = (group: Group) =>
    matchups.filter((m) => m.intended === group).sort((p, q) => q.rate - p.rate);
  const worst = (group: Group) =>
    matchups.filter((m) => m.intended === group).sort((p, q) => p.rate - q.rate);
  return {
    id: ball.id,
    name: ball.name,
    winRate,
    byMap: shapeOf(matchups.map(({ rate, intended }) => ({ rate, group: intended }))),
    measured: shapeOf(
      matchups.map(({ rate, theirs }) => ({ rate, group: measuredGroup(rate, theirs) })),
    ),
    beats: sharpest('strong'),
    losesTo: worst('weak'),
    edges: sharpest('edge'),
    edgedBy: worst('edged'),
  };
}

/** What the counter map says of `ball` against `opponent`. */
export function intendedGroup(ball: string, opponent: string): Group {
  const groups: Readonly<Record<string, Group>> = {
    '2': 'strong',
    '1': 'edge',
    '0': 'even',
    '-1': 'edged',
    '-2': 'weak',
  };
  return groups[String(standingOf(ball, opponent))] ?? 'even';
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
      if (x === ball.id) {
        return [{ opponent: y, rate: xRate, theirs: yRate, intended: intendedGroup(x, y) }];
      }
      if (y === ball.id) {
        return [{ opponent: x, rate: yRate, theirs: xRate, intended: intendedGroup(y, x) }];
      }
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

/** The per-ball shape as console lines for `pnpm balance`: counts only, map then measured. */
export function summaryLines(summaries: readonly BallSummary[]): string[] {
  const counts = (s: Shape) =>
    `${GROUPS.map((group) => String(s.groups[group].count).padStart(2)).join(' ')}  ${gapText(s)}`.padEnd(
      26,
    );
  const head = `  ${'Ball'.padEnd(12)} ${'Win'.padStart(6)}   ${'Map: ▲▲ ▲ = ▼ ▼▼  gap'.padEnd(26)} Measured: ▲▲ ▲ = ▼ ▼▼  gap`;
  const rows = summaries.map(
    (ball) =>
      `  ${ball.name.padEnd(12)} ${percent(ball.winRate).padStart(6)}   ${counts(ball.byMap)} ${counts(ball.measured)}`,
  );
  return [head, ...rows];
}

export interface SummaryContext {
  readonly seeds: number;
  readonly ruleset: number;
  /** The command that regenerates the file. */
  readonly command: string;
}

/** A pair inside its level's band but off its aim (ADR 0073): warned, not failed. */
export interface BelowTarget {
  /** "Storm vs Thorns". */
  readonly pair: string;
  /** "Storm strong", "Storm edge", or "even". */
  readonly intended: string;
  /** The favoured side's rate, or both sides' for an even pair, as printed. */
  readonly rates: string;
}

const whole = (rate: number): string => `${String(Math.round(rate * 100))}%`;

/** The off-aim section of docs/balance-summary.md: every such pair, or "None.". */
export function belowTargetLines(pairs: readonly BelowTarget[]): string[] {
  const { strong, edge, even } = LEVEL_BANDS;
  const intro = [
    '## Off the aim',
    '',
    `Pairs inside their level's band but off its aim: a strong counter at ${whole(strong.low)}-${whole(strong.aim[0])} or`,
    `${whole(strong.aim[1])}-${whole(strong.high)}, an edge within 1 point of ${whole(edge.low)} or ${whole(edge.high)}, an even pair with a side`,
    `over ${whole(even.aim[1])}. A WARN in \`pnpm balance\`, a pair to sharpen rather than a failure (ADR 0073).`,
    '',
  ];
  if (pairs.length === 0) return [...intro, 'None.', ''];
  return [
    ...intro,
    '| Pair | Label | Result |',
    '| ---- | ----- | -----: |',
    ...pairs.map(({ pair, intended, rates }) => `| ${pair} | ${intended} | ${rates} |`),
    '',
  ];
}

/** docs/balance-summary.md: the same summary as a table, generated and committed. */
export function summaryMarkdown(
  summaries: readonly BallSummary[],
  context: SummaryContext,
  belowTarget: readonly BelowTarget[] = [],
  strongCounters: readonly StrongCounters[] = [],
): string {
  const cells = (shape: Shape) =>
    `${GROUPS.map((group) => cell(shape.groups[group])).join(' | ')} | ${gapText(shape)}`;
  const row = (ball: BallSummary) =>
    `| ${ball.name} | ${percent(ball.winRate)} | ${cells(ball.byMap)} | ${cells(ball.measured)} |`;
  const titles = (source: string) =>
    [...GROUPS.map((group) => `${source}: ${GROUP_TITLES[group]}`), `${source} gap`].join(' | ');
  const { strong, edge } = LEVEL_BANDS;
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
    `Three levels (ADR 0073): a strong counter wins ${whole(strong.low)} or more, an edge ${whole(edge.low)} up to ${whole(edge.high)},`,
    'anything closer is even. **Map** groups opponents by the counter map’s labels, **Measured** by',
    'the better side’s result in this run. **Gap** is strong wins minus strong losses (the shape counts',
    `strong counters only); WARN marks a gap of ${String(LOPSIDED_GAP)} or more either way, a prompt to look rather`,
    'than a failure.',
    '',
    `| Ball | Win | ${titles('Map')} | ${titles('Measured')} |`,
    `| ---- | --: | ${Array.from({ length: GROUPS.length * 2 + 2 }, () => '--:').join(' | ')} |`,
    ...summaries.map(row),
    '',
    ...counterLines(summaries),
    ...shapeLines(summaries, strongCounters),
    ...belowTargetLines(belowTarget),
  ].join('\n');
}

/** The counters section of docs/balance-summary.md: each ball's map levels, measured. */
export function counterLines(summaries: readonly BallSummary[]): string[] {
  const nameOf = (id: string) => summaries.find((ball) => ball.id === id)?.name ?? id;
  const list = (matchups: readonly MatchupRate[]) =>
    matchups.length === 0
      ? '-'
      : matchups.map(({ opponent, rate }) => `${nameOf(opponent)} ${percent(rate)}`).join(', ');
  return [
    '## Counters',
    '',
    'Each ball’s strong counters and edges by the map, with its measured win rate against each.',
    '',
    '| Ball | Beats (▲▲) | Edge on (▲) | Edged by (▼) | Loses to (▼▼) |',
    '| ---- | ---------- | ----------- | ------------ | ------------- |',
    ...summaries.map(
      (ball) =>
        `| ${ball.name} | ${list(ball.beats)} | ${list(ball.edges)} | ${list(ball.edgedBy)} | ${list(ball.losesTo)} |`,
    ),
    '',
  ];
}

/**
 * The shape section of docs/balance-summary.md: the hard limits, then every ball off the shape
 * (a warning since ADR 0076) with its measured strong counters.
 */
export function shapeLines(
  summaries: readonly BallSummary[],
  strongCounters: readonly StrongCounters[],
): string[] {
  const nameOf = (id: string) => summaries.find((ball) => ball.id === id)?.name ?? id;
  const evenPicks = Object.entries(EVEN_PICKS).map(
    ([id, { beats, losesTo }]) =>
      `${nameOf(id)} beats ${beats.map(nameOf).join(', ') || 'nobody'} and loses to ${losesTo.map(nameOf).join(', ')}`,
  );
  const fifths = Object.entries(FIFTH_FROM_ONE_MECHANIC).map(
    ([id, { side, mechanic }]) => `${nameOf(id)} (${side}: ${mechanic})`,
  );
  const off = strongCounters.flatMap(({ id, beats, losesTo }) =>
    shapeWarning(id, beats, losesTo) === undefined
      ? []
      : [`| ${nameOf(id)} | ${String(beats.length)} | ${String(losesTo.length)} |`],
  );
  return [
    '## The shape',
    '',
    `Hard limits (ADR 0076): no ball has more than ${String(STRONG_LIMITS.most)} strong wins or ${String(STRONG_LIMITS.most)} strong losses, and every`,
    `ball added after ruleset 22 has at least ${String(STRONG_LIMITS.newFewest)} of each.`,
    '',
    `The shape is a warning: ${String(SHAPE.fewest)}-${String(SHAPE.most)} strong counters each way, the two counts within ${String(SHAPE.within)}; a fifth on one`,
    `side where one visible mechanic gives it: ${fifths.join('; ') || 'none'}. The even pick has exactly its`,
    `counters: ${evenPicks.join('; ')}.`,
    '',
    ...(off.length === 0
      ? ['Every ball fits the shape.']
      : [
          'Off the shape in this run:',
          '',
          '| Ball | Strong wins | Strong losses |',
          '| ---- | ----------: | ------------: |',
          ...off,
        ]),
    '',
  ];
}
