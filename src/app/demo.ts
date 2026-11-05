// The home screen's demo: matches that each show a counter from the counter map, so the first thing a
// visitor watches is the idea the game is built on ("Storm is favoured against Vampire, because...").
import { COUNTER_MAP } from '../sim/counter-map.ts';
import type { Matchup } from './matchup.ts';

export interface DemoPair {
  /** Slot A is the favoured ball, so the caption and the arena read the same way round. */
  readonly matchup: Matchup;
  readonly reason: string;
}

/** Every favoured pair in the counter map, favoured ball first, in map order. */
export const DEMO_PAIRS: readonly DemoPair[] = COUNTER_MAP.filter(
  (entry) => entry.intended !== 'even',
).map((entry) => ({
  matchup: entry.intended === 'x' ? { a: entry.x, b: entry.y } : { a: entry.y, b: entry.x },
  reason: entry.reason,
}));

/** The demo after `index`, wrapping round; any whole number works, so a random start is fine. */
export function demoAt(index: number): DemoPair {
  const count = DEMO_PAIRS.length;
  const pair = DEMO_PAIRS[((Math.trunc(index) % count) + count) % count];
  if (pair === undefined) throw new Error('The counter map has no favoured pair to demo');
  return pair;
}
