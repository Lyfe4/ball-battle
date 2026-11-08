// Counter-map entries from the roster redesign's second group (ADR 0045): every pair of the Chrono,
// Guardian, Ghost, Bloom or Venom with a ball outside the first group, each pair in the file of the
// first of its balls in that order. Pairs with a first-group ball stay in the
// counter-map-rules-out-*.ts files. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The Chrono and the Guardian. Every edge here is a kind of hit meeting a defence that works the same on any
 * ball: a rewind undoes a big hit, armor takes a bit off every hit (a big share of a small one), a
 * fade makes the hits just after a hit miss, regrowth heals all the time, and poison ticks are small.
 */
export const HIT_KIND_CHRONO_GUARDIAN_ENTRIES: readonly CounterEntry[] = [
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
    band: 'kind',
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
    band: 'kind',
    reason: 'Burns are too small to rewind.',
  },
  {
    x: 'chrono',
    y: 'bomber',
    intended: 'even',
    reason: 'Blasts are too small to rewind, but they are rare.',
  },
  {
    x: 'chrono',
    y: 'guardian',
    intended: 'even',
    reason: 'Armor dulls its bumps a little, and neither has a big hit: plain trades decide it.',
  },
  {
    x: 'chrono',
    y: 'bloom',
    intended: 'even',
    reason: 'No big hit to rewind, and regrowth is slow: plain trades decide it.',
  },
  {
    x: 'guardian',
    y: 'brawler',
    intended: 'even',
    reason: 'Armor takes only a little off a hard bump: plain trades decide it.',
  },
  {
    x: 'guardian',
    y: 'speedster',
    intended: 'even',
    reason: 'Armor takes a bit off its bumps, but the fastest ball still lands plenty.',
  },
  {
    x: 'guardian',
    y: 'frost',
    intended: 'even',
    reason: 'Armor takes little off the cold’s heavy hits: plain trades decide it.',
  },
  {
    x: 'guardian',
    y: 'thorns',
    intended: 'even',
    reason: 'Its bumps come back off the spikes, but armor takes a bit off the reflection too.',
  },
  {
    x: 'guardian',
    y: 'venom',
    intended: 'x',
    band: 'kind',
    reason: 'Armor takes a share off every small poison tick.',
  },
  {
    x: 'guardian',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull brings hard bumps, and armor takes little off them.',
  },
  {
    x: 'guardian',
    y: 'ghost',
    intended: 'even',
    reason: 'Single bumps either way: neither defence finds much to work on.',
  },
  {
    x: 'guardian',
    y: 'necromancer',
    intended: 'even',
    reason: 'Armor takes a bit off every bite, but skeletons keep coming.',
  },
  {
    x: 'guardian',
    y: 'titan',
    intended: 'even',
    reason: 'Armor takes little off a giant’s bumps: plain trades decide it.',
  },
  {
    x: 'guardian',
    y: 'inferno',
    intended: 'x',
    band: 'kind',
    reason: 'Armor takes a share off every small burn.',
  },
  {
    x: 'guardian',
    y: 'bomber',
    intended: 'even',
    reason: 'Armor takes a bit off each blast, but blasts are rare.',
  },
  {
    x: 'guardian',
    y: 'bloom',
    intended: 'even',
    reason: 'Armor slows the damage and regrowth heals it back: neither side pulls ahead.',
  },
];
