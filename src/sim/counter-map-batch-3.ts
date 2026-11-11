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
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'magnet',
    y: 'speedster',
    intended: 'even',
    reason: 'The pull drags it into a brawl, but its rush hits back hard: neither pulls ahead.',
  },
  {
    x: 'magnet',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost is sturdy up close, so a forced brawl is an even trade.',
  },
  {
    x: 'thorns',
    y: 'magnet',
    intended: 'x',
    reason: 'The Magnet drags the spikes into itself, and every hard hit comes back.',
  },
  // The Ghost.
  // The Necromancer.
  {
    x: 'brawler',
    y: 'necromancer',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'necromancer',
    y: 'speedster',
    intended: 'even',
    reason: 'Minions pop on the fastest ball, but it reaches the Necromancer quickly.',
  },
  {
    x: 'necromancer',
    y: 'frost',
    intended: 'even',
    reason: 'Minions chip the sturdy Frost, which wins the contacts in between.',
  },
  {
    x: 'necromancer',
    y: 'thorns',
    intended: 'even',
    reason: 'Minion pops never touch the spikes, but Thorns wins the contacts.',
  },
  {
    x: 'magnet',
    y: 'necromancer',
    intended: 'even',
    reason: 'The pull drags it into a brawl, but the skull keeps biting: neither pulls ahead.',
  },
];
