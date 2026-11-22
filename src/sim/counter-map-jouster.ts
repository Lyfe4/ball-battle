// Counter-map entries for the Jouster (ADR 0077): every pair of it with another ball, measured at
// 500 seeds in ruleset 23. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Its lance lands triple head-on and barely scratches at a glance. A still or frail target takes
 * the whole lance (the anchored Kraken, the Vampire, the Bloom between regrowths); spikes throw it
 * back, and the Slime's small halves and the wall-bouncing Quake turn its charges into glances.
 */
export const JOUSTER_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'jouster',
    y: 'brawler',
    intended: 'x',
    level: 'edge',
    reason: 'The Jouster’s head-on lance hits for 33, more than the Brawler’s 26.',
  },
  {
    x: 'jouster',
    y: 'speedster',
    intended: 'even',
    reason: 'The Speedster’s wall bounces turn many Jouster charges into glances.',
  },
  {
    x: 'jouster',
    y: 'vampire',
    intended: 'x',
    level: 'strong',
    reason: 'One head-on Jouster lance takes 33 of the Vampire’s 37 health.',
  },
  {
    x: 'jouster',
    y: 'archer',
    intended: 'x',
    level: 'edge',
    reason: 'The Jouster’s charge closes on the Archer fast, and the Archer’s bump is weak.',
  },
  {
    x: 'jouster',
    y: 'storm',
    intended: 'even',
    reason: 'Lightning hits the Jouster as it charges, and a lance hits the Storm back hard.',
  },
  {
    x: 'jouster',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost slows the Jouster, but its charges still run straight.',
  },
  {
    x: 'jouster',
    y: 'thorns',
    intended: 'y',
    level: 'strong',
    reason: 'A head-on Jouster lance sends 12 back off the Thorns’ spikes.',
  },
  {
    x: 'jouster',
    y: 'venom',
    intended: 'y',
    level: 'edge',
    reason: 'The Venom’s poison works between the Jouster’s charges, and glancing bumps are light.',
  },
  {
    x: 'jouster',
    y: 'berserker',
    intended: 'even',
    reason: 'A Jouster lance stores the Berserker just one rage, like any other hit.',
  },
  {
    x: 'jouster',
    y: 'sniper',
    intended: 'even',
    reason: 'The Sniper’s shots hit the Jouster from afar, and a lance hits back up close.',
  },
  {
    x: 'jouster',
    y: 'quake',
    intended: 'y',
    level: 'strong',
    reason:
      'Quake shockwaves chip the Jouster at walls, and the bouncing Quake makes lances glance.',
  },
  {
    x: 'jouster',
    y: 'magnet',
    intended: 'x',
    level: 'edge',
    reason: 'The Magnet’s pull lines the Jouster up head-on for its lance.',
  },
  {
    x: 'jouster',
    y: 'ghost',
    intended: 'even',
    reason: 'The Jouster’s lance passes through the phased Ghost like any bump.',
  },
  {
    x: 'jouster',
    y: 'necromancer',
    intended: 'even',
    reason: 'The Necromancer’s skull gets in the way of the Jouster’s charges.',
  },
  {
    x: 'jouster',
    y: 'chrono',
    intended: 'even',
    reason:
      'A Jouster lance is a bump, which the Chrono never rewinds, and the Chrono bumps for 22.',
  },
  {
    x: 'jouster',
    y: 'titan',
    intended: 'even',
    reason: 'The grown Titan is a big target for the Jouster’s lance, and bumps back hard.',
  },
  {
    x: 'jouster',
    y: 'inferno',
    intended: 'even',
    reason: 'The Jouster’s charges cross the Inferno’s fire, and a lance hits back hard.',
  },
  {
    x: 'jouster',
    y: 'boomerang',
    intended: 'x',
    level: 'edge',
    reason: 'The Jouster’s charge closes on the Boomerang fast, and the Boomerang’s bump is light.',
  },
  {
    x: 'jouster',
    y: 'bomber',
    intended: 'even',
    reason: 'The Jouster’s charges run through the Bomber’s bombs, and a lance hits back.',
  },
  {
    x: 'jouster',
    y: 'spartan',
    intended: 'even',
    reason: 'The Spartan’s shield halves a lance, and the spear hits the Jouster back.',
  },
  {
    x: 'jouster',
    y: 'bloom',
    intended: 'x',
    level: 'strong',
    reason: 'Each head-on Jouster lance hits for 33, far more than the Bloom regrows.',
  },
  {
    x: 'jouster',
    y: 'hex',
    intended: 'even',
    reason: 'The Hex’s curse and the Jouster’s lance each take a big bite.',
  },
  {
    x: 'jouster',
    y: 'spider',
    intended: 'even',
    reason: 'The Spider’s webs slow the Jouster at the walls, but its charges run straight.',
  },
  {
    x: 'jouster',
    y: 'battery',
    intended: 'even',
    reason: 'A Jouster lance is a bump, which the Battery never stores.',
  },
  {
    x: 'jouster',
    y: 'slime',
    intended: 'y',
    level: 'strong',
    reason: 'The Slime’s small halves turn most Jouster charges into glancing scratches.',
  },
  {
    x: 'jouster',
    y: 'balloon',
    intended: 'even',
    reason: 'A Jouster lance is a bump, so it lands on the Balloon as it is.',
  },
  {
    x: 'jouster',
    y: 'banshee',
    intended: 'x',
    level: 'edge',
    reason: 'Two head-on Jouster lances are more than the Banshee’s 56 health.',
  },
  {
    x: 'jouster',
    y: 'kraken',
    intended: 'x',
    level: 'strong',
    reason: 'The Jouster charges head-on into the Kraken while it anchors to squeeze.',
  },
  {
    x: 'jouster',
    y: 'mirage',
    intended: 'even',
    reason: 'The Jouster charges the real Mirage, never its copy, and the Mirage bumps hard.',
  },
];
