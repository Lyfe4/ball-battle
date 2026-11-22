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
    reason: 'The Speedster’s wall bounces build its bump toward the Brawler’s hard one.',
  },
  {
    x: 'frost',
    y: 'speedster',
    intended: 'x',
    level: 'strong',
    reason: 'Every Frost bump slows the Speedster, so it builds fewer stacks off the walls.',
  },
  {
    x: 'brawler',
    y: 'frost',
    intended: 'y',
    level: 'edge',
    reason: 'The Brawler bumps harder, but the Frost has more health and slows it.',
  },
  {
    x: 'thorns',
    y: 'brawler',
    intended: 'x',
    level: 'strong',
    reason: 'The Brawler bumps hardest, so it hurts itself most on the Thorns’ spikes.',
  },
  {
    x: 'thorns',
    y: 'speedster',
    intended: 'even',
    reason: 'The Speedster’s rush is never reflected, but its plain bumps meet the Thorns’ spikes.',
  },
  {
    x: 'thorns',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost bumps hard into the Thorns’ spikes, and each bump slows the Thorns.',
  },
];
