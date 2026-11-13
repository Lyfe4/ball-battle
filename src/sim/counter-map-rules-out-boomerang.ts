// Counter-map entries for every pair with the Boomerang, from the roster redesign's first group
// (ADR 0045): the Storm, Quake, Berserker, Vampire, Archer, Sniper and Boomerang, each pair in the
// file of the first of its balls in that order. The map is in counter-map.ts; its checks in
// scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
 * the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
 * from range, lifesteal drinks most of what its bumps deal, and rage grows with every hit taken.
 */
export const RULES_OUT_BOOMERANG_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'bloom',
    y: 'boomerang',
    intended: 'y',
    reason: 'The boomerang hits twice a throw, and every hit stops the regrowth.',
  },
  {
    x: 'boomerang',
    y: 'bomber',
    intended: 'even',
    reason: 'It throws from range and seldom crosses the bombs, but its hits are light.',
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
    reason: 'Its light hits are far too small to rewind: plain trades decide it.',
  },
  {
    x: 'frost',
    y: 'boomerang',
    intended: 'y',
    reason: 'The slowest ball is the easiest to hit twice a throw, and it can’t catch the thrower.',
  },
  {
    x: 'magnet',
    y: 'boomerang',
    intended: 'even',
    reason:
      'The pull drags the thrower into a brawl, but the boomerang keeps hitting: neither pulls ahead.',
  },
  {
    x: 'necromancer',
    y: 'boomerang',
    intended: 'x',
    reason: 'A skull nearer than its owner draws the throw, and a skull stops a boomerang dead.',
  },
  {
    x: 'speedster',
    y: 'boomerang',
    intended: 'x',
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
    intended: 'even',
    reason: 'Its throws land while the Titan is small; once grown, its bumps win: it evens out.',
  },
  {
    x: 'venom',
    y: 'boomerang',
    intended: 'even',
    reason: 'Poison works between throws, and its light hits can’t stop the boomerang.',
  },
];
