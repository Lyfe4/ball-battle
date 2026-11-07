// Every symbol the screens use and what it means, in one place (ADR 0025): the symbol legend (the
// `?` in a screen's header) and the hover and focus tooltips (symbol-tooltip.ts) both read their
// words from here, so the two can never disagree. A symbol on screen names its entry with
// `data-symbol` (`markSymbol` in symbol-tooltip.ts), which is how a tooltip finds what to say.
import type { Lean } from './balls/matchups.ts';
import { MARKS } from './balls/marks.ts';

export type SymbolKey =
  Lean | 'unknown' | 'won' | 'lost' | 'replay' | 'suddenDeath' | 'more' | 'cue';

export interface SymbolEntry {
  /** The symbol as text; empty for one drawn as a swatch (a ring, a dimmed ball, the rule cue). */
  readonly mark: string;
  /** What it means: the legend's line and the tooltip's text. */
  readonly meaning: string;
  /** Said only in the legend, after the meaning: how a screen shows it. */
  readonly legendNote?: string;
}

/** In the legend's order. */
export const SYMBOLS: Readonly<Record<SymbolKey, SymbolEntry>> = {
  favoured: {
    mark: MARKS.favoured,
    meaning: 'Favoured: this ball tends to win the matchup',
    legendNote: 'on a pick row, your ball against the bot’s',
  },
  unfavoured: {
    mark: MARKS.unfavoured,
    meaning: 'Unfavoured: the other ball tends to win',
    legendNote: 'on a pick row, the bot’s ball',
  },
  even: { mark: MARKS.even, meaning: 'Even matchup', legendNote: 'left blank in grids' },
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
  cue: { mark: '', meaning: 'In a fight: a rule between two balls just kicked in (see each ball)' },
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
