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
    reason: 'Half a hard bump while planted, a whole one in the open: plain trades decide it.',
  },
  {
    x: 'spartan',
    y: 'speedster',
    intended: 'even',
    reason: 'The shield halves its rushes, but the Speedster is gone before the spear lands.',
  },
  {
    x: 'spartan',
    y: 'vampire',
    intended: 'x',
    reason: 'Its bumps do half against the planted shield, so the Vampire drinks half as much.',
  },
  {
    x: 'spartan',
    y: 'archer',
    intended: 'even',
    reason: 'The shield halves the arrows that hit while it is up; the rest land whole.',
  },
  {
    x: 'spartan',
    y: 'storm',
    intended: 'y',
    reason: 'Slowed behind its shield it can’t leave the circle, and half a strike is still big.',
  },
  {
    x: 'spartan',
    y: 'frost',
    intended: 'even',
    reason: 'Both are slow: the shield halves the cold’s bumps, the spear hits a slow target.',
  },
  {
    x: 'spartan',
    y: 'thorns',
    intended: 'even',
    reason: 'Its spear never touches the spikes, but its bumps still come back off them.',
  },
  {
    x: 'spartan',
    y: 'venom',
    intended: 'even',
    reason: 'The shield halves the poison only while it is up: neither pulls ahead.',
  },
  {
    x: 'spartan',
    y: 'berserker',
    intended: 'even',
    reason: 'Half of a raging bump is still a big one: plain trades decide it.',
  },
  {
    x: 'spartan',
    y: 'sniper',
    intended: 'even',
    reason: 'A shot halves on a planted shield and lands whole in the open: timing decides it.',
  },
  {
    x: 'spartan',
    y: 'quake',
    intended: 'even',
    reason: 'The shield halves the shockwaves only while it is up: neither pulls ahead.',
  },
  {
    x: 'spartan',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull brings bumps either way, half or whole: plain trades decide it.',
  },
  {
    x: 'spartan',
    y: 'necromancer',
    intended: 'even',
    reason: 'The shield halves the bites, and the spear clears a skeleton: neither pulls ahead.',
  },
  {
    x: 'spartan',
    y: 'chrono',
    intended: 'y',
    reason: 'The spear is a big hit: the Chrono rewinds it.',
  },
  {
    x: 'spartan',
    y: 'titan',
    intended: 'even',
    reason: 'The shield halves a giant’s bumps, but the giant grows: neither pulls ahead.',
  },
  {
    x: 'spartan',
    y: 'inferno',
    intended: 'even',
    reason: 'A planted shield halves the burns but lingers in the fire: neither pulls ahead.',
  },
  {
    x: 'spartan',
    y: 'boomerang',
    intended: 'even',
    reason: 'The shield halves the boomerang only while it is up: neither pulls ahead.',
  },
  {
    x: 'spartan',
    y: 'bomber',
    intended: 'even',
    reason: 'A blast halves on the planted shield, but a slow ball walks into bombs.',
  },
  {
    x: 'spartan',
    y: 'bloom',
    intended: 'even',
    reason: 'The spear pauses the regrowth, the shield halves the bumps: neither pulls ahead.',
  },
];
