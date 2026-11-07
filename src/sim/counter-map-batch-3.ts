// Counter-map entries for batch 3: the Magnet, Ghost and Necromancer (ADR 0026), one per pair with
// every earlier ball and each other. The map is in counter-map.ts; its checks in
// scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Each counter was measured before it was kept (ADR 0026). The Magnet's pull forces a brawl, so it
 * beats the balls that are weak up close and loses to Thorns, whose spikes it drags into itself.
 * The Ghost's phasing stops contact hits, so it beats the Speedster, whose whole game is contact,
 * and loses to every ball whose attacks never needed contact. Minions draw aimed attacks, so the
 * Necromancer beats the Archer and Sniper; an area strike clears its minion, so the Quake beats it.
 * ADR 0028 made phasing one rule (a phased ball can't be touched, gripped or aimed at), so the
 * Ghost is favoured over the Magnet and the Necromancer, and even with the Storm and the Quake;
 * heavier lightning makes the Storm favoured over the Necromancer and even with the Magnet.
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
    reason: 'The pull drags it into a brawl, where its light hits lose.',
  },
  {
    x: 'magnet',
    y: 'vampire',
    intended: 'even',
    reason: 'Pulled into brawls, the Vampire heals off them as fast as it loses.',
  },
  {
    x: 'magnet',
    y: 'archer',
    intended: 'even',
    reason: 'The pull drags it into contact, but faster arrows land first.',
  },
  {
    x: 'magnet',
    y: 'storm',
    intended: 'even',
    reason: 'The pull drags it into contact, but heavier lightning pays for the brawl.',
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
  {
    x: 'magnet',
    y: 'venom',
    intended: 'x',
    reason: 'The pull forces a brawl, and Venom’s light hits lose it before the poison works.',
  },
  {
    x: 'magnet',
    y: 'berserker',
    intended: 'even',
    reason: 'Both want a brawl: the pull feeds its rage as much as the Magnet’s hits.',
  },
  {
    x: 'magnet',
    y: 'sniper',
    intended: 'x',
    reason: 'The pull drags the Sniper into contact, where it is weakest.',
  },
  {
    x: 'magnet',
    y: 'quake',
    intended: 'x',
    reason: 'The pull drags the Quake away from the walls every shockwave needs.',
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
    reason: 'It runs through the Ghost most often, and its rush lands on nothing.',
  },
  {
    x: 'ghost',
    y: 'vampire',
    intended: 'even',
    reason: 'Phasing denies the Vampire hits to heal off, but it heals off the rest.',
  },
  {
    x: 'archer',
    y: 'ghost',
    intended: 'x',
    reason: 'Arrows in flight still hit it phased; phasing only delays the next.',
  },
  {
    x: 'storm',
    y: 'ghost',
    intended: 'even',
    reason: 'Lightning needs a target to call: it waits while the Ghost is phased.',
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
    x: 'ghost',
    y: 'berserker',
    intended: 'even',
    reason: 'Phasing dodges its rage hits, but its health outlasts the spectral ones.',
  },
  {
    x: 'sniper',
    y: 'ghost',
    intended: 'x',
    reason: 'A shot locked before it phases still hits it.',
  },
  {
    x: 'quake',
    y: 'ghost',
    intended: 'even',
    reason: 'Shockwaves still hit it phased, but softer ones no longer outweigh its passes.',
  },
  {
    x: 'magnet',
    y: 'ghost',
    intended: 'y',
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
    y: 'vampire',
    intended: 'even',
    reason: 'Minion pops chip it, but it heals off its hits on the Necromancer.',
  },
  {
    x: 'necromancer',
    y: 'archer',
    intended: 'x',
    reason: 'A minion nearer than its owner draws the arrows.',
  },
  {
    x: 'necromancer',
    y: 'storm',
    intended: 'y',
    reason: 'A heavier strike clears the skull and catches the Necromancer with it.',
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
    x: 'berserker',
    y: 'necromancer',
    intended: 'x',
    reason: 'Every minion pop is a wound, and every wound makes its rage hit harder.',
  },
  {
    x: 'necromancer',
    y: 'sniper',
    intended: 'x',
    reason: 'A minion nearer than its owner draws the shot.',
  },
  {
    x: 'quake',
    y: 'necromancer',
    intended: 'even',
    reason: 'A softer shockwave still clears the skull, but no longer wins the trade.',
  },
  {
    x: 'magnet',
    y: 'necromancer',
    intended: 'x',
    reason: 'The pull drags it into a brawl, where its light hits lose.',
  },
  {
    x: 'necromancer',
    y: 'ghost',
    intended: 'y',
    reason: 'Phased, it passes through the skulls: a pop needs a touch, like any hit.',
  },
];
