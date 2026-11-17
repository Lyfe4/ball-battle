// The words for the ways to play (ADR 0046, 0055): home's Play and its opponent cards, the setup
// screens, the bot level on the lineup step. Pure, so they are tested without a DOM.
import { PICK_SECONDS } from '../api/live.ts';
import { botChooses, type Opponent, type PlaySetup } from '../app/modes.ts';
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

/** Each opponent card on home, and the heading of the setup screen it opens. */
export const OPPONENT_CARDS: Readonly<Record<Opponent, { readonly name: string }>> = {
  bot: { name: 'vs Bot' },
  friend: { name: 'vs Friend' },
};

/** What a live friend match asks of both players, said on the vs Friend setup (ADR 0053). */
export const FRIEND_SETUP_NOTE = `Live: you both stay until the end, ${String(PICK_SECONDS)} s a pick. You send a link; the match starts when they accept.`;

/** Home's quiet links under the cards. */
export const FREE_PLAY = 'Free play';
export const BALL_MANUAL = 'Ball manual';

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
