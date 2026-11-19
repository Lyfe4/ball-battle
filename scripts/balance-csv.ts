// The matchup sheet for `pnpm balance:matrix`: every pair's result and every ball's counters as
// CSV, for reading in a spreadsheet. Pure, so it is tested without playing matches; the rates come
// from the same runs and the same band checks as `pnpm balance` (scripts/counter-map.ts).
import type { BallSummary } from './balance-summary.ts';
import { checkCounter, counterFor, labelOf, measuredOf, type CounterEntry } from './counter-map.ts';

/** One pair as played: x and y in roster order, win and draw counts over `games`. */
export interface PlayedPair {
  readonly x: string;
  readonly y: string;
  readonly xWins: number;
  readonly yWins: number;
  readonly draws: number;
  readonly games: number;
}

/** How a pair sits against its level's band, in the words of `pnpm balance` (ADR 0073). */
export type BandResult = 'pass' | 'warn' | 'miss';

/**
 * The band result for a pair (rates for the entry's own x and y) and a short note on why it is
 * not a plain pass: a full run has no NEAR, so a pair outside its band measures another level.
 */
export function bandResult(
  entry: CounterEntry,
  xRate: number,
  yRate: number,
): { readonly result: BandResult; readonly note: string } {
  const verdict = checkCounter(entry, xRate, yRate);
  if (verdict === 'ok') return { result: 'pass', note: '' };
  const measured = measuredOf(Math.max(xRate, yRate));
  if (verdict === 'warn') return { result: 'warn', note: 'off the aim' };
  return {
    result: 'miss',
    note: measured === labelOf(entry) ? 'outside the band' : `measures ${measured}`,
  };
}

const pct = (part: number, whole: number): string => ((part / whole) * 100).toFixed(1);

/** Quotes a CSV field when it needs it (RFC 4180). */
const field = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const line = (fields: readonly (string | number)[]): string => fields.map(field).join(',');

export const MATRIX_HEADER = [
  'ruleset',
  'ball_a',
  'ball_b',
  'a_win_pct',
  'b_win_pct',
  'draw_pct',
  'fights',
  'counter_map',
  'band',
  'band_note',
] as const;

/**
 * docs/balance-matrix.csv: one row per pair, ball A first in roster order. Win and draw rates are
 * shares of all fights, so a pair's three rates add up to 100.
 */
export function matrixCsv(
  pairs: readonly PlayedPair[],
  ruleset: number,
  nameOf: (id: string) => string,
): string {
  const rows = pairs.map((pair) => {
    const entry = counterFor(pair.x, pair.y);
    if (entry === undefined) throw new Error(`${pair.x} vs ${pair.y} is not in the counter map`);
    const xRate = pair.xWins / pair.games;
    const yRate = pair.yWins / pair.games;
    const [entryX, entryY] = entry.x === pair.x ? [xRate, yRate] : [yRate, xRate];
    const { result, note } = bandResult(entry, entryX, entryY);
    const map =
      entry.intended === 'even'
        ? 'even'
        : `${entry[entry.intended] === pair.x ? 'A' : 'B'} ${entry.level}`;
    return line([
      ruleset,
      nameOf(pair.x),
      nameOf(pair.y),
      pct(pair.xWins, pair.games),
      pct(pair.yWins, pair.games),
      pct(pair.draws, pair.games),
      pair.games,
      map,
      result,
      note,
    ]);
  });
  return [line(MATRIX_HEADER), ...rows].join('\n') + '\n';
}

export const BALLS_HEADER = [
  'ruleset',
  'ball',
  'win_pct',
  'counters_won',
  'counters_won_rates',
  'counters_lost',
  'counters_lost_rates',
  'edges_won',
  'edges_won_rates',
  'edges_lost',
  'edges_lost_rates',
  'weakest_counter',
  'weakest_counter_pct',
] as const;

/**
 * docs/balance-balls.csv: one row per ball, its overall win rate, and its strong counters and edges
 * by the map with its own win rate against each (wins sharpest first, losses worst first). Its weakest counter is
 * the ball it is favoured against that it beats least often; none for a ball that beats nobody.
 */
export function ballsCsv(summaries: readonly BallSummary[], ruleset: number): string {
  const nameOf = (id: string) => summaries.find((ball) => ball.id === id)?.name ?? id;
  const list = (matchups: BallSummary['beats']) =>
    matchups.map(({ opponent, rate }) => `${nameOf(opponent)} ${pct(rate, 1)}`).join('; ');
  const rows = summaries.map((ball) => {
    const weakest = ball.beats.at(-1);
    return line([
      ruleset,
      ball.name,
      pct(ball.winRate, 1),
      ball.beats.length,
      list(ball.beats),
      ball.losesTo.length,
      list(ball.losesTo),
      ball.edges.length,
      list(ball.edges),
      ball.edgedBy.length,
      list(ball.edgedBy),
      weakest === undefined ? '' : nameOf(weakest.opponent),
      weakest === undefined ? '' : pct(weakest.rate, 1),
    ]);
  });
  return [line(BALLS_HEADER), ...rows].join('\n') + '\n';
}
