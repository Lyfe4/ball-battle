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
    reason: 'A head-on lance hits three times as hard as the Brawler’s plain bump.',
  },
  {
    x: 'jouster',
    y: 'speedster',
    intended: 'even',
    reason: 'Its wall bounces turn many charges into glances: even.',
  },
  {
    x: 'jouster',
    y: 'vampire',
    intended: 'x',
    level: 'strong',
    reason: 'One head-on lance takes most of the Vampire’s little health.',
  },
  {
    x: 'jouster',
    y: 'archer',
    intended: 'x',
    level: 'edge',
    reason: 'A charge closes the gap fast, and the Archer is frail up close.',
  },
  {
    x: 'jouster',
    y: 'storm',
    intended: 'even',
    reason: 'Bolts hit it as it charges, but a lance hits back hard: even.',
  },
  {
    x: 'jouster',
    y: 'frost',
    intended: 'even',
    reason: 'A slowed Jouster still charges straight: even.',
  },
  {
    x: 'jouster',
    y: 'thorns',
    intended: 'y',
    level: 'strong',
    reason: 'Its own lance comes back off the spikes, three times as hard.',
  },
  {
    x: 'jouster',
    y: 'venom',
    intended: 'y',
    level: 'edge',
    reason: 'Poison works between its charges, and its glancing bumps are light.',
  },
  {
    x: 'jouster',
    y: 'berserker',
    intended: 'even',
    reason: 'A lance hit stores one rage like any other: even.',
  },
  {
    x: 'jouster',
    y: 'sniper',
    intended: 'even',
    reason: 'The Sniper hits hard from afar, but a lance hits back: even.',
  },
  {
    x: 'jouster',
    y: 'quake',
    intended: 'y',
    level: 'strong',
    reason: 'Shockwaves chip it at every wall, and the bouncing Quake makes its lance glance.',
  },
  {
    x: 'jouster',
    y: 'magnet',
    intended: 'x',
    level: 'edge',
    reason: 'The pull lines it up head-on for its lance.',
  },
  {
    x: 'jouster',
    y: 'ghost',
    intended: 'even',
    reason: 'A lance passes through the faded Ghost like any bump: even.',
  },
  {
    x: 'jouster',
    y: 'necromancer',
    intended: 'even',
    reason: 'The skeleton gets in the way of its charges, but pops to a lance: even.',
  },
  {
    x: 'jouster',
    y: 'chrono',
    intended: 'even',
    reason: 'A big lance hit is just what the rewind undoes: even.',
  },
  {
    x: 'jouster',
    y: 'titan',
    intended: 'even',
    reason: 'A grown Titan is a big target, and hits back as hard: even.',
  },
  {
    x: 'jouster',
    y: 'inferno',
    intended: 'even',
    reason: 'Its charges cross the fire, but a lance hits back: even.',
  },
  {
    x: 'jouster',
    y: 'boomerang',
    intended: 'x',
    level: 'edge',
    reason: 'A charge closes the gap fast, and the Boomerang is frail up close.',
  },
  {
    x: 'jouster',
    y: 'bomber',
    intended: 'even',
    reason: 'Its charges run through bombs, but a lance hits back: even.',
  },
  {
    x: 'jouster',
    y: 'spartan',
    intended: 'even',
    reason: 'The shield halves a lance hit, and the spear hits back: even.',
  },
  {
    x: 'jouster',
    y: 'bloom',
    intended: 'x',
    level: 'strong',
    reason: 'Big lance hits outpace the Bloom’s regrowth.',
  },
  {
    x: 'jouster',
    y: 'hex',
    intended: 'even',
    reason: 'The curse and the lance each take a big bite: even.',
  },
  {
    x: 'jouster',
    y: 'spider',
    intended: 'even',
    reason: 'Webs slow it at the walls, but its charges run straight: even.',
  },
  {
    x: 'jouster',
    y: 'battery',
    intended: 'even',
    reason: 'A lance is a bump, which the Battery never stores: even.',
  },
  {
    x: 'jouster',
    y: 'slime',
    intended: 'y',
    level: 'strong',
    reason: 'Its small halves turn most charges into glancing scratches.',
  },
  {
    x: 'jouster',
    y: 'balloon',
    intended: 'even',
    reason: 'The Balloon floats, but a lance pops it like any bump: even.',
  },
  {
    x: 'jouster',
    y: 'banshee',
    intended: 'x',
    level: 'edge',
    reason: 'Two head-on lances finish the frail Banshee between wails.',
  },
  {
    x: 'jouster',
    y: 'kraken',
    intended: 'x',
    level: 'strong',
    reason: 'It charges dead on into the anchored Kraken while it squeezes.',
  },
  {
    x: 'jouster',
    y: 'mirage',
    intended: 'even',
    reason: 'The copy fools no lance, and the Mirage’s bump is heavy: even.',
  },
];
