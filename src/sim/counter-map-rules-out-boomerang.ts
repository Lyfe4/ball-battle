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
    reason: 'The Boomerang’s throw hits out and back, so the Bloom is rarely left alone for 2 s.',
  },
  {
    x: 'boomerang',
    y: 'bomber',
    intended: 'even',
    reason:
      'The Boomerang throws from range and seldom crosses the Bomber’s bombs, but hits lightly.',
  },
  {
    x: 'boomerang',
    y: 'inferno',
    intended: 'x',
    level: 'edge',
    reason: 'The Boomerang hits the Inferno twice a throw, more than the fire burns back.',
  },
  {
    x: 'brawler',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Boomerang chips from range, and the Brawler bumps hard up close.',
  },
  {
    x: 'chrono',
    y: 'boomerang',
    intended: 'y',
    level: 'edge',
    reason: 'The Boomerang’s 7 is far too small for the Chrono to rewind, and it can hit twice.',
  },
  {
    x: 'frost',
    y: 'boomerang',
    intended: 'even',
    reason: 'The slow Frost is easy for the Boomerang to hit twice, but its big health holds out.',
  },
  {
    x: 'magnet',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
    reason: 'Every boomerang hit on the Magnet starts a pull, dragging the Boomerang into a brawl.',
  },
  {
    x: 'necromancer',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
    reason: 'The Boomerang throws at the Necromancer’s skull when nearer, and the skull stops it.',
  },
  {
    x: 'speedster',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
    reason: 'The Speedster outruns the Boomerang’s throw and closes in while it is away.',
  },
  {
    x: 'thorns',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Boomerang’s throw never touches the spikes, and the Thorns’ big health takes it.',
  },
  {
    x: 'titan',
    y: 'boomerang',
    intended: 'x',
    level: 'edge',
    reason: 'The Boomerang’s throws land while the Titan is small, but it grows and bumps harder.',
  },
  {
    x: 'venom',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Venom poisons with each bump, and the Boomerang chips it between them.',
  },
];
