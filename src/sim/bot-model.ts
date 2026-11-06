// How the Hard bot (ADR 0035) values a position in a series: its chance of taking the series from
// here, with every round's odds read from the counter map (favoured 64%, even 50%, unfavoured 36%)
// and both sides playing their best from then on. Plain arithmetic only (+ - * / and comparisons),
// which every JS engine computes identically, so a server reaches the same choices (ADR 0001).
import { isFavoured } from './counter-map.ts';
import { WINS_NEEDED, type Format } from './series.ts';

/** Round odds the bot assumes, by the counter map: the same bands players read in the manual. */
export const MODEL_ODDS = { favoured: 0.64, even: 0.5, unfavoured: 0.36 } as const;

/** The chance `ball` beats `opponent` in one round, by the counter map. */
export function mapOdds(ball: string, opponent: string): number {
  if (isFavoured(ball, opponent)) return MODEL_ODDS.favoured;
  return isFavoured(opponent, ball) ? MODEL_ODDS.unfavoured : MODEL_ODDS.even;
}

/** Who chooses first in a round: the bot shows first, or the opponent does. */
export type Lead = 'bot' | 'opponent';

/** A position from the bot's side: balls left on each side and round wins so far. */
export interface Position {
  readonly format: Format;
  readonly own: readonly string[];
  readonly opponent: readonly string[];
  readonly wins: number;
  readonly losses: number;
}

const without = (balls: readonly string[], ball: string) => balls.filter((id) => id !== ball);

/**
 * Who shows first in the round after this one. Reveal alternates (ADR 0021); Showdown's winner
 * shows first (ADR 0035).
 */
function nextLead(format: Format, lead: Lead, botWon: boolean): Lead {
  if (format === 'reveal') return lead === 'bot' ? 'opponent' : 'bot';
  return botWon ? 'bot' : 'opponent';
}

/** The bot's series chance once this round pairs `ball` with `against`, with best play after. */
export function afterRound(position: Position, lead: Lead, ball: string, against: string): number {
  const odds = mapOdds(ball, against);
  const rest = {
    ...position,
    own: without(position.own, ball),
    opponent: without(position.opponent, against),
  };
  const won = seriesValue(
    { ...rest, wins: position.wins + 1 },
    nextLead(position.format, lead, true),
  );
  const lost = seriesValue(
    { ...rest, losses: position.losses + 1 },
    nextLead(position.format, lead, false),
  );
  return odds * won + (1 - odds) * lost;
}

/**
 * The bot's series chance from `position` when `lead` shows first this round, both sides choosing
 * their best: the one showing first takes the choice whose best answer is least bad for it.
 */
export function seriesValue(position: Position, lead: Lead): number {
  if (position.wins >= WINS_NEEDED) return 1;
  if (position.losses >= WINS_NEEDED) return 0;
  const [own, against] = [position.own[0], position.opponent[0]];
  if (position.own.length === 1 && own !== undefined && against !== undefined) {
    return mapOdds(own, against);
  }
  const value = (ball: string, other: string) => afterRound(position, lead, ball, other);
  if (lead === 'bot') {
    return Math.max(
      ...position.own.map((ball) => Math.min(...position.opponent.map((y) => value(ball, y)))),
    );
  }
  return Math.min(
    ...position.opponent.map((y) => Math.max(...position.own.map((ball) => value(ball, y)))),
  );
}

/**
 * The mix of rows that maximises the row player's worst case in the zero-sum game `matrix` (rows:
 * the maximiser's choices, columns: the minimiser's), for up to three rows. Exact: the optimum of a
 * game this small is a pure row, a mix of two rows that makes two columns equal, or a mix of three
 * that makes three columns equal, so every candidate is tried. Ties keep the earliest candidate.
 */
export function maximinMix(matrix: readonly (readonly number[])[]): number[] {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  const at = (row: number, column: number) => matrix[row]?.[column] ?? 0;
  const worst = (mix: readonly number[]) => {
    let lowest = Infinity;
    for (let c = 0; c < columns; c++) {
      let sum = 0;
      for (let r = 0; r < rows; r++) sum += (mix[r] ?? 0) * at(r, c);
      lowest = Math.min(lowest, sum);
    }
    return lowest;
  };
  const pure = (row: number) => Array.from({ length: rows }, (_, r) => (r === row ? 1 : 0));
  const candidates: number[][] = Array.from({ length: rows }, (_, row) => pure(row));
  // Two rows i, j mixed t : 1 - t so that columns c and d pay the same.
  for (let i = 0; i < rows; i++) {
    for (let j = i + 1; j < rows; j++) {
      for (let c = 0; c < columns; c++) {
        for (let d = c + 1; d < columns; d++) {
          const slope = at(i, c) - at(j, c) - (at(i, d) - at(j, d));
          if (slope === 0) continue;
          const t = (at(j, d) - at(j, c)) / slope;
          if (t <= 0 || t >= 1) continue;
          const mix = Array.from({ length: rows }, () => 0);
          mix[i] = t;
          mix[j] = 1 - t;
          candidates.push(mix);
        }
      }
    }
  }
  if (rows === 3 && columns === 3) {
    // All three rows, mixed x, y, 1 - x - y, so that all three columns pay the same.
    const g = (r: number, c: number) => at(r, c) - at(2, c);
    const a1 = g(0, 0) - g(0, 1);
    const b1 = g(1, 0) - g(1, 1);
    const c1 = at(2, 1) - at(2, 0);
    const a2 = g(0, 0) - g(0, 2);
    const b2 = g(1, 0) - g(1, 2);
    const c2 = at(2, 2) - at(2, 0);
    const det = a1 * b2 - a2 * b1;
    if (det !== 0) {
      const x = (c1 * b2 - c2 * b1) / det;
      const y = (a1 * c2 - a2 * c1) / det;
      if (x > 0 && y > 0 && x + y < 1) candidates.push([x, y, 1 - x - y]);
    }
  }
  let best = candidates[0] ?? [];
  let bestValue = worst(best);
  for (const mix of candidates) {
    const value = worst(mix);
    if (value > bestValue + 1e-12) {
      best = mix;
      bestValue = value;
    }
  }
  return best;
}
