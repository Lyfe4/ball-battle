// Pure analysis for the aiming measurements (docs/aiming-measurements.md): folding mirror-image
// directions, an honest best-direction gain, and the blind simultaneous aiming game. Tested
// without running matches.
import type { AimResult } from './aim-play.ts';

/** Win counts for one side over some games. */
export interface Tally {
  readonly wins: number;
  readonly losses: number;
  readonly games: number;
}

export const EMPTY: Tally = { wins: 0, losses: 0, games: 0 };

export const tallyOf = (result: AimResult): Tally => ({
  wins: result.winsP,
  losses: result.winsQ,
  games: result.games,
});

export const add = (a: Tally, b: Tally): Tally => ({
  wins: a.wins + b.wins,
  losses: a.losses + b.losses,
  games: a.games + b.games,
});

/** Win rate over all games (draws count as games, as in `pnpm balance`). */
export const rate = (tally: Tally): number => (tally.games === 0 ? NaN : tally.wins / tally.games);

/** Zero-sum payoff in [-1, 1]: wins minus losses per game. */
export const margin = (tally: Tally): number =>
  tally.games === 0 ? 0 : (tally.wins - tally.losses) / tally.games;

/**
 * Index of the mirror-image direction: the arena is symmetric about its middle line, so turning
 * θ towards the bottom wall is the same as turning θ towards the top one.
 */
export const mirrorIndex = (index: number, directions: number): number =>
  (directions - index) % directions;

/**
 * Merges each direction with its mirror image: entry k of the result (k = 0..directions/2) is
 * direction k plus direction −k (once for 0 and 180°, which are their own mirrors).
 */
export function fold(perDirection: readonly Tally[]): Tally[] {
  const n = perDirection.length;
  return Array.from({ length: n / 2 + 1 }, (_, k) => {
    const own = perDirection[k] ?? EMPTY;
    const mirror = mirrorIndex(k, n);
    return mirror === k ? own : add(own, perDirection[mirror] ?? EMPTY);
  });
}

const argBest = (values: readonly number[], better: (a: number, b: number) => boolean): number =>
  values.reduce((best, value, index) => (better(value, values[best] ?? value) ? index : best), 0);

export interface DirectionSummary {
  /** Index (into the folded list) of the best direction on all the seeds. */
  readonly best: number;
  readonly worst: number;
  /** Best direction's win rate minus random aim's, chosen on one half, measured on the other. */
  readonly gain: number;
  /** Best minus worst direction, chosen on one half and measured on the other. */
  readonly spread: number;
  /** The best direction on each half: they agree when the best direction is stable across seeds. */
  readonly bestByHalf: readonly [number, number];
}

/**
 * Cross-validated summary of one ordered matchup: `halves[h][k]` is folded direction k on seed
 * half h, `reference[h]` random aim on the same seeds. Picking the best of many noisy rates and
 * reading its own rate overstates it; picking on one half and reading the other doesn't. Both
 * ways round are averaged.
 */
export function summarise(
  halves: readonly [readonly Tally[], readonly Tally[]],
  reference: readonly [Tally, Tally],
): DirectionSummary {
  const rates = halves.map((half) => half.map(rate));
  const all = halves[0].map((tally, k) => rate(add(tally, halves[1][k] ?? EMPTY)));
  const pick = (h: 0 | 1) => ({
    best: argBest(rates[h] ?? [], (a, b) => a > b),
    worst: argBest(rates[h] ?? [], (a, b) => a < b),
  });
  const crossed = ([0, 1] as const).map((h) => {
    const other = h === 0 ? 1 : 0;
    const chosen = pick(h);
    const otherRates = rates[other] ?? [];
    return {
      gain: (otherRates[chosen.best] ?? NaN) - rate(reference[other]),
      spread: (otherRates[chosen.best] ?? NaN) - (otherRates[chosen.worst] ?? NaN),
    };
  });
  return {
    best: argBest(all, (a, b) => a > b),
    worst: argBest(all, (a, b) => a < b),
    gain: ((crossed[0]?.gain ?? NaN) + (crossed[1]?.gain ?? NaN)) / 2,
    spread: ((crossed[0]?.spread ?? NaN) + (crossed[1]?.spread ?? NaN)) / 2,
    bestByHalf: [pick(0).best, pick(1).best],
  };
}

export interface GameSolution {
  /** Mixed strategy of the row player (P), summing to 1. */
  readonly row: readonly number[];
  /** Mixed strategy of the column player (Q). */
  readonly column: readonly number[];
  /** Estimated value for P (zero-sum payoff), between the two bounds. */
  readonly value: number;
  /** P can guarantee at least this with `row`. */
  readonly lower: number;
  /** Q can hold P to at most this with `column`. */
  readonly upper: number;
}

/** P's expected payoff for each pure row against Q's mixed strategy. */
export function rowPayoffs(payoff: readonly (readonly number[])[], column: readonly number[]) {
  return payoff.map((row) => row.reduce((sum, value, j) => sum + value * (column[j] ?? 0), 0));
}

/** Q's expected payoff to P for each pure column against P's mixed strategy. */
export function columnPayoffs(payoff: readonly (readonly number[])[], row: readonly number[]) {
  const columns = payoff[0]?.length ?? 0;
  return Array.from({ length: columns }, (_, j) =>
    payoff.reduce((sum, values, i) => sum + (values[j] ?? 0) * (row[i] ?? 0), 0),
  );
}

/**
 * Solves a zero-sum matrix game (P picks a row to maximise, Q a column to minimise) by fictitious
 * play: each round both best-respond to the other's empirical mix. It converges to the game's
 * value for zero-sum games; the bounds say how close it got.
 */
export function solveZeroSum(
  payoff: readonly (readonly number[])[],
  rounds = 20_000,
): GameSolution {
  const rows = payoff.length;
  const columns = payoff[0]?.length ?? 0;
  const rowCounts = new Array<number>(rows).fill(0);
  const columnCounts = new Array<number>(columns).fill(0);
  const rowTotals = new Array<number>(rows).fill(0); // P's payoff of each row vs Q's history
  const columnTotals = new Array<number>(columns).fill(0); // P's payoff of each column vs P's history
  let i = 0;
  let j = 0;
  for (let round = 0; round < rounds; round++) {
    rowCounts[i] = (rowCounts[i] ?? 0) + 1;
    columnCounts[j] = (columnCounts[j] ?? 0) + 1;
    for (let r = 0; r < rows; r++) rowTotals[r] = (rowTotals[r] ?? 0) + (payoff[r]?.[j] ?? 0);
    for (let c = 0; c < columns; c++) {
      columnTotals[c] = (columnTotals[c] ?? 0) + (payoff[i]?.[c] ?? 0);
    }
    i = argBest(rowTotals, (a, b) => a > b);
    j = argBest(columnTotals, (a, b) => a < b);
  }
  const row = rowCounts.map((count) => count / rounds);
  const column = columnCounts.map((count) => count / rounds);
  const lower = Math.min(...columnPayoffs(payoff, row));
  const upper = Math.max(...rowPayoffs(payoff, column));
  return { row, column, value: (lower + upper) / 2, lower, upper };
}

/** P's best pure row against Q's mix, and Q's best pure column against P's mix. */
export const bestRow = (payoff: readonly (readonly number[])[], column: readonly number[]) =>
  argBest(rowPayoffs(payoff, column), (a, b) => a > b);
export const bestColumn = (payoff: readonly (readonly number[])[], row: readonly number[]) =>
  argBest(columnPayoffs(payoff, row), (a, b) => a < b);
