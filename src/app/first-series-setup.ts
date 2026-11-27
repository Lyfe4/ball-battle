// What the guided first series plays (ADR 0090): Best of 3 · Reveal against the Easy bot (D1), on a
// seed chosen for the player's lineup (first-series-seed.ts), and Pick for me's lineup. No DOM
// here: the measuring script imports it.
import { easyBot } from '../sim/bot.ts';
import type { BestOf, Format } from '../sim/series.ts';

/**
 * The first series: Best of 3 · Reveal · vs Easy bot, Best of 3 for fewer picks and a shorter first
 * series though a new series is Best of 5 after it (ADR 0090 addendum). Never saved as Play's.
 */
export const FIRST_SERIES: {
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly level: string;
} = {
  format: 'reveal',
  bestOf: 3,
  level: easyBot.id,
};

/**
 * Pick for me's lineup: three balls whose ability reads at a glance (a fighter, a shooter, a
 * poisoner), named by id so the roster's size and order never matter. A ball missing from the build
 * is left out by `starterTrio`.
 */
export const STARTER_TRIO: readonly string[] = ['brawler', 'archer', 'venom'];

/**
 * Pick for me's three balls among `roster`: the starter trio, any it lacks filled from the roster in
 * its order. Never fewer than three while the roster has three.
 */
export function starterTrio(roster: readonly string[]): readonly string[] {
  const chosen = STARTER_TRIO.filter((id) => roster.includes(id));
  for (const id of roster) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  return chosen.slice(0, 3);
}
