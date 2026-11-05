import type { Lean } from './matchups.ts';

/**
 * The matchup marks, one set for every screen: ▲ favoured, ▼ unfavoured, = even. Each is explained
 * once in the symbol legend (symbol-legend.ts) and always comes with words in the accessible name.
 */
export const MARKS: Readonly<Record<Lean, string>> = { favoured: '▲', unfavoured: '▼', even: '=' };

/** The words a mark stands for, before the other ball's name: "favoured against Frost". */
export const LEAN_WORDS: Readonly<Record<Lean, string>> = {
  favoured: 'favoured against',
  unfavoured: 'unfavoured against',
  even: 'even with',
};
