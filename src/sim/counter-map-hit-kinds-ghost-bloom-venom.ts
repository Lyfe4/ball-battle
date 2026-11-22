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
    reason: 'The Bloom regrows between bumps, and the Brawler bumps hardest.',
  },
  {
    x: 'bloom',
    y: 'speedster',
    intended: 'even',
    reason: 'The Speedster’s rushes shut the Bloom’s bud, and the Bloom bumps harder.',
  },
  {
    x: 'bloom',
    y: 'frost',
    intended: 'x',
    level: 'strong',
    reason: 'The Frost’s slow keeps bumps rare, and the Bloom regrows in the gaps.',
  },
  {
    x: 'bloom',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason: 'The slow Thorns leaves the Bloom time to regrow, more than the spikes take back.',
  },
  {
    x: 'bloom',
    y: 'venom',
    intended: 'y',
    level: 'strong',
    reason: 'Every Venom poison tick shuts the Bloom’s bud and starts its 2 s wait again.',
  },
  {
    x: 'bloom',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet pulls the Bloom into hard bumps, and each one shuts its bud.',
  },
  {
    x: 'bloom',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skull bites shut the Bloom’s bud, and the Bloom bumps harder than the Necromancer.',
  },
  {
    x: 'bloom',
    y: 'titan',
    intended: 'y',
    level: 'edge',
    reason: 'The Titan’s late bumps take more than the Bloom regrows between them.',
  },
  {
    x: 'bloom',
    y: 'inferno',
    intended: 'y',
    level: 'strong',
    reason: 'The Inferno’s fire burns every 0.2 s, so the Bloom’s bud rarely opens.',
  },
  {
    x: 'bloom',
    y: 'bomber',
    intended: 'y',
    level: 'edge',
    reason: 'A Bomber blast takes over half the Bloom’s health and shuts its bud.',
  },
  {
    x: 'venom',
    y: 'brawler',
    intended: 'even',
    reason: 'The Venom’s poison chips the Brawler, and the Brawler bumps hard.',
  },
  {
    x: 'venom',
    y: 'speedster',
    intended: 'x',
    level: 'edge',
    reason: 'Every bump with the Venom poisons the Speedster for 15 more over 1.8 s.',
  },
  {
    x: 'venom',
    y: 'frost',
    intended: 'even',
    reason: 'The Venom’s poison works through the cold, and the Frost’s bumps slow the Venom.',
  },
  {
    x: 'venom',
    y: 'thorns',
    intended: 'x',
    level: 'strong',
    reason:
      'The Venom’s poison never touches the Thorns’ spikes, and its light bumps barely feel them.',
  },
  {
    x: 'venom',
    y: 'magnet',
    intended: 'even',
    reason:
      'The Magnet pulls in more of the Venom’s poisoning bumps, and its own bumps hit harder.',
  },
  {
    x: 'venom',
    y: 'necromancer',
    intended: 'x',
    level: 'edge',
    reason: 'The Venom’s poison ticks on the Necromancer; its one skull bites only now and then.',
  },
  {
    x: 'venom',
    y: 'titan',
    intended: 'even',
    reason: 'The Venom’s poison chips the Titan, and the Titan’s bumps grow harder.',
  },
  {
    x: 'venom',
    y: 'inferno',
    intended: 'even',
    reason: 'The Venom poisons with each bump; the Inferno burns along its trail.',
  },
  {
    x: 'venom',
    y: 'bomber',
    intended: 'even',
    reason: 'The Venom poisons with each bump; the Bomber’s bombs blast where it has been.',
  },
];
