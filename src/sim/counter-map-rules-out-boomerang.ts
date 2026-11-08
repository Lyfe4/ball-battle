// Counter-map entries for every pair with the Boomerang, from the roster redesign's first group
// (ADR 0045): the Storm, Quake, Berserker, Vampire, Archer, Sniper and Boomerang, each pair in the
// file of the first of its balls in that order. The map is in counter-map.ts; its checks in
// scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
 * the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
 * from range, lifesteal drinks only from bumps, and rage grows with every wound. A favoured pair
 * names its band: `kind` when a kind of hit decides it, `movement` when speed, size, range or a pull
 * does.
 */
export const RULES_OUT_BOOMERANG_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'bloom',
    y: 'boomerang',
    intended: 'x',
    band: 'kind',
    reason: 'Each boomerang hit is small, and it regrows it back before the next throw.',
  },
  {
    x: 'boomerang',
    y: 'bomber',
    intended: 'even',
    reason: 'It throws from range and seldom crosses the bombs, but its hits are light.',
  },
  {
    x: 'boomerang',
    y: 'ghost',
    intended: 'x',
    band: 'kind',
    reason: 'A boomerang in flight still hits it phased, and comes back to hit again.',
  },
  {
    x: 'boomerang',
    y: 'guardian',
    intended: 'even',
    reason: 'The throw breaks the shield and the catch lands, but each hit is light.',
  },
  {
    x: 'boomerang',
    y: 'inferno',
    intended: 'even',
    reason: 'It throws from range, but the fire burns it wherever it crosses.',
  },
  {
    x: 'brawler',
    y: 'boomerang',
    intended: 'even',
    reason: 'It chips from range, the Brawler hits hard up close: plain trades decide it.',
  },
  {
    x: 'chrono',
    y: 'boomerang',
    intended: 'even',
    reason: 'Two light hits a throw, and a rewind undoes about one of them.',
  },
  {
    x: 'frost',
    y: 'boomerang',
    intended: 'even',
    reason: 'The slowest ball is the easiest to hit twice, and its heavy hits pay it back.',
  },
  {
    x: 'magnet',
    y: 'boomerang',
    intended: 'x',
    band: 'movement',
    reason: 'Pulls the frail thrower into a brawl.',
  },
  {
    x: 'necromancer',
    y: 'boomerang',
    intended: 'x',
    band: 'movement',
    reason: 'A skull nearer than its owner draws the throw, and a skull stops a boomerang dead.',
  },
  {
    x: 'speedster',
    y: 'boomerang',
    intended: 'x',
    band: 'movement',
    reason: 'It outruns the throw and closes in while the boomerang is away.',
  },
  {
    x: 'thorns',
    y: 'boomerang',
    intended: 'even',
    reason: 'The boomerang never touches the spikes, and Thorns soaks its light hits.',
  },
  {
    x: 'titan',
    y: 'boomerang',
    intended: 'x',
    band: 'movement',
    reason: 'The growing body meets it more often, and its light hits lose every trade.',
  },
  {
    x: 'venom',
    y: 'boomerang',
    intended: 'even',
    reason: 'Poison works between throws, and its light hits can’t stop the boomerang.',
  },
];
