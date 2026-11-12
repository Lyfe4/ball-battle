// The ways to play and where each leads (ADR 0046). Reveal is the main mode: home's one tap opens its
// lineup, against the remembered bot level, with no rules step. Every other way to play is on
// Other modes, in titled sections. The series section opens with a length choice (Best of 3 or 5,
// ADR 0048), so it lists every format, Reveal included: at Best of 5 nothing else reaches it.
import { DEFAULT_BEST_OF, type BestOf, type Format } from '../sim/series.ts';
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
 * is the browser's Back): the screen that leads to it. Home's Play leads only to Best of 3 Reveal;
 * every other lineup, a Best of 5 Reveal's included (ADR 0048), is reached from Other modes.
 */
export function lineupParentOf(format: Format, bestOf: BestOf = DEFAULT_BEST_OF): 'home' | 'modes' {
  return format === MAIN_FORMAT && bestOf === DEFAULT_BEST_OF ? 'home' : 'modes';
}

/** A way to play on Other modes: a Best of 3 in one format, or Free play (one match). */
export type OtherMode =
  { readonly kind: 'series'; readonly format: Format } | { readonly kind: 'free' };

export interface ModeSection {
  readonly title: string;
  /** A series section: the length (Best of 3 or 5) is chosen above its cards, and remembered. */
  readonly lengthChoice?: boolean;
  readonly modes: readonly OtherMode[];
}

/**
 * Other modes, in order. A series against the bot at either length, in order of skill: Reveal
 * (home's mode, listed for Best of 5), Showdown, then Blind, the casual "set it and watch" series.
 * Free play is one match with both balls chosen.
 */
export const OTHER_MODE_SECTIONS: readonly ModeSection[] = [
  {
    title: 'Series vs bot',
    lengthChoice: true,
    modes: [
      { kind: 'series', format: 'reveal' },
      { kind: 'series', format: 'showdown' },
      { kind: 'series', format: 'blind' },
    ],
  },
  { title: 'One match', modes: [{ kind: 'free' }] },
];
