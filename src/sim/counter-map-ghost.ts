// Counter-map entries for the reworked Ghost (ADR 0049): every pair of it with another ball. The map is in
// counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The reworked Ghost phases for just over a second in every four, and then nothing touches it: balls,
 * shots, skulls and bombs pass through, and no hit lands. Passing through a ball deals its spectral
 * hit. Over a quarter of every kind of hit misses alike, so it beats only the balls whose damage comes as
 * a steady drip after the touch (Venom's poison, the Hex's curse), and loses to the Bloom, which
 * regrows between its spread-out hits.
 */
export const GHOST_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'ghost',
    y: 'brawler',
    intended: 'even',
    reason: 'The phased Ghost slips the Brawler’s bumps and hits for 12; solid, they trade bumps.',
  },
  {
    x: 'ghost',
    y: 'speedster',
    intended: 'x',
    level: 'edge',
    reason:
      'The phased Ghost slips the Speedster’s rush and hits it for 12 on every fast pass through.',
  },
  {
    x: 'ghost',
    y: 'vampire',
    intended: 'x',
    level: 'edge',
    reason: 'The Ghost’s pass hits the Vampire with no bump to heal from, only a burst of speed.',
  },
  {
    x: 'archer',
    y: 'ghost',
    intended: 'even',
    reason: 'The Archer’s arrows fly through the phased Ghost and land while it is solid.',
  },
  {
    x: 'storm',
    y: 'ghost',
    intended: 'even',
    reason: 'Storm lightning that falls on the phased Ghost misses; the rest lands whole.',
  },
  {
    x: 'ghost',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost’s bumps miss the phased Ghost; solid, the Ghost is slowed like anyone.',
  },
  {
    x: 'ghost',
    y: 'thorns',
    intended: 'even',
    reason:
      'The Ghost’s pass is no bump, so the Thorns’ spikes skip it, but its solid bumps meet them.',
  },
  {
    x: 'ghost',
    y: 'venom',
    intended: 'x',
    level: 'strong',
    reason: 'The Venom’s poison ticks miss the phased Ghost, and the Venom’s bump is light.',
  },
  {
    x: 'ghost',
    y: 'berserker',
    intended: 'even',
    reason: 'Each Ghost pass stores the Berserker a rage, and its big health takes the hits.',
  },
  {
    x: 'sniper',
    y: 'ghost',
    intended: 'even',
    reason: 'A Sniper shot flies through the phased Ghost; most arrive while it is solid.',
  },
  {
    x: 'quake',
    y: 'ghost',
    intended: 'even',
    reason: 'The Quake’s shockwaves miss the phased Ghost and land while it is solid.',
  },
  {
    x: 'ghost',
    y: 'magnet',
    intended: 'even',
    reason:
      'The Magnet pulls the Ghost in, phased or not; a phased Ghost hits as it passes through.',
  },
  {
    x: 'ghost',
    y: 'necromancer',
    intended: 'even',
    reason: 'The Necromancer’s skulls pass through the phased Ghost and bite it while solid.',
  },
  {
    x: 'chrono',
    y: 'ghost',
    intended: 'y',
    level: 'edge',
    reason:
      'The Ghost’s pass hits for 12, too small to rewind, and the Chrono’s bumps pass through it.',
  },
  {
    x: 'ghost',
    y: 'titan',
    intended: 'even',
    reason: 'The Titan’s growing bumps miss the phased Ghost about a third of the time.',
  },
  {
    x: 'ghost',
    y: 'inferno',
    intended: 'even',
    reason: 'The Inferno’s fire misses the phased Ghost and burns it while solid.',
  },
  {
    x: 'boomerang',
    y: 'ghost',
    intended: 'even',
    reason: 'The Boomerang’s throw flies through the phased Ghost and hits it while solid.',
  },
  {
    x: 'ghost',
    y: 'bomber',
    intended: 'y',
    level: 'edge',
    reason: 'The Ghost phases only 1.2 s in every 4, so most Bomber blasts catch it solid.',
  },
  {
    x: 'spartan',
    y: 'ghost',
    intended: 'even',
    reason:
      'The Spartan’s shield halves the Ghost’s hits, and phasing slips the spear now and then.',
  },
  {
    x: 'ghost',
    y: 'bloom',
    intended: 'y',
    level: 'strong',
    reason: 'The fight with the phasing Ghost stops and starts, and the Bloom regrows in the gaps.',
  },
];
