// The words for the ways to play (ADR 0046, 0055, 0081): the Play tab's mode box, its sheet and
// Play, the setup screens, the bot level on the lineup step. Pure, so they are tested without a DOM.
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
import { TURNS_BUILD } from '../app/turns-build.ts';

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

/**
 * Play against a friend (ADR 0089 addendum of 2026-11-27): who next, signed in (`ask`), else a
 * live match sent by a link, on the sheet's rules.
 */
export function friendPlaySpoken(setup: FriendSetup, ask = false): string {
  // By turns only where the build plays by turns (`scripts/check-bundle.ts`'s mark).
  const how = TURNS_BUILD && setup.turns ? 'by turns' : 'live';
  const rules = `${bestOfName(setup.bestOf)}, ${FORMAT_SHORT[setup.format]}`;
  return ask
    ? `${PLAY_LABEL} a friend ${how}, ${rules}: choose who`
    : `${PLAY_LABEL} a friend ${how}, ${rules}: send them a link`;
}

/** The mode box's first line: who Play is against ("vs Normal bot"; Blind has no level). */
export function boxWho(choice: PlayChoice): string {
  if (choice.opponent === 'friend') return OPPONENT_CARDS.friend.name;
  return botChooses(choice.bot.format) ? levelLine(choice.bot.level) : OPPONENT_CARDS.bot.name;
}

/** The mode box's second line: the rules ("Best of 5 · Reveal", a friend's "Live · …"). */
export function boxRules(choice: PlayChoice): string {
  if (choice.opponent === 'friend') {
    const how = TURNS_BUILD && choice.friend.turns ? 'By turns' : 'Live';
    return `${how} · ${setupLine(choice.friend.format, choice.friend.bestOf)}`;
  }
  return setupLine(choice.bot.format, choice.bot.bestOf);
}

/**
 * The mode box's name: both lines as they show, then what it opens, so a voice user who says the
 * words they see reaches it (WCAG 2.5.3, Lighthouse on staging, 2026-11-27).
 */
export function boxSpoken(choice: PlayChoice): string {
  return `${boxWho(choice)}, ${boxRules(choice)}: ${SHEET_WORDS.title.toLowerCase()}`;
}

/** The sheet's heading and its groups' names (its way out is the shared ×, close-button.ts). */
export const SHEET_WORDS = {
  title: 'What to play',
  against: 'Against',
  length: 'Length',
  format: 'Format',
  how: 'How',
  level: 'Bot',
} as const;

/**
 * A friend match's two ways (ADR 0085), only where the build plays by turns: a build without it
 * holds none of their words (`scripts/check-bundle.ts`).
 */
export function howChoices(): readonly {
  readonly value: string;
  readonly text: string;
  readonly hint: string;
}[] {
  return TURNS_BUILD
    ? [
        { value: 'live', text: 'Live', hint: 'play now' },
        { value: 'turns', text: 'By turns', hint: 'up to a day a move' },
      ]
    : [];
}

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
