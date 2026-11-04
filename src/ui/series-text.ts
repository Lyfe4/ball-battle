// The words of the best-of-3 scoreboard, as pure functions so they are tested without a DOM.
import {
  LINEUP_SIZE,
  MAX_ATTEMPTS,
  scoreOf,
  type NextMatch,
  type RoundRecord,
  type SeriesState,
  type Side,
} from '../sim/series.ts';

/** Display names by ball id. */
export type NameOf = (id: string) => string;

export const SIDE_NAMES: Readonly<Record<Side, string>> = { a: 'You', b: 'Bot' };

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
