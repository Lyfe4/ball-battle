// The words for the ways to play (ADR 0046): home's one tap, the Other modes cards, the bot level
// on the lineup step. Pure, so they are tested without a DOM.
import type { OtherMode } from '../app/modes.ts';
import type { Format } from '../sim/series.ts';
import { FORMAT_LINES, FORMAT_SHORT, LEVEL_NAMES } from './series-text.ts';

/** Home's main button: one word, what it plays under it, and the whole of it for screen readers. */
export const MAIN_PLAY = {
  label: 'Play',
  meta: 'Best of 3 · Reveal · vs bot',
  spoken: 'Play Best of 3, Reveal, against the bot',
} as const;

const FREE_PLAY = { name: 'Free play', line: 'Pick both balls and watch.' } as const;

export function modeName(mode: OtherMode): string {
  return mode.kind === 'free' ? FREE_PLAY.name : FORMAT_SHORT[mode.format];
}

/** How a mode plays, in a few words (ADR 0025). A format's line is the rules step's own. */
export function modeLine(mode: OtherMode): string {
  return mode.kind === 'free' ? FREE_PLAY.line : FORMAT_LINES[mode.format];
}

/** "vs Normal bot": the level a series is played against. */
export function levelLine(level: string): string {
  return `vs ${LEVEL_NAMES[level] ?? level} bot`;
}

/** "Best of 3 · Reveal": what the lineup is for, since home's one tap skips the rules step. */
export function setupLine(format: Format): string {
  return `Best of 3 · ${FORMAT_SHORT[format]}`;
}
