// The words of the series scoreboard, as pure functions so they are tested without a DOM.
import {
  bestOfOf,
  formatOf,
  MAX_ATTEMPTS,
  winsNeededOf,
  scoreOf,
  type BestOf,
  type Format,
  type NextMatch,
  type RoundRecord,
  type SeriesSetup,
  type SeriesState,
  type Side,
} from '../sim/series.ts';
import { BOT_SEATS, capital, labelOf, theirSide, type Seats } from './series/seats.ts';
import type { PickChoice } from './series/series-view.ts';

/** Display names by ball id. */
export type NameOf = (id: string) => string;

export const SIDE_NAMES: Readonly<Record<Side, string>> = { a: 'You', b: 'Bot' };

/** Draft formats (ADR 0019), as the format choice and the scoreboard name them. */
export const FORMAT_NAMES: Readonly<Record<Format, string>> = {
  blind: 'Blind order',
  reveal: 'Reveal, then take turns',
  showdown: 'Showdown',
};

/** The bot's levels (ADR 0035), by bot id, as the rules step and the series header name them. */
export const LEVEL_NAMES: Readonly<Record<string, string>> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

/** A few words on how each format plays, on its card in the rules step (ADR 0025: short). */
export const FORMAT_LINES: Readonly<Record<Format, string>> = {
  blind: 'Set your order, then watch.',
  reveal: 'See both lineups. Take turns showing first.',
  showdown: 'Open together. Winners show, losers answer.',
};

/** Formats in a word, for the bar over a series being played. */
export const FORMAT_SHORT: Readonly<Record<Format, string>> = {
  blind: 'Blind',
  reveal: 'Reveal',
  showdown: 'Showdown',
};

/** "Best of 3": a series length (ADR 0048), as every line that names one says it. */
export const bestOfName = (bestOf: BestOf): string => `Best of ${String(bestOf)}`;

/** "Best of 3 · Reveal · Hard": what is being played, over the series (ADR 0035). */
export function aboutLine(setup: SeriesSetup): string {
  return aboutParts(setup).join(' · ');
}

/** The phrases of `aboutLine`: "Best of 3", "Reveal", "Hard". */
export function aboutParts(setup: SeriesSetup): readonly string[] {
  const level = setup.opponent.kind === 'bot' ? LEVEL_NAMES[setup.opponent.bot] : undefined;
  const format = formatOf(setup);
  const parts = [bestOfName(bestOfOf(setup)), FORMAT_SHORT[format]];
  // Blind has no choices a level changes, and the first bot (old links) has no level.
  if (level !== undefined && format !== 'blind') parts.push(level);
  return parts;
}

/** The series rule every format shares, said once above the format cards: "3 balls each · first to 2 wins". */
export function seriesRule(bestOf: BestOf): string {
  return `${String(bestOf)} balls each · first to ${String(winsNeededOf(bestOf))} wins`;
}

/** A replayed link makes the next pick itself: the player only moves on. */
export function linkPickLine(round: number): string {
  return `Next, round ${String(round + 1)}, with the picks from the link.`;
}

/** The player shows first; the other side answers from what it has left (Reveal, Showdown). */
export function showLine(
  round: number,
  botLeft: readonly string[],
  nameOf: NameOf,
  seats: Seats = BOT_SEATS,
): string {
  const left = botLeft.map(nameOf).join(' or ');
  return `Round ${String(round + 1)}: you show first. Pick your ball; ${seats.they} answers with ${left}.`;
}

/** Showdown, round 1: both pick at the same time. */
export function openLine(
  botLeft: readonly string[],
  nameOf: NameOf,
  seats: Seats = BOT_SEATS,
): string {
  const left = botLeft.map(nameOf).join(', ');
  return `Round 1: pick your opener. ${capital(seats.they)} picks from ${left} at the same time.`;
}

/** The other side showed first; the player answers (Reveal, Showdown). */
export function answerLine(
  round: number,
  shown: string,
  nameOf: NameOf,
  seats: Seats = BOT_SEATS,
): string {
  return `Round ${String(round + 1)}: ${seats.they} plays ${nameOf(shown)}. Pick your answer.`;
}

/**
 * The pick asked for, in words, the same on round 1's step and between rounds (ADR 0038): an
 * answer to the bot's shown ball, Showdown's opener, or the ball the player shows first.
 */
export function pickLine(
  choice: PickChoice,
  round: number,
  botLeft: readonly string[],
  nameOf: NameOf,
  toss?: Side,
  seats: Seats = BOT_SEATS,
): string {
  const head = toss === undefined ? '' : `${tossLine(toss, seats)} `;
  if (choice.facing !== undefined) return head + answerLine(round, choice.facing, nameOf, seats);
  return (
    head +
    (choice.kind === 'open'
      ? openLine(botLeft, nameOf, seats)
      : showLine(round, botLeft, nameOf, seats))
  );
}

/** Reveal's coin toss (ADR 0029, 0041) in words: who shows first in round 1. */
export function tossLine(first: Side, seats: Seats = BOT_SEATS): string {
  return first === seats.you
    ? 'Coin toss: you show first.'
    : `Coin toss: ${seats.they} shows first.`;
}

/** A pick's prompt as two short sentences: what is happening, then what to do (ADR 0037). */
export interface BannerText {
  readonly lead: string;
  readonly ask: string;
}

/**
 * The pick banner's words. On Reveal's round 1 (`toss`, who won the coin toss) the lead says the
 * toss first, so its result is never a bare "You" or "Bot" (ADR 0041).
 */
export function bannerText(
  choice: PickChoice,
  nameOf: NameOf,
  toss?: Side,
  seats: Seats = BOT_SEATS,
): BannerText {
  const them = theirSide(seats);
  if (choice.kind === 'answer' && choice.facing !== undefined) {
    // After the toss line has named them, the bot is "It"; a player is "They".
    const pronoun = seats.they === BOT_SEATS.they ? 'It plays' : 'They play';
    const subject = toss === them ? pronoun : `${capital(seats.they)} plays`;
    const plays = `${subject} ${nameOf(choice.facing)}.`;
    const lead = toss === them ? `${tossLine(them, seats)} ${plays}` : plays;
    return { lead, ask: 'Pick your answer.' };
  }
  if (choice.kind === 'open') {
    return { lead: 'Pick your opener.', ask: `${capital(seats.they)} picks at the same time.` };
  }
  return {
    lead: toss === seats.you ? tossLine(seats.you, seats) : 'You show first.',
    ask: `Pick a ball; ${seats.they} answers.`,
  };
}

/** "You 1 – 0 Bot". */
export function scoreLine(state: SeriesState, seats: Seats = BOT_SEATS): string {
  const score = scoreOf(state);
  return `You ${String(score[seats.you])} – ${String(score[theirSide(seats)])} ${seats.them}`;
}

/** One finished round, e.g. "Round 2: your Archer beat the bot's Storm, after 1 draw". */
export function roundLine(record: RoundRecord, nameOf: NameOf, seats: Seats = BOT_SEATS): string {
  const yours = `your ${nameOf(record[seats.you])}`;
  const theirs = `${seats.their} ${nameOf(record[theirSide(seats)])}`;
  const head = `Round ${String(record.round + 1)}: `;
  const won = record.winner === seats.you;
  if (record.suddenDeath) {
    const draws = `${String(record.outcomes.length)} times`;
    return `${head}${yours} and ${theirs} drew ${draws}; sudden death went to ${won ? 'you' : seats.they}`;
  }
  const draws = record.outcomes.length - 1;
  const after = draws > 0 ? `, after ${String(draws)} draw${draws > 1 ? 's' : ''}` : '';
  return won ? `${head}${yours} beat ${theirs}${after}` : `${head}${theirs} beat ${yours}${after}`;
}

/** The round being played (of the series' `bestOf`): both balls are revealed only now. */
export function playingLine(
  match: NextMatch,
  nameOf: NameOf,
  bestOf: BestOf = 3,
  seats: Seats = BOT_SEATS,
): string {
  const replay =
    match.attempt > 0 ? ` (replay ${String(match.attempt + 1)} of ${String(MAX_ATTEMPTS)})` : '';
  const mine = nameOf(match[seats.you]);
  const theirs = nameOf(match[theirSide(seats)]);
  return `Round ${String(match.round + 1)} of ${String(bestOf)}: your ${mine} vs ${seats.their} ${theirs}${replay}`;
}

/**
 * Between plays: what just happened and what comes next. The bot's next ball stays hidden until
 * the round starts, except in Reveal and Showdown, where both lineups are shown and the round's balls are known
 * (the last round is what each side has left).
 */
export function betweenLine(
  state: SeriesState,
  next: NextMatch,
  nameOf: NameOf,
  seats: Seats = BOT_SEATS,
): string {
  if (state.pending.length > 0) {
    return `Round ${String(next.round + 1)} drew. It is replayed on a new seed (play ${String(next.attempt + 1)} of ${String(MAX_ATTEMPTS)}); a third draw goes to sudden death.`;
  }
  const against =
    formatOf(state.setup) === 'blind'
      ? 'a hidden ball'
      : `${seats.their} ${nameOf(next[theirSide(seats)])}`;
  return `Next, round ${String(next.round + 1)}: your ${nameOf(next[seats.you])} against ${against}.`;
}

/** The series result. */
export function finalLine(state: SeriesState, seats: Seats = BOT_SEATS): string {
  const score = scoreOf(state);
  const mine = score[seats.you];
  const theirs = score[theirSide(seats)];
  return state.winner === seats.you
    ? `You win the series ${String(mine)}–${String(theirs)}!`
    : `${capital(seats.they)} wins the series ${String(theirs)}–${String(mine)}.`;
}

/** "You" or the other side's label, for a side (the coin's faces, the track's rows). */
export { labelOf };

/** The score line's content while a round is fought. */
export interface ScoreLine {
  /** 0-based. */
  readonly round: number;
  readonly you: number;
  readonly bot: number;
  /** The full track is open under the line. */
  readonly open: boolean;
}

/** "Round 2 · You 1–0 Bot"; `short` names a guest "P4821", so the line fits a phone (ADR 0055). */
export function scoreText(
  { round, you, bot }: ScoreLine,
  seats: Seats = BOT_SEATS,
  short = false,
): string {
  const them = short ? seats.them.replace(/^Player (\d+)$/, 'P$1') : seats.them;
  return `Round ${String(round + 1)} · You ${String(you)}–${String(bot)} ${them}`;
}
