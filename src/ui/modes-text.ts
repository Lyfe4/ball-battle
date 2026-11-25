// The words for the ways to play (ADR 0046, 0055, 0081): the Play tab's mode box, its sheet and
// Play, the setup screens, the bot level on the lineup step. Pure, so they are tested without a DOM.
import { PICK_SECONDS } from '../api/live.ts';
import {
  botChooses,
  type FriendSetup,
  type Opponent,
  type PlayChoice,
  type PlaySetup,
} from '../app/modes.ts';
import {
  bestOfOf,
  DEFAULT_BEST_OF,
  formatOf,
  scoreOf,
  type BestOf,
  type Format,
  type SeriesState,
} from '../sim/series.ts';
import { bestOfName, FORMAT_SHORT, LEVEL_NAMES, seriesRule } from './series-text.ts';

/** "vs Normal bot": the level a series is played against. */
export function levelLine(level: string): string {
  return `vs ${LEVEL_NAMES[level] ?? level} bot`;
}

/** Home's main button: one word, then what it plays. */
export const PLAY_LABEL = 'Play';

/** "Best of 5 · Reveal · vs Hard bot": what home's Play starts. Blind has no level to name. */
export function playLine(setup: PlaySetup): string {
  const against = botChooses(setup.format) ? levelLine(setup.level) : 'vs bot';
  return `${setupLine(setup.format, setup.bestOf)} · ${against}`;
}

/** The same in words, for the button's accessible name. */
export function playSpoken(setup: PlaySetup): string {
  const against = botChooses(setup.format)
    ? `the ${LEVEL_NAMES[setup.level] ?? setup.level} bot`
    : 'the bot';
  return `${PLAY_LABEL} ${bestOfName(setup.bestOf)}, ${FORMAT_SHORT[setup.format]}, against ${against}`;
}

/** Each opponent as the sheet names it, and the heading of its setup screen. */
export const OPPONENT_CARDS: Readonly<Record<Opponent, { readonly name: string }>> = {
  bot: { name: 'vs Bot' },
  friend: { name: 'vs Friend' },
};

/** What a live friend match asks of both players, said on the vs Friend setup (ADR 0053). */
export const FRIEND_SETUP_NOTE = `Live: you both stay until the end, ${String(PICK_SECONDS)} s a pick. You send a link; once they accept, you both pick your lineups.`;

/** What play by turns asks, said on the vs Friend setup where it is offered (ADR 0085). */
export const TURNS_SETUP_NOTE =
  'Pick your lineup now. Once they accept with theirs, you take turns, up to a day each; a turn left too long loses the series.';

/** Play against a friend (ADR 0081): a live match sent by a link, on the sheet's rules. */
export function friendPlaySpoken(setup: FriendSetup): string {
  return `${PLAY_LABEL} a friend live, ${bestOfName(setup.bestOf)}, ${FORMAT_SHORT[setup.format]}: send them a link`;
}

/** The mode box's first line: who Play is against ("vs Normal bot"; Blind has no level). */
export function boxWho(choice: PlayChoice): string {
  if (choice.opponent === 'friend') return OPPONENT_CARDS.friend.name;
  return botChooses(choice.bot.format) ? levelLine(choice.bot.level) : OPPONENT_CARDS.bot.name;
}

/** The mode box's second line: the rules ("Best of 5 · Reveal", a friend's "Live · …"). */
export function boxRules(choice: PlayChoice): string {
  if (choice.opponent === 'friend') {
    return `Live · ${setupLine(choice.friend.format, choice.friend.bestOf)}`;
  }
  return setupLine(choice.bot.format, choice.bot.bestOf);
}

/** The mode box's name: what it opens, then both lines in words. */
export function boxSpoken(choice: PlayChoice): string {
  const { format, bestOf } = choice.opponent === 'friend' ? choice.friend : choice.bot;
  const live = choice.opponent === 'friend' ? 'live, ' : '';
  return `${SHEET_WORDS.title}: ${boxWho(choice)}, ${live}${bestOfName(bestOf)}, ${FORMAT_SHORT[format]}`;
}

/** The sheet's heading, its groups' names and its way out. */
export const SHEET_WORDS = {
  title: 'What to play',
  against: 'Against',
  length: 'Length',
  format: 'Format',
  level: 'Bot',
  done: 'Done',
} as const;

/** Each format in a few words, under its name in the sheet (the setup's cards say it whole). */
export const FORMAT_HINTS: Readonly<Record<Format, string>> = {
  reveal: 'take turns',
  showdown: 'winner shows',
  blind: 'set order',
};

/** The Play tab's quiet link under Play. */
export const FREE_PLAY = 'Free play';

/** "Best of 3 · Reveal": what the lineup is for, since Play skips the setup screen. */
export function setupLine(format: Format, bestOf: BestOf = DEFAULT_BEST_OF): string {
  return `${bestOfName(bestOf)} · ${FORMAT_SHORT[format]}`;
}

/** A setup's length choice (ADR 0048): each length's name and the rule it plays by. */
export function lengthChoiceOf(bestOf: BestOf): { readonly name: string; readonly rule: string } {
  return { name: bestOfName(bestOf), rule: seriesRule(bestOf) };
}

/** Home's main button while a series is held (ADR 0046): it resumes that series. */
export const RESUME_PLAY = { label: 'Resume series' } as const;

/** "Best of 3 · Reveal · You 1–0 Bot": the held series' format and score, the player first. */
export function resumeLine(state: SeriesState): string {
  const { a, b } = scoreOf(state);
  return `${setupLine(formatOf(state.setup), bestOfOf(state.setup))} · You ${String(a)}–${String(b)} Bot`;
}

/** The same in words, for the button's accessible name. */
export function resumeSpoken(state: SeriesState): string {
  const { a, b } = scoreOf(state);
  const format = FORMAT_SHORT[formatOf(state.setup)];
  const length = bestOfName(bestOfOf(state.setup));
  return `${RESUME_PLAY.label}: ${length}, ${format}, you ${String(a)}, bot ${String(b)}`;
}
