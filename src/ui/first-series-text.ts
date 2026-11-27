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
 * Over round 1's pick rows, the bot having shown `shown` first: what ▲ says, in the odds the marks'
 * own tooltips give (symbols.ts), and that the lit row is the best answer (coach.css). One short
 * paragraph, so every pick row fits a phone (ADR 0090 addendum, 1c).
 */
export function firstPickSteps(shown: string): Steps {
  return {
    title: 'Your first pick',
    items: [],
    note: `${MARKS.favoured} under ${shown}: your ball is favoured, it wins about 6 in 10 (${STRONG_MARKS.favoured}: 7 in 10). The lit row is your best answer.`,
  };
}

/** Round 2 of the first series, the player showing first: the other side of round 1. */
export const SHOW_FIRST_LINE = 'The bot sees your ball before it answers.';

/** Round 2's coach: the line above, under its own title. */
export const SHOW_FIRST_STEPS: Steps = {
  title: 'Round 2: you show first',
  items: [],
  note: SHOW_FIRST_LINE,
};

/** The first series' coach has three steps: the lineup, the first pick, round 2. */
export const FIRST_SERIES_GUIDE = 3;

/** One new way to play on the unlock card: its icon (icons.ts) and its line. */
export interface NewWay {
  readonly icon: 'five' | 'showdown' | 'blind' | 'bot' | 'friend';
  readonly text: string;
}

/** The unlock card's title, and where the new ways are. */
export const NEW_WAYS_TITLE = 'New: more ways to play';
export const NEW_WAYS_WHERE = 'They’re in What to play on the Play tab.';

/**
 * At the first series' result, win or lose (once): what is now on the Play tab, each with its icon.
 * A friend only where the build plays one.
 */
export function newWays(friend: boolean): readonly NewWay[] {
  return [
    { icon: 'five', text: 'From now on a series is Best of 5: first to 3 wins.' },
    { icon: 'showdown', text: 'Showdown and Blind: two more ways to pick.' },
    { icon: 'bot', text: 'The Normal and Hard bots.' },
    ...(friend ? [{ icon: 'friend', text: 'Play a friend with a link.' } as const] : []),
  ];
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
