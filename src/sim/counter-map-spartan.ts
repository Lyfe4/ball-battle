// Counter-map entries for the Spartan (ADR 0047), the Guardian's replacement: every pair of the
// Spartan with another ball. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The Spartan plants its shield (every hit does half while it is up, and it slows down), then throws
 * one heavy spear and fights in the open. Half of a hit is half whoever deals it, so the shield
 * decides few pairs on its own: it beats the ball that lives on its own bumps, and loses to the
 * strike it is too slow to leave and the rewind that undoes its spear.
 */
export const SPARTAN_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'spartan',
    y: 'brawler',
    intended: 'even',
    reason: 'The Spartan’s shield halves the Brawler’s hard bumps; in the open they land whole.',
  },
  {
    x: 'spartan',
    y: 'speedster',
    intended: 'even',
    reason: 'The Spartan’s shield halves the Speedster’s rushes, but the spear rarely catches it.',
  },
  {
    x: 'spartan',
    y: 'vampire',
    intended: 'x',
    level: 'strong',
    reason: 'The Spartan’s shield halves the Vampire’s bumps, so it heals half as much.',
  },
  {
    x: 'spartan',
    y: 'archer',
    intended: 'even',
    reason: 'The Spartan’s shield halves the Archer’s arrows while planted; the rest land whole.',
  },
  {
    x: 'spartan',
    y: 'storm',
    intended: 'y',
    level: 'strong',
    reason: 'The planted Spartan is too slow to leave the Storm’s circle, and half a strike is 21.',
  },
  {
    x: 'spartan',
    y: 'frost',
    intended: 'even',
    reason:
      'The Spartan’s shield halves the Frost’s bumps, and the slow Frost is easy for the spear.',
  },
  {
    x: 'spartan',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason: 'The Spartan’s spear never meets the spikes, and its shield halves the Thorns’ bumps.',
  },
  {
    x: 'spartan',
    y: 'venom',
    intended: 'even',
    reason: 'The Spartan’s shield halves the Venom’s poison, but only while it is planted.',
  },
  {
    x: 'spartan',
    y: 'berserker',
    intended: 'even',
    reason: 'Half of a raging Berserker bump is still a big one for the Spartan.',
  },
  {
    x: 'spartan',
    y: 'sniper',
    intended: 'y',
    level: 'edge',
    reason: 'Planted, the Spartan is too slow to leave the Sniper’s 0.2 s lock.',
  },
  {
    x: 'spartan',
    y: 'quake',
    intended: 'even',
    reason: 'The Spartan’s shield halves the Quake’s shockwaves, but only while it is planted.',
  },
  {
    x: 'spartan',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet pulls the Spartan into bumps, halved or whole.',
  },
  {
    x: 'spartan',
    y: 'necromancer',
    intended: 'even',
    reason:
      'The Spartan’s shield halves skull bites, and its spear clears the Necromancer’s skull.',
  },
  {
    x: 'spartan',
    y: 'chrono',
    intended: 'y',
    level: 'strong',
    reason: 'The Spartan’s spear hits for 28, a big hit the Chrono rewinds.',
  },
  {
    x: 'spartan',
    y: 'titan',
    intended: 'x',
    level: 'edge',
    reason:
      'The Spartan’s shield halves the Titan’s bumps, and the grown Titan can’t dodge the spear.',
  },
  {
    x: 'spartan',
    y: 'inferno',
    intended: 'x',
    level: 'edge',
    reason: 'The Spartan’s shield cuts each Inferno burn to 1, and the spear hits for 28.',
  },
  {
    x: 'spartan',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Spartan’s shield halves the Boomerang’s throw, but only while it is planted.',
  },
  {
    x: 'spartan',
    y: 'bomber',
    intended: 'even',
    reason: 'A Bomber blast halves on the planted shield, but the slow Spartan walks into bombs.',
  },
  {
    x: 'spartan',
    y: 'bloom',
    intended: 'even',
    reason: 'The Spartan’s spear shuts the Bloom’s bud, and its shield halves the Bloom’s bumps.',
  },
];
