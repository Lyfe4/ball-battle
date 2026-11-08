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
 * Magnet and the Necromancer. Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
 * counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules.
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
    intended: 'x',
    band: 'movement',
    reason: 'The pull drags it into a brawl, where its light hits lose.',
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
    band: 'kind',
    reason: 'The Magnet drags the spikes into itself, and every hard hit comes back.',
  },
  {
    x: 'magnet',
    y: 'venom',
    intended: 'x',
    band: 'movement',
    reason: 'The pull forces a brawl, and Venom’s light hits lose it before the poison works.',
  },
  // The Ghost.
  {
    x: 'brawler',
    y: 'ghost',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'ghost',
    y: 'speedster',
    intended: 'x',
    band: 'kind',
    reason: 'It runs through the Ghost most often, and its rush lands on nothing.',
  },
  {
    x: 'ghost',
    y: 'frost',
    intended: 'even',
    reason: 'Phasing dodges its slowing hits, but the Frost outlasts the spectral ones.',
  },
  {
    x: 'ghost',
    y: 'thorns',
    intended: 'even',
    reason: 'Spectral hits slip past the spikes, but the spikes still punish its solid hits.',
  },
  {
    x: 'ghost',
    y: 'venom',
    intended: 'even',
    reason: 'Phasing dodges poisoned hits, but poison already on it keeps ticking.',
  },
  {
    x: 'magnet',
    y: 'ghost',
    intended: 'y',
    band: 'kind',
    reason:
      'A phased ball can’t be gripped: the pull slips, and the Magnet charges straight through it.',
  },
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
    x: 'necromancer',
    y: 'venom',
    intended: 'even',
    reason: 'Minions and poison both chip from a distance.',
  },
  {
    x: 'magnet',
    y: 'necromancer',
    intended: 'x',
    band: 'movement',
    reason: 'The pull drags it into a brawl, where its light hits lose.',
  },
  {
    x: 'necromancer',
    y: 'ghost',
    intended: 'y',
    band: 'kind',
    reason: 'Phased, it passes through the skulls: a pop needs a touch, like any hit.',
  },
];
