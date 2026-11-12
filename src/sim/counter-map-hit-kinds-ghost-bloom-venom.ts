// Counter-map entries from the roster redesign's second group (ADR 0045): every pair of the Chrono,
// Guardian, Ghost, Bloom or Venom with a ball outside the first group, each pair in the file of the
// first of its balls in that order. Pairs with a first-group ball stay in the
// counter-map-rules-out-*.ts files. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The Ghost, the Bloom and the Venom. Every edge here is a kind of hit meeting a defence that works the same on any
 * ball: a rewind undoes a big hit, armor takes a bit off every hit (a big share of a small one), a
 * fade makes the hits just after a hit miss, regrowth heals all the time, and poison ticks are small.
 */
export const HIT_KIND_GHOST_BLOOM_VENOM_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'ghost',
    y: 'brawler',
    intended: 'y',
    reason: 'The fade can’t save it from a plain heavy bump: each one lands whole.',
  },
  {
    x: 'ghost',
    y: 'speedster',
    intended: 'even',
    reason: 'The speed hit lands with the bump, before the fade: plain trades decide it.',
  },
  {
    x: 'ghost',
    y: 'frost',
    intended: 'y',
    reason: 'The cold’s heavy bumps come one at a time, each after the fade ends.',
  },
  {
    x: 'ghost',
    y: 'thorns',
    intended: 'even',
    reason: 'Bumps and spikes land together, before the fade: plain trades decide it.',
  },
  {
    x: 'ghost',
    y: 'venom',
    intended: 'x',
    reason: 'It fades after a poison tick, so the next one misses.',
  },
  {
    x: 'ghost',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull brings single bumps, each after the fade ends.',
  },
  {
    x: 'ghost',
    y: 'necromancer',
    intended: 'even',
    reason: 'A fade can miss the next bite, but skeletons rarely bite together.',
  },
  {
    x: 'ghost',
    y: 'titan',
    intended: 'even',
    reason: 'A giant’s bumps come one at a time, and each lands whole.',
  },
  {
    x: 'ghost',
    y: 'inferno',
    intended: 'x',
    reason: 'It fades as the fire bites, so part of every burn misses.',
  },
  {
    x: 'ghost',
    y: 'bomber',
    intended: 'even',
    reason: 'Blasts come one at a time, each after the fade ends.',
  },
  {
    x: 'ghost',
    y: 'bloom',
    intended: 'y',
    reason: 'The Ghost’s bumps come slowly, so the regrowth heals each one back between them.',
  },
  {
    x: 'bloom',
    y: 'brawler',
    intended: 'even',
    reason: 'Hard bumps take more than it regrows between them: plain trades decide it.',
  },
  {
    x: 'bloom',
    y: 'speedster',
    intended: 'even',
    reason: 'A rush stops the regrowth, but rushes are rare: neither pulls ahead.',
  },
  {
    x: 'bloom',
    y: 'frost',
    intended: 'x',
    reason: 'The cold’s bumps come slowly, and regrowth heals each one back between them.',
  },
  {
    x: 'bloom',
    y: 'thorns',
    intended: 'even',
    reason: 'Its bumps come back off the spikes, and it regrows between them: neither pulls ahead.',
  },
  {
    x: 'bloom',
    y: 'venom',
    intended: 'y',
    reason: 'Every poison tick stops the regrowth again, so it hardly regrows at all.',
  },
  {
    x: 'bloom',
    y: 'magnet',
    intended: 'even',
    reason: 'Its pull drags the Bloom into hard bumps, but they come slowly: neither pulls ahead.',
  },
  {
    x: 'bloom',
    y: 'necromancer',
    intended: 'x',
    reason: 'The skeleton’s bites come slowly enough for the regrowth to heal them back.',
  },
  {
    x: 'bloom',
    y: 'titan',
    intended: 'y',
    reason: 'Grows too big: its huge bumps outpace the regrowth.',
  },
  {
    x: 'bloom',
    y: 'inferno',
    intended: 'even',
    reason: 'Every burn stops the regrowth, but the burns are small: neither pulls ahead.',
  },
  {
    x: 'bloom',
    y: 'bomber',
    intended: 'even',
    reason: 'Regrows between the bombs, but each blast takes more than it regrows.',
  },
  {
    x: 'venom',
    y: 'brawler',
    intended: 'even',
    reason: 'Poison chips while the Brawler hits hard: plain trades decide it.',
  },
  {
    x: 'venom',
    y: 'speedster',
    intended: 'even',
    reason: 'Every rush poisons the Speedster, and the rush hits harder.',
  },
  {
    x: 'venom',
    y: 'frost',
    intended: 'even',
    reason: 'Poison works through the cold, and the cold slows the Venom: plain trades decide it.',
  },
  {
    x: 'venom',
    y: 'thorns',
    intended: 'even',
    reason: 'Poison never touches the spikes, but its bumps do: neither pulls ahead.',
  },
  {
    x: 'venom',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull brings more poisoned bumps, and harder ones back.',
  },
  {
    x: 'venom',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skeletons bite while the poison works: plain trades decide it.',
  },
  {
    x: 'venom',
    y: 'titan',
    intended: 'even',
    reason: 'Poison chips the giant, and its bumps grow harder: neither pulls ahead.',
  },
  {
    x: 'venom',
    y: 'inferno',
    intended: 'even',
    reason: 'Both chip: poison over time, fire along its trail.',
  },
  {
    x: 'venom',
    y: 'bomber',
    intended: 'even',
    reason: 'Both chip between contacts: poison over time, bombs where it was.',
  },
];
