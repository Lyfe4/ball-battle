// Counter-map entries for batch 3: the Magnet, Ghost and Necromancer (ADR 0026), one per pair with
// every earlier ball and each other. The map is in counter-map.ts; its checks in
// scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Each counter was measured before it was kept (ADR 0026). The Magnet's pull forces a brawl, so it
 * beats the balls that are weak up close and loses to Thorns, whose spikes it drags into itself.
 * The Ghost's phasing stops contact hits, so it beats the Speedster, whose whole game is contact,
 * and loses to every ball whose attacks never needed contact. Minions draw aimed attacks, so the
 * Necromancer beats the Archer and Sniper; an area strike clears its minion. ADR 0028 made phasing
 * one rule (a phased ball can't be touched, gripped or aimed at), so the Ghost is favoured over the
 * Magnet and the Necromancer.
 * Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
 * counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules, and every
 * other pair with the Chrono, Guardian, Ghost, Bloom or Venom to counter-map-hit-kinds-*.ts with
 * the redesign's second group.
 */
export const BATCH_THREE_ENTRIES: readonly CounterEntry[] = [
  // The Magnet.
  {
    x: 'brawler',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet pulls the Brawler in, and both bump about as hard.',
  },
  {
    x: 'magnet',
    y: 'speedster',
    intended: 'even',
    reason: 'The Magnet’s pull turns the Speedster off the walls that build its rush.',
  },
  {
    x: 'magnet',
    y: 'frost',
    intended: 'y',
    level: 'strong',
    reason: 'The Magnet pulls the Frost into bumps, and every Frost bump slows the Magnet.',
  },
  {
    x: 'thorns',
    y: 'magnet',
    intended: 'x',
    level: 'strong',
    reason: 'The Magnet pulls itself onto the Thorns’ spikes, and its hard bumps come back at it.',
  },
  // The Ghost.
  // The Necromancer.
  {
    x: 'brawler',
    y: 'necromancer',
    intended: 'even',
    reason: 'The Necromancer’s skulls bite the Brawler, and the Brawler bumps far harder.',
  },
  {
    x: 'necromancer',
    y: 'speedster',
    intended: 'even',
    reason: 'Skull bites chip the Speedster, but its rush reaches the Necromancer quickly.',
  },
  {
    x: 'necromancer',
    y: 'frost',
    intended: 'y',
    level: 'edge',
    reason:
      'The Necromancer’s skulls chip the Frost’s big health, and its bumps slow the Necromancer.',
  },
  {
    x: 'necromancer',
    y: 'thorns',
    intended: 'even',
    reason: 'The Necromancer’s skulls bite past the spikes, but the Thorns bump harder.',
  },
  {
    x: 'magnet',
    y: 'necromancer',
    intended: 'x',
    level: 'edge',
    reason: 'Every skull bite on the Magnet pulls the Necromancer into its heavy bumps.',
  },
];
