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
    level: 'strong',
    reason: 'Two hits a throw, out and back: it is never left alone for 2 s.',
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
    intended: 'x',
    level: 'edge',
    reason: 'Twice a throw from range, it hurts the Inferno more than the fire hurts it.',
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
    intended: 'y',
    level: 'edge',
    reason: 'Its light hits are far too small to rewind, and it hits twice a throw.',
  },
  {
    x: 'frost',
    y: 'boomerang',
    intended: 'even',
    reason: 'The slow Frost is easy to hit going out and back, but its big health holds out: even.',
  },
  {
    x: 'magnet',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
    reason: 'Every boomerang that hits it starts a pull, and the thrower is dragged into a brawl.',
  },
  {
    x: 'necromancer',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
    reason: 'A skull nearer than its owner draws the throw, and a skull stops a boomerang dead.',
  },
  {
    x: 'speedster',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
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
    level: 'edge',
    reason:
      'Its throws land while the Titan is small, but it grows big fast and its bumps then win.',
  },
  {
    x: 'venom',
    y: 'boomerang',
    intended: 'even',
    reason: 'Poison works between throws, and its light hits can’t stop the boomerang.',
  },
];
