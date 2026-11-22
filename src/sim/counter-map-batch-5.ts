// Counter-map entries for batch 5, first half: the Boomerang and the Bomber with every earlier ball
// (ADR 0043). The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Each counter was measured before it was kept (ADR 0043). A boomerang chips twice a throw from
 * range, so phasing and fire answer it poorly; a fast ball outruns it, a bigger body wins the
 * trades and a skull stops it dead. Bombs punish whoever covers the most ground, and a ball that
 * shoots from range crosses them least.
 * Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
 * counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules, and every
 * other pair with the Chrono, Guardian, Ghost, Bloom or Venom to counter-map-hit-kinds-*.ts with
 * the redesign's second group.
 */
export const BATCH_FIVE_ENTRIES: readonly CounterEntry[] = [
  // The Boomerang.
  // The Bomber.
  {
    x: 'brawler',
    y: 'bomber',
    intended: 'even',
    reason: 'The Brawler runs into the Bomber’s bombs, and hits hard when it gets there.',
  },
  {
    x: 'bomber',
    y: 'speedster',
    intended: 'x',
    level: 'strong',
    reason: 'The Speedster covers the most ground, so it sets off the most of the Bomber’s bombs.',
  },
  {
    x: 'frost',
    y: 'bomber',
    intended: 'even',
    reason: 'The slow Frost sets off few of the Bomber’s bombs, but can’t outrun a blast either.',
  },
  {
    x: 'thorns',
    y: 'bomber',
    intended: 'y',
    level: 'edge',
    reason: 'The Bomber’s blasts never touch the spikes, and the slow Thorns can’t keep clear.',
  },
  {
    x: 'magnet',
    y: 'bomber',
    intended: 'even',
    reason: 'The Magnet pulls the Bomber close, and its heavy bumps pay back the blasts.',
  },
  {
    x: 'necromancer',
    y: 'bomber',
    intended: 'y',
    level: 'edge',
    reason:
      'A Bomber blast hits harder than a skull bites, and clears the Necromancer’s skull too.',
  },
  {
    x: 'titan',
    y: 'bomber',
    intended: 'even',
    reason: 'The growing Titan sets off more of the Bomber’s bombs, and its bumps pay them back.',
  },
  {
    x: 'inferno',
    y: 'bomber',
    intended: 'y',
    level: 'edge',
    reason: 'One Bomber blast hits harder than the burns it takes crossing the Inferno’s fire.',
  },
];
