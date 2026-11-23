// The matchup chart's words (ADR 0073 addendum of 2026-11-23), pure: which of the five bands a
// ball sits in against the chosen one, each band's heading from the chosen ball's side (it is
// "you", as on the pick screens, where a green ▲ means you're favoured), and each ball's
// accessible name, which says the level so nothing relies on the tint.
import { leanOf, levelOf, oddsWordsOf, type Lean } from '../balls/matchups.ts';
import type { Level } from '../../sim/counter-map.ts';

/**
 * The spectrum, left to right (top to bottom on a phone), from the chosen ball's side: what it
 * beats first, what beats it last.
 */
export type Band = 'beats' | 'edge' | 'even' | 'edged' | 'beaten';
export const BANDS: readonly Band[] = ['beats', 'edge', 'even', 'edged', 'beaten'];

/** Which band `ball` sits in on `against`'s chart: `against`'s lean and level against it. */
export function bandOf(ball: string, against: string): Band {
  const lean = leanOf(against, ball);
  const strong = levelOf(against, ball) === 'strong';
  if (lean === 'favoured') return strong ? 'beats' : 'edge';
  if (lean === 'unfavoured') return strong ? 'beaten' : 'edged';
  return 'even';
}

/** A band's lean and level, from the chosen ball's side: its mark. */
export function bandMark(band: Band): { readonly lean: Lean; readonly level: Level | undefined } {
  if (band === 'beats') return { lean: 'favoured', level: 'strong' };
  if (band === 'edge') return { lean: 'favoured', level: 'edge' };
  if (band === 'edged') return { lean: 'unfavoured', level: 'edge' };
  if (band === 'beaten') return { lean: 'unfavoured', level: 'strong' };
  return { lean: 'even', level: undefined };
}

/** A band's heading, from the chosen ball's side: "Thorns beats" ... "Beats Thorns". */
export function bandTitle(band: Band, againstName: string): string {
  switch (band) {
    case 'beats':
      return `${againstName} beats`;
    case 'edge':
      return `${againstName} has the edge`;
    case 'even':
      return 'Even';
    case 'edged':
      return `Edge on ${againstName}`;
    case 'beaten':
      return `Beats ${againstName}`;
  }
}

/**
 * A chip's accessible name, the chosen ball's level against it and who wins those odds: "Archer:
 * Thorns slightly unfavoured, Archer wins about 6 in 10", "Brawler: Thorns strongly favoured,
 * Thorns wins about 7 in 10", "Frost: even with Thorns, about 1 in 2".
 */
export function chipLabel(ball: string, against: string, nameOf: (id: string) => string): string {
  const lean = leanOf(against, ball);
  if (lean === 'even') return `${nameOf(ball)}: even with ${nameOf(against)}, about 1 in 2`;
  const how = levelOf(against, ball) === 'strong' ? 'strongly' : 'slightly';
  const winner = lean === 'favoured' ? against : ball;
  return `${nameOf(ball)}: ${nameOf(against)} ${how} ${lean}, ${nameOf(winner)} wins ${oddsWordsOf(ball, against)}`;
}
