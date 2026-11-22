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
    reason: 'The Titan grows and bumps harder as it goes; the Brawler hits hard from the start.',
  },
  {
    x: 'titan',
    y: 'speedster',
    intended: 'x',
    level: 'edge',
    reason: 'The Speedster’s rush lands while the Titan is small; grown, the Titan bumps harder.',
  },
  {
    x: 'titan',
    y: 'frost',
    intended: 'even',
    reason: 'The Titan grows and bumps harder, and every Frost bump slows it.',
  },
  {
    x: 'thorns',
    y: 'titan',
    intended: 'x',
    level: 'edge',
    reason: 'The bigger the Titan grows, the harder each bump comes back off the Thorns’ spikes.',
  },
  {
    x: 'titan',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet’s pull drags the growing Titan into the bumps both of them want.',
  },
  {
    x: 'titan',
    y: 'necromancer',
    intended: 'even',
    reason: 'The Titan meets each skull as it grows, and the Necromancer raises a new one.',
  },
  // The Inferno.
  {
    x: 'brawler',
    y: 'inferno',
    intended: 'even',
    reason: 'The Inferno’s fire burns the Brawler, and the Brawler bumps far harder.',
  },
  {
    x: 'speedster',
    y: 'inferno',
    intended: 'x',
    level: 'edge',
    reason: 'The Speedster races through the Inferno’s fire and bumps harder between burns.',
  },
  {
    x: 'inferno',
    y: 'frost',
    intended: 'even',
    reason: 'The slow Frost lingers in the Inferno’s fire, and its bumps slow the Inferno.',
  },
  {
    x: 'inferno',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason: 'The Inferno’s fire never touches the spikes, and it burns the slow Thorns.',
  },
  {
    x: 'magnet',
    y: 'inferno',
    intended: 'even',
    reason: 'The Magnet pulls the Inferno in, and into the Inferno’s fire trail too.',
  },
  {
    x: 'inferno',
    y: 'necromancer',
    intended: 'x',
    level: 'edge',
    reason: 'The Inferno’s fire burns up the skulls, and the Necromancer behind them.',
  },
  // The three with each other.
  {
    x: 'inferno',
    y: 'titan',
    intended: 'even',
    reason: 'The growing Titan crosses more of the Inferno’s fire, but bumps harder as it grows.',
  },
];
