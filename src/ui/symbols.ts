// Every symbol the screens use and what it means, in one place (ADR 0025): the symbol legend (the
// `?` in a screen's header) and the hover and focus tooltips (symbol-tooltip.ts) both read their
// words from here, so the two can never disagree. A symbol on screen names its entry with
// `data-symbol` (`markSymbol` in symbol-tooltip.ts), which is how a tooltip finds what to say.
import type { Lean } from './balls/matchups.ts';
import { MARKS } from './balls/marks.ts';

export type SymbolKey =
  | Lean
  | 'strongFavoured'
  | 'strongUnfavoured'
  | 'unknown'
  | 'won'
  | 'lost'
  | 'replay'
  | 'suddenDeath'
  | 'more'
  | 'fairPlay';

export interface SymbolEntry {
  /** The symbol as text; empty for one drawn as a swatch (a colour or a ring). */
  readonly mark: string;
  /** What it means: the legend's line and the tooltip's text. */
  readonly meaning: string;
  /** Said only in the legend, after the meaning: how a screen shows it. */
  readonly legendNote?: string;
}

/** In the legend's order. */
export const SYMBOLS: Readonly<Record<SymbolKey, SymbolEntry>> = {
  strongFavoured: {
    mark: '▲▲',
    meaning: 'Strongly favoured: this ball wins about 7 in 10',
    legendNote: 'filled; on a pick row, your ball against the bot’s',
  },
  favoured: {
    mark: MARKS.favoured,
    meaning: 'Slightly favoured: this ball wins about 6 in 10',
  },
  even: { mark: MARKS.even, meaning: 'Even: about 1 in 2', legendNote: 'left blank in grids' },
  unfavoured: {
    mark: MARKS.unfavoured,
    meaning: 'Slightly unfavoured: the other ball wins about 6 in 10',
  },
  strongUnfavoured: {
    mark: '▼▼',
    meaning: 'Strongly unfavoured: the other ball wins about 7 in 10',
    legendNote: 'filled',
  },
  unknown: { mark: '?', meaning: 'Not shown yet' },
  won: { mark: '', meaning: 'Won the round' },
  lost: { mark: '', meaning: 'Lost the round' },
  replay: { mark: '↻', meaning: 'Replayed after a draw' },
  suddenDeath: { mark: '⚡', meaning: 'Sudden death: three draws, decided by a coin flip' },
  more: {
    mark: '▾',
    meaning: 'Opens the full series track',
    legendNote: 'on the score line during a round',
  },
  fairPlay: {
    mark: '✓',
    meaning: 'Fair play: every seed matched its commitment, and this device replayed every round',
    legendNote: 'at the end of an online series',
  },
};

export const SYMBOL_KEYS = Object.keys(SYMBOLS) as readonly SymbolKey[];

const isSymbolKey = (value: string | undefined): value is SymbolKey =>
  value !== undefined && Object.hasOwn(SYMBOLS, value);

/**
 * The tooltip's text for the symbols named in `keys` (from `data-symbol`): each one's meaning once,
 * in the order shown. Unknown names are skipped, so a typo shows nothing rather than a wrong word.
 */
export function tooltipLines(keys: readonly (string | undefined)[]): readonly string[] {
  const known = keys.filter(isSymbolKey);
  return [...new Set(known)].map((key) => SYMBOLS[key].meaning);
}
