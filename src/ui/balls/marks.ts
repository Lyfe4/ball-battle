import type { Lean } from './matchups.ts';

/**
 * The matchup marks, one set for every screen (ADR 0073): ▲ favoured by an edge, ▼ the other ball
 * favoured by an edge, = even; a strong counter doubles its arrow, ▲▲ or ▼▼, on a disc filled in
 * its side's colour. Each is explained once in the symbol legend (symbol-legend.ts) and always
 * comes with words in the accessible name.
 */
export const MARKS: Readonly<Record<Lean, string>> = { favoured: '▲', unfavoured: '▼', even: '=' };

/** A strong counter's mark: the edge's arrow, twice. */
export const STRONG_MARKS: Readonly<Record<Exclude<Lean, 'even'>, string>> = {
  favoured: '▲▲',
  unfavoured: '▼▼',
};
