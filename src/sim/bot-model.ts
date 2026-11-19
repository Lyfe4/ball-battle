// How the Hard bot (ADR 0035, 0048) values a position in a series of any length: its chance of
// taking the series from here, with every round's odds read from the counter map's levels (ADR
// 0073: strong 70%, edge 60%, even 50%) and both sides playing their best from then on. Plain arithmetic only (+ - * / and comparisons),
// which every JS engine computes identically, so a server reaches the same choices (ADR 0001).
import { standingOf } from './counter-map.ts';
import type { Format } from './series.ts';

/** The chance a bot assumes `ball` beats `against` in one round. */
export type Odds = (ball: string, against: string) => number;

/**
 * Round odds the bot assumes for the favoured side, by level: the middle of each level's band, the
 * same levels players read in the manual (ADR 0073). The other side's are what is left.
 */
export const LEVEL_ODDS = { strong: 0.7, edge: 0.6, even: 0.5 } as const;

/** The chance `ball` beats `opponent` in one round, by the counter map's level. */
export const mapOdds: Odds = (ball, opponent) => {
  const standing = standingOf(ball, opponent);
  const size = standing < 0 ? -standing : standing;
  const odds = size === 2 ? LEVEL_ODDS.strong : size === 1 ? LEVEL_ODDS.edge : LEVEL_ODDS.even;
  return standing < 0 ? 1 - odds : odds;
};

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
  /** The round odds it plays by: `mapOdds` unless named (a retired bot's own, ADR 0073). */
  readonly odds?: Odds;
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
  const odds = (position.odds ?? mapOdds)(ball, against);
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
    return (position.odds ?? mapOdds)(own, against);
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
