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
    reason: 'Its bumps are never big enough to rewind: plain trades decide it.',
  },
  {
    x: 'chrono',
    y: 'speedster',
    intended: 'even',
    reason: 'A rush is never big enough to rewind, though a rewind can undo the last one.',
  },
  {
    x: 'chrono',
    y: 'frost',
    intended: 'even',
    reason: 'The cold’s hits are never big enough to rewind: plain trades decide it.',
  },
  {
    x: 'chrono',
    y: 'thorns',
    intended: 'even',
    reason: 'No big hits either way: plain trades decide it.',
  },
  {
    x: 'chrono',
    y: 'venom',
    intended: 'y',
    reason: 'Poison ticks are too small to rewind.',
  },
  {
    x: 'chrono',
    y: 'magnet',
    intended: 'even',
    reason: 'Its pull brings bumps, never a big hit to rewind.',
  },
  {
    x: 'chrono',
    y: 'ghost',
    intended: 'even',
    reason: 'No big hit to rewind and no quick hits to fade from: plain trades decide it.',
  },
  {
    x: 'chrono',
    y: 'necromancer',
    intended: 'even',
    reason: 'Bites are too small to rewind, but each one is light: plain trades decide it.',
  },
  {
    x: 'chrono',
    y: 'titan',
    intended: 'even',
    reason: 'Even a giant’s bump is too small to rewind: plain trades decide it.',
  },
  {
    x: 'chrono',
    y: 'inferno',
    intended: 'y',
    reason: 'Burns are too small to rewind.',
  },
  {
    x: 'chrono',
    y: 'bomber',
    intended: 'x',
    reason: 'Each big blast is big enough to rewind.',
  },
  {
    x: 'chrono',
    y: 'bloom',
    intended: 'y',
    reason:
      'No big hit to rewind, and the Chrono’s bumps come slowly: the regrowth heals them back.',
  },
];
