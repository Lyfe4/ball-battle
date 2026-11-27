// Counter-map entries for the Minotaur (prototype): every pair of it with another ball, labelled
// from its 500-seed `pnpm balance --ball minotaur` run by the one rule (ADR 0073).
import type { CounterEntry } from './counter-map.ts';

/**
 * It marks where its enemy is, crawls, then charges in a straight line at that point: a bump
 * mid-charge lands huge, a miss shakes the wall. A ball that holds still or comes onto the line
 * takes the charge (the Kraken, the Magnet, the Jouster's own charge); area and fire on its
 * straight path and its slow wind-up punish it (the Bomber, the Inferno).
 */
export const MINOTAUR_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'minotaur',
    y: 'brawler',
    intended: 'even',
    reason:
      'Plain against plain: the Brawler out-bumps its roaming 13, and a charge that lands evens it.',
  },
  {
    x: 'minotaur',
    y: 'speedster',
    intended: 'even',
    reason:
      'The Speedster, built up off the walls, is often off the line by the time the charge arrives, but its own walls feed the shockwaves.',
  },
  {
    x: 'minotaur',
    y: 'vampire',
    intended: 'x',
    level: 'strong',
    reason:
      'A charge lands 44 in one bump, more than the Vampire’s bites can heal back between charges.',
  },
  {
    x: 'minotaur',
    y: 'archer',
    intended: 'even',
    reason:
      'The Archer’s arrows land in the Minotaur’s slow wind-up, and its charges cross a ball that keeps moving away.',
  },
  {
    x: 'minotaur',
    y: 'storm',
    intended: 'y',
    level: 'edge',
    reason:
      'The Storm’s strike is aimed at where the Minotaur will be, and the wind-up’s crawl walks it into the warning.',
  },
  {
    x: 'minotaur',
    y: 'frost',
    intended: 'even',
    reason:
      'A slowed ball stays on the line: the Frost takes charges, but its slow takes the Minotaur’s speed in return.',
  },
  {
    x: 'minotaur',
    y: 'thorns',
    intended: 'even',
    reason:
      'Its huge charge bump hits the spikes as hard as it hits the Thorns, so a hit hurts both.',
  },
  {
    x: 'minotaur',
    y: 'venom',
    intended: 'even',
    reason: 'Poison ticks through the Minotaur’s long roams; a charge lands only now and then.',
  },
  {
    x: 'minotaur',
    y: 'berserker',
    intended: 'even',
    reason: 'Every charge that lands builds the Berserker’s rage, given back on its next bump.',
  },
  {
    x: 'minotaur',
    y: 'sniper',
    intended: 'even',
    reason:
      'The Sniper’s heavy shots land during its wind-up crawl, and its charges catch it only now and then.',
  },
  {
    x: 'minotaur',
    y: 'quake',
    intended: 'even',
    reason:
      'Both shake the walls; the Quake does it on every bounce, the Minotaur only after a missed charge.',
  },
  {
    x: 'minotaur',
    y: 'magnet',
    intended: 'x',
    level: 'edge',
    reason: 'The Magnet pulls itself onto the Minotaur’s charge line, so its charges land.',
  },
  {
    x: 'minotaur',
    y: 'ghost',
    intended: 'even',
    reason:
      'A charge that meets a phased Ghost passes through for nothing and runs on into the wall.',
  },
  {
    x: 'minotaur',
    y: 'necromancer',
    intended: 'even',
    reason: 'The skeleton is in the way: a charge spent on it is no hit on the Necromancer.',
  },
  {
    x: 'minotaur',
    y: 'chrono',
    intended: 'y',
    level: 'edge',
    reason: 'The Chrono rewinds a hit of its size: a landed charge is undone.',
  },
  {
    x: 'minotaur',
    y: 'titan',
    intended: 'even',
    reason: 'A charge lands big on the early Titan; the grown Titan out-bumps its roaming.',
  },
  {
    x: 'minotaur',
    y: 'inferno',
    intended: 'y',
    level: 'strong',
    reason:
      'Its charges run it in a straight line through the Inferno’s fire, and a miss leaves it by the burning wall.',
  },
  {
    x: 'minotaur',
    y: 'boomerang',
    intended: 'even',
    reason:
      'The Boomerang’s throws land in its wind-up crawl; its charges land on a ball that stops to catch.',
  },
  {
    x: 'minotaur',
    y: 'bomber',
    intended: 'y',
    level: 'strong',
    reason: 'A charge runs straight through the Bomber’s bombs and sets them off on itself.',
  },
  {
    x: 'minotaur',
    y: 'spartan',
    intended: 'even',
    reason: 'A planted shield is a still target on the line, but it halves the charge that lands.',
  },
  {
    x: 'minotaur',
    y: 'bloom',
    intended: 'even',
    reason:
      'A landed charge stops the Bloom’s regrowth, but the misses give it the time to regrow.',
  },
  {
    x: 'minotaur',
    y: 'hex',
    intended: 'even',
    reason: 'The Hex’s curse takes a share of its health whether its charges land or not.',
  },
  {
    x: 'minotaur',
    y: 'spider',
    intended: 'even',
    reason:
      'Its webs slow a ball that bounces off a wall, and a missed charge always ends at a wall.',
  },
  {
    x: 'minotaur',
    y: 'battery',
    intended: 'even',
    reason: 'The Battery stores big strikes, but a bump is no strike: a charge lands whole.',
  },
  {
    x: 'minotaur',
    y: 'slime',
    intended: 'y',
    level: 'edge',
    reason:
      'A Slime splits into two small halves, and a straight charge at one leaves the other free.',
  },
  {
    x: 'minotaur',
    y: 'balloon',
    intended: 'even',
    reason:
      'A charge is a bump, which the floating Balloon takes whole; its shockwave is an area hit, which it halves.',
  },
  {
    x: 'minotaur',
    y: 'banshee',
    intended: 'even',
    reason:
      'The wail lands whether its charges do or not; a charge that lands takes a big share back.',
  },
  {
    x: 'minotaur',
    y: 'kraken',
    intended: 'x',
    level: 'edge',
    reason:
      'The anchored Kraken holds still to grab, and a still ball on the line takes the whole charge.',
  },
  {
    x: 'minotaur',
    y: 'mirage',
    intended: 'even',
    reason:
      'The charge is aimed at the Mirage itself, never its copy, so the decoy does nothing against it.',
  },
  {
    x: 'minotaur',
    y: 'jouster',
    intended: 'x',
    level: 'strong',
    reason:
      'The Jouster charges straight back down the same line: the Minotaur’s 44 out-hits its 33 lance.',
  },
];
