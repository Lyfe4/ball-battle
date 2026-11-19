// How ruleset 19's bots read the counter map (ADR 0073), kept so a series played against them
// still verifies and replays exactly: ruleset 20 changed only the bots, never a fight. Ruleset 19
// had two levels, favoured or even, and Hard valued a round at 64 / 50 / 36%. Its map was today's
// with these 49 pairs even: the edges ruleset 20 labelled from the same 500-seed run. Delete this
// file (and `SAME_FIGHTS_AS`'s 19) with the first ruleset that changes a fight.
import type { MapReading } from './bot.ts';
import { matchupOf } from './counter-map.ts';

/** The pairs that were even in ruleset 19 and are edges today, favoured ball first. */
export const EVEN_IN_R19: readonly (readonly [string, string])[] = [
  ['vampire', 'speedster'],
  ['magnet', 'speedster'],
  ['chrono', 'speedster'],
  ['titan', 'speedster'],
  ['speedster', 'inferno'],
  ['bloom', 'speedster'],
  ['vampire', 'frost'],
  ['vampire', 'thorns'],
  ['vampire', 'chrono'],
  ['vampire', 'titan'],
  ['bomber', 'vampire'],
  ['vampire', 'bloom'],
  ['vampire', 'battery'],
  ['archer', 'frost'],
  ['archer', 'chrono'],
  ['titan', 'archer'],
  ['archer', 'hex'],
  ['hex', 'storm'],
  ['frost', 'quake'],
  ['frost', 'magnet'],
  ['boomerang', 'frost'],
  ['spartan', 'frost'],
  ['frost', 'slime'],
  ['thorns', 'berserker'],
  ['inferno', 'thorns'],
  ['spartan', 'thorns'],
  ['bloom', 'thorns'],
  ['hex', 'thorns'],
  ['venom', 'slime'],
  ['berserker', 'necromancer'],
  ['sniper', 'inferno'],
  ['hex', 'sniper'],
  ['quake', 'chrono'],
  ['bomber', 'ghost'],
  ['ghost', 'slime'],
  ['hex', 'necromancer'],
  ['boomerang', 'chrono'],
  ['spider', 'chrono'],
  ['inferno', 'titan'],
  ['spartan', 'titan'],
  ['hex', 'titan'],
  ['boomerang', 'inferno'],
  ['spartan', 'inferno'],
  ['boomerang', 'hex'],
  ['bomber', 'bloom'],
  ['bloom', 'battery'],
  ['bloom', 'slime'],
  ['hex', 'spider'],
  ['slime', 'hex'],
];

const evenInR19 = new Set(EVEN_IN_R19.map(([a, b]) => [a, b].sort().join('|')));

/** 1 when `ball` was favoured against `opponent` in ruleset 19, -1 when the other was, else 0. */
function standingInR19(ball: string, opponent: string): number {
  const matchup = matchupOf(ball, opponent);
  if (matchup === undefined || evenInR19.has([ball, opponent].sort().join('|'))) return 0;
  return matchup.favoured === ball ? 1 : -1;
}

/** Ruleset 19's round odds, exactly as written then (not 1 minus the favoured side's). */
const R19_ODDS = { favoured: 0.64, even: 0.5, unfavoured: 0.36 } as const;

export const R19_READING: MapReading = {
  standing: standingInR19,
  odds: (ball, against) => {
    const standing = standingInR19(ball, against);
    return standing > 0 ? R19_ODDS.favoured : standing < 0 ? R19_ODDS.unfavoured : R19_ODDS.even;
  },
};
