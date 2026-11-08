// Counter-map entries for batch 4: the Chrono, Titan and Inferno (ADR 0034), one per pair with every
// earlier ball and each other. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Each counter was measured before it was kept (ADR 0034). The Chrono's rewind undoes the last
 * half second, so it undoes a single big hit (a stacked rush, a strike, a shot) and little of a
 * drip: what a Vampire drank and poison still on it are not rewound. The Titan's growing body
 * meets its enemy more often and shrugs light balls off, so light hitters lose the trade; spikes
 * and fire get more of it. The Inferno's fire burns what lingers or crosses it, phased or not, and
 * burns skulls up; a fast ball outruns it and a ranged one never crosses it.
 * Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
 * counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules, and every
 * other pair with the Chrono, Guardian, Ghost, Bloom or Venom to counter-map-hit-kinds-*.ts with
 * the redesign's second group.
 */
export const BATCH_FOUR_ENTRIES: readonly CounterEntry[] = [
  // The Chrono.
  // The Titan.
  {
    x: 'brawler',
    y: 'titan',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'titan',
    y: 'speedster',
    intended: 'x',
    band: 'movement',
    reason: 'Light and fast, it bounces off the growing body, and its light hits lose the trade.',
  },
  {
    x: 'titan',
    y: 'frost',
    intended: 'even',
    reason: 'Two sturdy balls trading heavy hits; the slow barely matters to the bigger one.',
  },
  {
    x: 'thorns',
    y: 'titan',
    intended: 'even',
    reason:
      'Every bump comes back off the spikes, but the giant’s health soaks it: plain trades decide it.',
  },
  {
    x: 'titan',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull forces the brawl both of them want.',
  },
  {
    x: 'titan',
    y: 'necromancer',
    intended: 'even',
    reason: 'The growing body meets the skull often, but the Necromancer keeps raising another.',
  },
  // The Inferno.
  {
    x: 'brawler',
    y: 'inferno',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'speedster',
    y: 'inferno',
    intended: 'even',
    reason: 'It crosses the fire quickly, but it crosses it often: neither side gains.',
  },
  {
    x: 'inferno',
    y: 'frost',
    intended: 'even',
    reason: 'The slowest ball lingers in the fire, but hits hard enough to pay it back.',
  },
  {
    x: 'inferno',
    y: 'thorns',
    intended: 'x',
    band: 'kind',
    reason: 'Fire never touches the spikes, so there is nothing to reflect.',
  },
  {
    x: 'magnet',
    y: 'inferno',
    intended: 'even',
    reason: 'The pull drags it into a brawl, and into its own fire too.',
  },
  {
    x: 'inferno',
    y: 'necromancer',
    intended: 'x',
    band: 'movement',
    reason: 'The fire burns up the skulls, and the Necromancer behind them.',
  },
  // The three with each other.
  {
    x: 'inferno',
    y: 'titan',
    intended: 'even',
    reason: 'The bigger the body, the more fire it covers, but its huge bumps pay it back.',
  },
];
