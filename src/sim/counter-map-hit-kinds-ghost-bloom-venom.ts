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
    x: 'bloom',
    y: 'brawler',
    intended: 'even',
    reason: 'Hard bumps take more than it regrows between them: plain trades decide it.',
  },
  {
    x: 'bloom',
    y: 'speedster',
    intended: 'even',
    reason: 'Rushes shut the bud often, but its hard bumps win back what they cost: even.',
  },
  {
    x: 'bloom',
    y: 'frost',
    intended: 'x',
    level: 'strong',
    reason: 'The slow keeps the cold’s bumps rare, and it regrows in the gaps.',
  },
  {
    x: 'bloom',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason: 'The slow Thorns lets it regrow between bumps, more than the spikes take back.',
  },
  {
    x: 'bloom',
    y: 'venom',
    intended: 'y',
    level: 'strong',
    reason: 'Every poison tick is a hit, so its wait never runs out.',
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
    level: 'edge',
    reason:
      'The skeleton’s bites restart the wait, but they are small, and its own bumps are hard.',
  },
  {
    x: 'bloom',
    y: 'titan',
    intended: 'y',
    level: 'edge',
    reason: 'Its late bumps grow bigger than anything the Bloom regrows between them.',
  },
  {
    x: 'bloom',
    y: 'inferno',
    intended: 'y',
    level: 'strong',
    reason: 'Burning patches hurt every half second, so the bud never opens.',
  },
  {
    x: 'bloom',
    y: 'bomber',
    intended: 'y',
    level: 'edge',
    reason:
      'A blast takes over half its health and shuts the bud, more than it regrows between bombs.',
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
    intended: 'x',
    level: 'edge',
    reason: 'Every rush poisons the Speedster, and the ticks add up to more than the rush took.',
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
    intended: 'x',
    level: 'strong',
    reason: 'Poison never touches the spikes, and its light bumps barely feel them.',
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
    intended: 'x',
    level: 'edge',
    reason: 'Poison ticks on the Necromancer while its skeleton bites only now and then.',
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
