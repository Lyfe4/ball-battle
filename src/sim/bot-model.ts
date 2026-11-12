// How the Hard bot (ADR 0035, 0048) values a position in a series of any length: its chance of
// taking the series from here, with every round's odds read from the counter map (favoured 64%, even 50%, unfavoured 36%)
// and both sides playing their best from then on. Plain arithmetic only (+ - * / and comparisons),
// which every JS engine computes identically, so a server reaches the same choices (ADR 0001).
import { isFavoured } from './counter-map.ts';
import type { Format } from './series.ts';

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
  /** Round wins that take the series: 2 in a Best of 3, 3 in a Best of 5 (ADR 0048). */
  readonly winsNeeded: number;
}

const without = (balls: readonly string[], ball: string) => balls.filter((id) => id !== ball);

/**
 * Values already worked out during one choice, by position. A Best of 5 meets the same position
 * by many orders of play, too many to search afresh; the memo lives only as long as the choice, so
 * nothing is kept between series or shared between callers.
 */
export type Memo = Map<string, number>;

const keyOf = (p: Position, lead: Lead) =>
  `${p.format}|${[...p.own].sort().join()}|${[...p.opponent].sort().join()}|${String(p.wins)}-${String(p.losses)}/${String(p.winsNeeded)}|${lead}`;

/**
 * Who shows first in the round after this one. Reveal alternates (ADR 0021); Showdown's winner
 * shows first (ADR 0035).
 */
function nextLead(format: Format, lead: Lead, botWon: boolean): Lead {
  if (format === 'reveal') return lead === 'bot' ? 'opponent' : 'bot';
  return botWon ? 'bot' : 'opponent';
}

/** The bot's series chance once this round pairs `ball` with `against`, with best play after. */
export function afterRound(
  position: Position,
  lead: Lead,
  ball: string,
  against: string,
  memo: Memo = new Map(),
): number {
  const odds = mapOdds(ball, against);
  const rest = {
    ...position,
    own: without(position.own, ball),
    opponent: without(position.opponent, against),
  };
  const won = seriesValue(
    { ...rest, wins: position.wins + 1 },
    nextLead(position.format, lead, true),
    memo,
  );
  const lost = seriesValue(
    { ...rest, losses: position.losses + 1 },
    nextLead(position.format, lead, false),
    memo,
  );
  return odds * won + (1 - odds) * lost;
}

/**
 * The bot's series chance from `position` when `lead` shows first this round, both sides choosing
 * their best: the one showing first takes the choice whose best answer is least bad for it.
 */
export function seriesValue(position: Position, lead: Lead, memo: Memo = new Map()): number {
  if (position.wins >= position.winsNeeded) return 1;
  if (position.losses >= position.winsNeeded) return 0;
  const [own, against] = [position.own[0], position.opponent[0]];
  if (position.own.length === 1 && own !== undefined && against !== undefined) {
    return mapOdds(own, against);
  }
  const key = keyOf(position, lead);
  const known = memo.get(key);
  if (known !== undefined) return known;
  const value = (ball: string, other: string) => afterRound(position, lead, ball, other, memo);
  const result =
    lead === 'bot'
      ? Math.max(
          ...position.own.map((ball) => Math.min(...position.opponent.map((y) => value(ball, y)))),
        )
      : Math.min(
          ...position.opponent.map((y) => Math.max(...position.own.map((ball) => value(ball, y)))),
        );
  memo.set(key, result);
  return result;
}
