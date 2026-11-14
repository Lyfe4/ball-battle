// Counter-map entries for the reworked Ghost (ADR 0049): every pair of it with another ball. The map is in
// counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The reworked Ghost phases for one second in every four, and then nothing touches it: balls,
 * shots, skulls and bombs pass through, and no hit lands. Passing through a ball deals its spectral
 * hit. A quarter of every kind of hit misses alike, so it beats only the balls whose damage comes as
 * a steady drip after the touch (Venom's poison, the Hex's curse), and loses to the Bloom, which
 * regrows between its spread-out hits.
 */
export const GHOST_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'ghost',
    y: 'brawler',
    intended: 'even',
    reason: 'Phased it takes no bump and deals its spectral hit; solid, the hard bumps trade.',
  },
  {
    x: 'ghost',
    y: 'speedster',
    intended: 'even',
    reason: 'A phased pass takes no speed hit, a solid one takes it whole: plain trades decide it.',
  },
  {
    x: 'ghost',
    y: 'vampire',
    intended: 'even',
    reason: 'Passing through, the Vampire drinks nothing, but solid bumps trade as usual.',
  },
  {
    x: 'archer',
    y: 'ghost',
    intended: 'even',
    reason: 'Arrows fly through it while phased and land while solid: neither pulls ahead.',
  },
  {
    x: 'storm',
    y: 'ghost',
    intended: 'even',
    reason: 'A strike that falls while it is phased misses; the rest land whole.',
  },
  {
    x: 'ghost',
    y: 'frost',
    intended: 'even',
    reason: 'Phased it can’t be chilled, solid it is: neither pulls ahead.',
  },
  {
    x: 'ghost',
    y: 'thorns',
    intended: 'even',
    reason: 'Its spectral hit is no bump, so no spikes, but its solid bumps meet them.',
  },
  {
    x: 'ghost',
    y: 'venom',
    intended: 'x',
    reason: 'Poison ticks that fall while it is phased do nothing.',
  },
  {
    x: 'ghost',
    y: 'berserker',
    intended: 'even',
    reason: 'Passing through stores no rage, but its big health outlasts the spectral hits.',
  },
  {
    x: 'sniper',
    y: 'ghost',
    intended: 'even',
    reason: 'A shot that arrives while it is phased flies through; most arrive while it is solid.',
  },
  {
    x: 'quake',
    y: 'ghost',
    intended: 'even',
    reason: 'Shockwaves that reach it while phased miss, the rest land: neither pulls ahead.',
  },
  {
    x: 'ghost',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull brings it in, phased or solid: plain trades and spectral hits decide it.',
  },
  {
    x: 'ghost',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skeletons pass through it while phased and bite while solid: neither pulls ahead.',
  },
  {
    x: 'chrono',
    y: 'ghost',
    intended: 'even',
    reason: 'No big hit to rewind: plain trades and spectral hits decide it.',
  },
  {
    x: 'ghost',
    y: 'titan',
    intended: 'even',
    reason: 'A giant’s bumps miss it a quarter of the time and land whole the rest.',
  },
  {
    x: 'ghost',
    y: 'inferno',
    intended: 'even',
    reason: 'Burns that fall while it is phased miss, the rest land: neither pulls ahead.',
  },
  {
    x: 'boomerang',
    y: 'ghost',
    intended: 'even',
    reason: 'The boomerang flies through it while phased and hits while solid.',
  },
  {
    x: 'ghost',
    y: 'bomber',
    intended: 'even',
    reason: 'Phased it slips through bombs without setting them off; solid it takes the blast.',
  },
  {
    x: 'spartan',
    y: 'ghost',
    intended: 'even',
    reason: 'The shield halves its hits, and phasing dodges the spear now and then.',
  },
  {
    x: 'ghost',
    y: 'bloom',
    intended: 'y',
    reason: 'Phasing makes the fight stop-start, and every quiet 2 s is regrowth.',
  },
];
