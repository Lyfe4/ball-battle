// The ways to play and where each leads (ADR 0046). Reveal is the main mode: home's one tap opens its
// lineup, against the remembered bot level, with no rules step. Every other way to play is on
// Other modes, in titled sections, so a Best of 5 joins as one more section of series modes.
import type { Format } from '../sim/series.ts';
import { writeSeriesModeParams } from './series-url.ts';

/**
 * Home's game: Best of 3, Reveal, against the bot. Measured with the most skill, the most reads and
 * the most different bot levels (`docs/best-of-5-measurements.md`, ADR 0035).
 */
export const MAIN_FORMAT: Format = 'reveal';

/** Home's one tap: the main format's lineup step. */
export function writeMainModeParams(params: URLSearchParams): void {
  for (const key of [...params.keys()]) params.delete(key);
  writeSeriesModeParams(params, MAIN_FORMAT, 'lineup');
}

/** Whether the bot makes choices a level changes (ADR 0035): never in Blind. */
export function botChooses(format: Format): boolean {
  return format !== 'blind';
}

/**
 * Where a lineup step's in-app Back goes when the visitor arrived on it from a link (otherwise it
 * is the browser's Back): the screen that leads to it.
 */
export function lineupParentOf(format: Format): 'home' | 'modes' {
  return format === MAIN_FORMAT ? 'home' : 'modes';
}

/** A way to play on Other modes: a Best of 3 in one format, or Free play (one match). */
export type OtherMode =
  { readonly kind: 'series'; readonly format: Format } | { readonly kind: 'free' };

export interface ModeSection {
  readonly title: string;
  readonly modes: readonly OtherMode[];
}

/**
 * Other modes, in order. Showdown leads: it keeps the most skill after Reveal. Blind stays for a
 * casual "set it and watch" series. Free play is one match with both balls chosen.
 */
export const OTHER_MODE_SECTIONS: readonly ModeSection[] = [
  {
    title: 'Best of 3 vs bot',
    modes: [
      { kind: 'series', format: 'showdown' },
      { kind: 'series', format: 'blind' },
    ],
  },
  { title: 'One match', modes: [{ kind: 'free' }] },
];
