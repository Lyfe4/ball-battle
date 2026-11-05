// The words of the best-of-3 scoreboard, as pure functions so they are tested without a DOM.
import {
  LINEUP_SIZE,
  MAX_ATTEMPTS,
  scoreOf,
  type Format,
  type NextMatch,
  type RoundRecord,
  type SeriesState,
  type Side,
} from '../sim/series.ts';

/** Display names by ball id. */
export type NameOf = (id: string) => string;

export const SIDE_NAMES: Readonly<Record<Side, string>> = { a: 'You', b: 'Bot' };

/** Draft formats (ADR 0019), as the format choice and the scoreboard name them. */
export const FORMAT_NAMES: Readonly<Record<Format, string>> = {
  blind: 'Blind order',
  reveal: 'Reveal, then take turns',
  loser: 'Loser picks next',
};

/** A few words on how each format plays, on its card in the rules step (ADR 0025: short). */
export const FORMAT_LINES: Readonly<Record<Format, string>> = {
  blind: 'Set your order. The bot’s stays hidden.',
  reveal: 'See both lineups. Take turns showing first.',
  loser: 'Lose a round, pick your next ball.',
};

/** The series rule every format shares, said once above the format cards. */
export const SERIES_RULE = '3 balls each · first to 2 wins';

/** A replayed link makes the next pick itself: the player only moves on. */
export function linkPickLine(round: number): string {
  return `Next, round ${String(round + 1)}, with the picks from the link.`;
}

/** Reveal, round 2: the player shows first, and the bot answers from what it has left. */
export function revealShowLine(round: number, botLeft: readonly string[], nameOf: NameOf): string {
  const left = botLeft.map(nameOf).join(' and ');
  return `Round ${String(round + 1)}: you show first. Pick your ball; the bot answers with its best counter from ${left}.`;
}

/** Loser picks next, the player lost: what they are picking against. */
export function pickLine(round: number, winnersNext: string, nameOf: NameOf): string {
  return `You lost round ${String(round)}. The bot plays its ${nameOf(winnersNext)} next: pick your ball to face it.`;
}

/** Loser picks next, the bot lost: it picks once the player moves on. */
export function botPicksLine(round: number, yourNext: string, nameOf: NameOf): string {
  return `Next, round ${String(round + 1)}: your ${nameOf(yourNext)}. The bot lost round ${String(round)}, so it picks its next ball knowing yours.`;
}

/** "You 1 – 0 Bot". */
export function scoreLine(state: SeriesState): string {
  const { a, b } = scoreOf(state);
  return `${SIDE_NAMES.a} ${String(a)} – ${String(b)} ${SIDE_NAMES.b}`;
}

/** One finished round, e.g. "Round 2: your Archer beat the bot's Storm, after 1 draw". */
export function roundLine(record: RoundRecord, nameOf: NameOf): string {
  const yours = `your ${nameOf(record.a)}`;
  const theirs = `the bot’s ${nameOf(record.b)}`;
  const head = `Round ${String(record.round + 1)}: `;
  if (record.suddenDeath) {
    const draws = `${String(record.outcomes.length)} times`;
    return `${head}${yours} and ${theirs} drew ${draws}; sudden death went to ${record.winner === 'a' ? 'you' : 'the bot'}`;
  }
  const draws = record.outcomes.length - 1;
  const after = draws > 0 ? `, after ${String(draws)} draw${draws > 1 ? 's' : ''}` : '';
  return record.winner === 'a'
    ? `${head}${yours} beat ${theirs}${after}`
    : `${head}${theirs} beat ${yours}${after}`;
}

/** The round being played: both balls are revealed only now. */
export function playingLine(match: NextMatch, nameOf: NameOf): string {
  const replay =
    match.attempt > 0 ? ` (replay ${String(match.attempt + 1)} of ${String(MAX_ATTEMPTS)})` : '';
  return `Round ${String(match.round + 1)} of ${String(LINEUP_SIZE)}: your ${nameOf(match.a)} vs the bot’s ${nameOf(match.b)}${replay}`;
}

/**
 * Between plays: what just happened and what comes next. The bot's next ball stays hidden until
 * the round starts.
 */
export function betweenLine(state: SeriesState, next: NextMatch, nameOf: NameOf): string {
  if (state.pending.length > 0) {
    return `Round ${String(next.round + 1)} drew. It is replayed on a new seed (play ${String(next.attempt + 1)} of ${String(MAX_ATTEMPTS)}); a third draw goes to sudden death.`;
  }
  return `Next, round ${String(next.round + 1)}: your ${nameOf(next.a)} against a hidden ball.`;
}

/** The series result. */
export function finalLine(state: SeriesState): string {
  const { a, b } = scoreOf(state);
  return state.winner === 'a'
    ? `You win the series ${String(a)}–${String(b)}!`
    : `The bot wins the series ${String(b)}–${String(a)}.`;
}
