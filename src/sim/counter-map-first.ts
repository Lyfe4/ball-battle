// Counter-map entries for the first eight balls (ADR 0010, 0012, 0013, 0014). The map and its
// checks are in counter-map.ts (and scripts/counter-map.ts); a new ball adds its entries in the
// file for its batch.
import type { CounterEntry } from './counter-map.ts';

/**
 * The Brawler as the safe pick, even against everyone but Thorns, its one designed counter
 * (docs/vision.md, ADR 0013). Frost (ADR 0012) slows, so it beats the Speedster; Venom (ADR 0014)
 * is favoured against Thorns. The Frost and Venom are even again since ADR 0028 removed the cold's
 * resistance to poison.
 * Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
 * counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules, and every
 * other pair with the Chrono, Guardian, Ghost, Bloom or Venom to counter-map-hit-kinds-*.ts with
 * the redesign's second group.
 */
export const FIRST_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'brawler',
    y: 'speedster',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'frost',
    y: 'speedster',
    intended: 'x',
    reason: 'Slowed, it loses its speed and the wall bounces that build its stacks.',
  },
  {
    x: 'brawler',
    y: 'frost',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'thorns',
    y: 'brawler',
    intended: 'x',
    reason: 'The hardest hitter hurts itself the most on the spikes.',
  },
  {
    x: 'thorns',
    y: 'speedster',
    intended: 'even',
    reason: 'Reflection answers its contact hits, but it hits softly and often.',
  },
  {
    x: 'thorns',
    y: 'frost',
    intended: 'even',
    reason: 'Two contact balls: the Frost hits hard into the spikes, but slows Thorns.',
  },
];
