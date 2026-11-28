// Counter-map entries from the roster redesign's second group (ADR 0045): every pair of the Chrono,
// Ghost, Bloom or Venom with a ball outside the first group (the Spartan's are in
// counter-map-spartan.ts, ADR 0047), each pair in the file of the
// first of its balls in that order. Pairs with a first-group ball stay in the
// counter-map-rules-out-*.ts files. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The Chrono. Every edge here is a kind of hit meeting a defence that works the same on any ball: a
 * rewind undoes a big hit, a fade makes the hits just after a hit miss, regrowth heals between hits,
 * and poison ticks are small.
 */
export const HIT_KIND_CHRONO_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'chrono',
    y: 'brawler',
    intended: 'even',
    reason: 'The Chrono never rewinds bumps, and bumps are all the Brawler has.',
  },
  {
    x: 'chrono',
    y: 'speedster',
    intended: 'x',
    level: 'edge',
    reason: 'The Chrono bumps for 22, and a stacked Speedster rush is too small to rewind.',
  },
  {
    x: 'chrono',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost’s bumps are never rewound, and each one slows the Chrono.',
  },
  {
    x: 'chrono',
    y: 'thorns',
    intended: 'even',
    reason: 'The Thorns’ spikes hit back too softly for the Chrono to rewind.',
  },
  {
    x: 'chrono',
    y: 'venom',
    intended: 'y',
    level: 'strong',
    reason: 'The Venom’s poison ticks are too small for the Chrono to rewind.',
  },
  {
    x: 'chrono',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet’s pull brings the Chrono bumps, never a big hit to rewind.',
  },
  {
    x: 'chrono',
    y: 'necromancer',
    intended: 'even',
    reason: 'The Necromancer’s skull bites are too small for the Chrono to rewind.',
  },
  {
    x: 'chrono',
    y: 'titan',
    intended: 'even',
    reason: 'Even a grown Titan’s bump is never rewound, and the Chrono bumps hard from the start.',
  },
  {
    x: 'chrono',
    y: 'inferno',
    intended: 'y',
    level: 'strong',
    reason: 'The Inferno’s burns are too small for the Chrono to rewind.',
  },
  {
    x: 'chrono',
    y: 'bomber',
    intended: 'x',
    level: 'strong',
    reason: 'Each Bomber blast hits for 28, big enough for the Chrono to rewind.',
  },
  {
    x: 'chrono',
    y: 'bloom',
    intended: 'y',
    level: 'strong',
    reason: 'The Chrono only bumps, and the Bloom regrows whenever it is left alone for 2 s.',
  },
];
