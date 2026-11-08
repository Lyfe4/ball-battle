// Counter-map entries for batch 4: the Chrono, Titan and Inferno (ADR 0034), one per pair with every
// earlier ball and each other. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Each counter was measured before it was kept (ADR 0034). The Chrono's rewind undoes the last
 * half second, so it undoes a single big hit (a stacked rush, a strike, a shot) and little of a
 * drip: what a Vampire drank and poison still on it are not rewound. The Titan's growing body
 * meets its enemy more often and shrugs light balls off, so light hitters lose the trade; spikes
 * and fire get more of it. The Inferno's fire burns what lingers or crosses it, phased or not, and
 * burns skulls up; a fast ball outruns it and a ranged one never crosses it. Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
 * counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules.
 */
export const BATCH_FOUR_ENTRIES: readonly CounterEntry[] = [
  // The Chrono.
  {
    x: 'brawler',
    y: 'chrono',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'chrono',
    y: 'speedster',
    intended: 'x',
    band: 'kind',
    reason: 'Its stacked rush is one big hit, and the rewind undoes it.',
  },
  {
    x: 'chrono',
    y: 'frost',
    intended: 'even',
    reason: 'The slow stays on after a rewind, and the Frost hits hard either way.',
  },
  {
    x: 'chrono',
    y: 'thorns',
    intended: 'even',
    reason: 'Spikes hurt it on its own hits, and the rewind undoes only the last of them.',
  },
  {
    x: 'venom',
    y: 'chrono',
    intended: 'x',
    band: 'kind',
    reason: 'Poison isn’t rewound: it keeps ticking, so a rewind gives back little.',
  },
  {
    x: 'chrono',
    y: 'magnet',
    intended: 'even',
    reason: 'A forced brawl trades hits, and the rewind undoes just one.',
  },
  {
    x: 'ghost',
    y: 'chrono',
    intended: 'even',
    reason: 'Hits pass through the Ghost, so the rewind has little to undo either way.',
  },
  {
    x: 'chrono',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skull pops are small hits, so a rewind undoes little.',
  },
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
    intended: 'x',
    band: 'kind',
    reason: 'The growing body meets the spikes more often, and every hard hit comes back.',
  },
  {
    x: 'titan',
    y: 'venom',
    intended: 'x',
    band: 'movement',
    reason: 'Poison only refreshes, so more meetings just mean more of its heavy hits.',
  },
  {
    x: 'titan',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull forces the brawl both of them want.',
  },
  {
    x: 'titan',
    y: 'ghost',
    intended: 'even',
    reason: 'Its hits pass through the Ghost often, and the bigger body is easy to hit back.',
  },
  {
    x: 'titan',
    y: 'necromancer',
    intended: 'x',
    band: 'movement',
    reason: 'The growing body meets it and its skulls often, and light hits lose the trade.',
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
    intended: 'x',
    band: 'movement',
    reason: 'It outruns the flames, and crosses a patch before it burns twice.',
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
    x: 'inferno',
    y: 'venom',
    intended: 'even',
    reason: 'Poison and fire: both chip away, neither needs a hard hit.',
  },
  {
    x: 'magnet',
    y: 'inferno',
    intended: 'even',
    reason: 'The pull drags it into a brawl, and into its own fire too.',
  },
  {
    x: 'inferno',
    y: 'ghost',
    intended: 'x',
    band: 'kind',
    reason: 'Fire never needed contact: a phased ball still burns.',
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
    x: 'chrono',
    y: 'titan',
    intended: 'even',
    reason: 'The Titan hits hard, and the rewind undoes about one of its hits.',
  },
  {
    x: 'chrono',
    y: 'inferno',
    intended: 'even',
    reason: 'Burns are small hits, so the rewind undoes little; the light hits lose the brawl.',
  },
  {
    x: 'inferno',
    y: 'titan',
    intended: 'x',
    band: 'movement',
    reason: 'The bigger the body, the more fire it covers.',
  },
];
