// What the guided first series says, and what comes after it (ADR 0090): the four words that
// matter (lineup, round, shows first or answers, ▲), each once, where it first matters. Pure, so
// the words are tested without a DOM.
import type { Format } from '../sim/series.ts';
import { MARKS, STRONG_MARKS } from './balls/marks.ts';
import { FORMAT_LINES, FORMAT_SHORT } from './series-text.ts';
import type { Steps } from './notice-content.ts';

/**
 * The Play tab on a first visit (ADR 0090): what the game is, in the demo's line; what Play starts,
 * under it; and the way to the whole tab.
 */
export const FIRST_VISIT = {
  pitch: 'Pick 3 balls. Watch them fight. Outguess the bot.',
  play: 'Your first series · vs Easy bot',
  playSpoken: 'Play your first series: Best of 3, Reveal, against the Easy bot',
  skip: 'Skip: show me everything',
} as const;

/** Over the first lineup: what a series is. */
export const SERIES_STEPS: Steps = {
  title: 'How a series goes',
  items: ['Pick 3 balls.', 'Each round, one of yours fights one of the bot’s.', 'Win 2 rounds.'],
};

/**
 * Under round 1's banner, the bot having shown `shown` first: what ▲ says, in the odds the marks'
 * own tooltips give (symbols.ts), and that a mark explains itself. One short paragraph, so the
 * pick rows stay near the top of a phone.
 */
export function firstPickSteps(shown: string): Steps {
  return {
    title: 'Your first pick',
    items: [],
    note: `${MARKS.favoured} under ${shown}: your ball is favoured, it wins about 6 in 10 (${STRONG_MARKS.favoured}: 7 in 10). Tap a mark to read why.`,
  };
}

/** Round 2 of the first series, the player showing first: the other side of round 1. */
export const SHOW_FIRST_LINE = 'The bot sees your ball before it answers.';

/**
 * At the first series' result, win or lose (once): what is now on the Play tab. A friend only where
 * the build plays one.
 */
export function newWaysSteps(friend: boolean): Steps {
  return {
    title: 'New: more ways to play',
    items: [
      'From now on a series is Best of 5: first to 3 wins.',
      'Showdown and Blind: two more ways to pick.',
      'The Normal and Hard bots.',
      ...(friend ? ['Play a friend with a link.'] : []),
    ],
    unordered: true,
    note: 'They’re in What to play on the Play tab.',
  };
}

/** The tag on a way to play not tried yet, in What to play. */
export const NEW_TAG = 'New';

/** The formats a box teaches the first time they are played (Reveal: the first series). */
const FORMAT_MORE: Partial<Record<Format, string>> = {
  showdown: 'From round 2, the last round’s winner shows first and the loser answers.',
  blind: 'Your balls play in the order you set: slot 1 in round 1, and so on.',
};

/** "How Showdown goes": a format's first time, its rule sentence first (series-text.ts). */
export function formatSteps(format: Format): Steps | undefined {
  const more = FORMAT_MORE[format];
  if (more === undefined) return undefined;
  return { title: `How ${FORMAT_SHORT[format]} goes`, items: [FORMAT_LINES[format], more] };
}
