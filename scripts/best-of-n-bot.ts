// The Hard bot (ADR 0035) for a series of any odd lineup size, for the Best of 5 measurement
// (docs/best-of-5-measurements.md). Not used by the game: src/sim's hardBot is Best of 3 only.
//
// Two changes from src/sim/bot.ts and bot-model.ts, nothing else:
// - wins needed are a majority of the lineup, read from the view (balls left plus rounds played),
//   and positions are memoised, since a five-ball series has too many to search afresh each time;
// - Showdown's opener mixes over any number of balls: `maximinMix` here enumerates every square
//   support (Shapley-Snow), where src/sim's is exact only up to three rows.
// Plain arithmetic and comparisons only, like the sim, so a server could make the same choices.
import {
  HARD_SHOW_MARGIN,
  hardBot,
  type BotView,
  type LineupBot,
  type Weights,
} from '../src/sim/bot.ts';
import { mapOdds } from '../src/sim/bot-model.ts';
import { createStream, deriveSeed } from '../src/sim/rng.ts';
import type { Format } from '../src/sim/series.ts';

type Lead = 'bot' | 'opponent';

interface Position {
  readonly format: Format;
  readonly own: readonly string[];
  readonly opponent: readonly string[];
  readonly wins: number;
  readonly losses: number;
}

const without = (balls: readonly string[], ball: string) => balls.filter((id) => id !== ball);
const needOf = (p: Position) => Math.floor((p.own.length + p.wins + p.losses) / 2) + 1;

function nextLead(format: Format, lead: Lead, botWon: boolean): Lead {
  if (format === 'reveal') return lead === 'bot' ? 'opponent' : 'bot';
  return botWon ? 'bot' : 'opponent';
}

const memo = new Map<string, number>();
const keyOf = (p: Position, lead: Lead) =>
  `${p.format}|${[...p.own].sort().join()}|${[...p.opponent].sort().join()}|${String(p.wins)}${String(p.losses)}|${lead}`;

/** The bot's series chance once this round pairs `ball` with `against`, best play after. */
export function afterRoundN(position: Position, lead: Lead, ball: string, against: string): number {
  const odds = mapOdds(ball, against);
  const rest = {
    ...position,
    own: without(position.own, ball),
    opponent: without(position.opponent, against),
  };
  const won = seriesValueN(
    { ...rest, wins: position.wins + 1 },
    nextLead(position.format, lead, true),
  );
  const lost = seriesValueN(
    { ...rest, losses: position.losses + 1 },
    nextLead(position.format, lead, false),
  );
  return odds * won + (1 - odds) * lost;
}

/** As bot-model.ts's seriesValue, for any lineup size, memoised. */
export function seriesValueN(position: Position, lead: Lead): number {
  const need = needOf(position);
  if (position.wins >= need) return 1;
  if (position.losses >= need) return 0;
  const [own, against] = [position.own[0], position.opponent[0]];
  if (position.own.length === 1 && own !== undefined && against !== undefined) {
    return mapOdds(own, against);
  }
  const key = keyOf(position, lead);
  const known = memo.get(key);
  if (known !== undefined) return known;
  const value = (ball: string, other: string) => afterRoundN(position, lead, ball, other);
  const result =
    lead === 'bot'
      ? Math.max(...position.own.map((b) => Math.min(...position.opponent.map((y) => value(b, y)))))
      : Math.min(
          ...position.opponent.map((y) => Math.max(...position.own.map((b) => value(b, y)))),
        );
  memo.set(key, result);
  return result;
}

/** Clears the memo, to time a choice made cold. */
export const forgetPositions = () => {
  memo.clear();
};

/** Solves `a x = b` by Gaussian elimination with partial pivoting; undefined when singular. */
function solve(a: number[][], b: number[]): number[] | undefined {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] ?? 0]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r;
    }
    if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-12) return undefined;
    [m[col], m[pivot]] = [m[pivot] ?? [], m[col] ?? []];
    const top = m[col] ?? [];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const row = m[r] ?? [];
      const f = (row[col] ?? 0) / (top[col] ?? 1);
      for (let c = col; c <= n; c++) row[c] = (row[c] ?? 0) - f * (top[c] ?? 0);
    }
  }
  return m.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}

function subsets(n: number, k: number): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  const go = (start: number, picked: number[]) => {
    if (picked.length === k) {
      out.push(picked);
      return;
    }
    for (let i = start; i < n; i++) go(i + 1, [...picked, i]);
  };
  go(0, []);
  return out;
}

/**
 * The row mix that maximises the row player's worst case in the zero-sum game `matrix`, for any
 * size: every square support of rows and columns, mixed so those columns pay the same. Ties keep
 * the earliest candidate (smallest supports first).
 */
export function maximinMixN(matrix: readonly (readonly number[])[]): number[] {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  const at = (r: number, c: number) => matrix[r]?.[c] ?? 0;
  const worst = (mix: readonly number[]) => {
    let lowest = Infinity;
    for (let c = 0; c < columns; c++) {
      let sum = 0;
      for (let r = 0; r < rows; r++) sum += (mix[r] ?? 0) * at(r, c);
      lowest = Math.min(lowest, sum);
    }
    return lowest;
  };
  let best: number[] = [];
  let bestValue = -Infinity;
  for (let k = 1; k <= Math.min(rows, columns); k++) {
    for (const rs of subsets(rows, k)) {
      for (const cs of subsets(columns, k)) {
        // Unknowns: x over rs, then v. Each column in cs pays v; the mix sums to 1.
        const a = cs.map((c) => [...rs.map((r) => at(r, c)), -1]);
        a.push([...rs.map(() => 1), 0]);
        const x = solve(a, [...cs.map(() => 0), 1]);
        if (x === undefined || rs.some((_, i) => (x[i] ?? 0) < -1e-12)) continue;
        const mix = Array.from({ length: rows }, () => 0);
        rs.forEach((r, i) => (mix[r] = Math.max(0, x[i] ?? 0)));
        const value = worst(mix);
        if (value > bestValue + 1e-12) {
          best = mix;
          bestValue = value;
        }
      }
    }
  }
  return best;
}

const uniform = (balls: readonly string[]): Weights =>
  balls.map((ball) => [ball, 1 / balls.length] as const);

function bestBy(balls: readonly string[], score: (ball: string) => number, margin = 1e-9) {
  const scores = balls.map(score);
  const top = Math.max(...scores);
  return balls.filter((_, i) => (scores[i] ?? -Infinity) >= top - margin);
}

const positionOf = (view: BotView): Position => ({
  format: view.format,
  own: view.own,
  opponent: view.opponent,
  wins: view.wins,
  losses: view.losses,
});

/** Hard's weights, as src/sim/bot.ts's hardBot, for any lineup size. */
export function hardWeightsN(view: BotView): Weights {
  const position = positionOf(view);
  if (view.role === 'answer') {
    const shown = view.shown ?? '';
    return uniform(bestBy(view.own, (ball) => afterRoundN(position, 'opponent', ball, shown)));
  }
  if (view.role === 'show') {
    const worstAnswer = (ball: string) =>
      Math.min(...view.opponent.map((y) => afterRoundN(position, 'bot', ball, y)));
    return uniform(bestBy(view.own, worstAnswer, HARD_SHOW_MARGIN));
  }
  const matrix = view.own.map((ball) =>
    view.opponent.map((y) => afterRoundN(position, 'bot', ball, y)),
  );
  const mix = maximinMixN(matrix);
  return view.own.map((ball, i) => [ball, mix[i] ?? 0] as const).filter(([, weight]) => weight > 0);
}

const ROLE_SALTS = { show: 0x5409, answer: 0xa45e, open: 0x0be7 } as const;

/** Hard for any lineup size, drawing on the same streams as src/sim's Hard. */
export const hardBotN: LineupBot = {
  id: 'hard',
  pickLineup: (seed, roster) => hardBot.pickLineup(seed, roster),
  weights: hardWeightsN,
  choose(view) {
    const weights = hardWeightsN(view);
    const roll = createStream(deriveSeed([view.seed, 0x4a7d, ROLE_SALTS[view.role], view.round]))();
    let sum = 0;
    for (const [ball, weight] of weights) {
      sum += weight;
      if (roll < sum) return ball;
    }
    return weights.at(-1)?.[0] ?? '';
  },
};
