// The matchup chart's words (ADR 0073 addendum of 2026-11-23), pure: which of the five bands a
// ball sits in against the chosen one, each band's heading from one point of view (the balls in
// it), and each ball's accessible name, which says the level so nothing relies on the tint.
import { leanOf, leanWordsOf, levelOf, oddsWordsOf, type Lean } from '../balls/matchups.ts';
import type { Level } from '../../sim/counter-map.ts';

/** The spectrum, left to right (top to bottom on a phone): from a strong counter to being countered. */
export type Band = 'beats' | 'edge' | 'even' | 'edged' | 'beaten';
export const BANDS: readonly Band[] = ['beats', 'edge', 'even', 'edged', 'beaten'];

/** Which band `ball` sits in against `against`: its own lean and level. */
export function bandOf(ball: string, against: string): Band {
  const lean = leanOf(ball, against);
  const strong = levelOf(ball, against) === 'strong';
  if (lean === 'favoured') return strong ? 'beats' : 'edge';
  if (lean === 'unfavoured') return strong ? 'beaten' : 'edged';
  return 'even';
}

/** A band's lean and level, from the point of view of the balls in it: its mark. */
export function bandMark(band: Band): { readonly lean: Lean; readonly level: Level | undefined } {
  if (band === 'beats') return { lean: 'favoured', level: 'strong' };
  if (band === 'edge') return { lean: 'favoured', level: 'edge' };
  if (band === 'edged') return { lean: 'unfavoured', level: 'edge' };
  if (band === 'beaten') return { lean: 'unfavoured', level: 'strong' };
  return { lean: 'even', level: undefined };
}

/** A band's heading, from one point of view: "Beats Thorns" ... "Thorns beats". */
export function bandTitle(band: Band, againstName: string): string {
  switch (band) {
    case 'beats':
      return `Beats ${againstName}`;
    case 'edge':
      return `Edge on ${againstName}`;
    case 'even':
      return 'Even';
    case 'edged':
      return `${againstName} has the edge`;
    case 'beaten':
      return `${againstName} beats`;
  }
}

/**
 * A chip's accessible name, saying the level and who wins those odds: "Archer: slightly favoured
 * against Thorns, wins about 6 in 10", "Brawler: strongly unfavoured against Thorns, Thorns wins
 * about 7 in 10", "Frost: even with Thorns, about 1 in 2".
 */
export function chipLabel(ball: string, against: string, nameOf: (id: string) => string): string {
  const odds = oddsWordsOf(ball, against);
  const lean = leanOf(ball, against);
  const who =
    lean === 'favoured'
      ? `wins ${odds}`
      : lean === 'unfavoured'
        ? `${nameOf(against)} wins ${odds}`
        : odds;
  return `${nameOf(ball)}: ${leanWordsOf(ball, against)} ${nameOf(against)}, ${who}`;
}
