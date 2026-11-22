// Counter-map entries for the Battery, every pair of it with another ball (ADR 0056), measured at
// 500 seeds in ruleset 16.
import type { CounterEntry } from './counter-map.ts';

/**
 * The Battery stores part of every big strike, blast or burst and lets it out on its next bump, so
 * it beats the balls built on one big hit (the Storm, Bomber and Hex). Against everyone else it is a
 * fast, hard bumper: Thorns' spikes punish its bumps, and the Frost's and the Spider's slows take
 * away the speed it fights with.
 */
export const BATTERY_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'battery',
    y: 'brawler',
    intended: 'even',
    reason: 'The Brawler only bumps, and the Battery stores no bumps.',
  },
  {
    x: 'battery',
    y: 'speedster',
    intended: 'even',
    reason: 'The Speedster’s rush adds at most 10, too small for the Battery to store.',
  },
  {
    x: 'battery',
    y: 'vampire',
    intended: 'y',
    level: 'edge',
    reason: 'The Vampire heals most of each bump, and the Battery stores none of them.',
  },
  {
    x: 'battery',
    y: 'archer',
    intended: 'even',
    reason: 'Archer arrows are too small for the Battery to store, and the Battery closes in fast.',
  },
  {
    x: 'battery',
    y: 'storm',
    intended: 'x',
    level: 'strong',
    reason: 'The Battery stores a third of each Storm strike, then adds it to its next bump.',
  },
  {
    x: 'battery',
    y: 'frost',
    intended: 'y',
    level: 'strong',
    reason: 'Every Frost bump slows the Battery, the fastest ball, right down.',
  },
  {
    x: 'battery',
    y: 'thorns',
    intended: 'y',
    level: 'strong',
    reason: 'The Battery’s hard bumps, stored charge and all, hurt it back on the Thorns’ spikes.',
  },
  {
    x: 'battery',
    y: 'venom',
    intended: 'y',
    level: 'edge',
    reason: 'The Venom’s poison ticks are too small to store, and they wear the Battery down.',
  },
  {
    x: 'battery',
    y: 'berserker',
    intended: 'even',
    reason: 'The Berserker’s rage comes out in bumps, which the Battery never stores.',
  },
  {
    x: 'battery',
    y: 'sniper',
    intended: 'even',
    reason: 'The Sniper’s shots are never stored, so the Battery fights it as a plain ball.',
  },
  {
    x: 'battery',
    y: 'quake',
    intended: 'even',
    reason: 'The Quake’s shockwaves hit for 7, too small for the Battery to store.',
  },
  {
    x: 'battery',
    y: 'ghost',
    intended: 'y',
    level: 'edge',
    reason: 'The phased Ghost slips the Battery’s bumps and hits it for 12 as it passes.',
  },
  {
    x: 'battery',
    y: 'necromancer',
    intended: 'even',
    reason: 'The Necromancer’s skull bites are too small to store; the Battery bumps through.',
  },
  {
    x: 'battery',
    y: 'chrono',
    intended: 'even',
    reason: 'The Chrono never rewinds bumps, and the Battery hits only by bumps.',
  },
  {
    x: 'battery',
    y: 'titan',
    intended: 'y',
    level: 'edge',
    reason: 'Grown, the Titan bumps harder than the Battery and barely turns when hit.',
  },
  {
    x: 'battery',
    y: 'inferno',
    intended: 'even',
    reason:
      'The Inferno’s burns are too small to store, and the fast Battery often outruns the trail.',
  },
  {
    x: 'battery',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Boomerang’s throw is a shot, which the Battery never stores.',
  },
  {
    x: 'battery',
    y: 'bomber',
    intended: 'x',
    level: 'strong',
    reason: 'The Battery stores a third of each Bomber blast, then adds it to its next bump.',
  },
  {
    x: 'battery',
    y: 'spartan',
    intended: 'even',
    reason:
      'The Spartan’s spear is a shot the Battery never stores, and the shield halves its bumps.',
  },
  {
    x: 'battery',
    y: 'bloom',
    intended: 'y',
    level: 'edge',
    reason: 'The Bloom has no big hit for the Battery to store, and regrows between bumps.',
  },
  {
    x: 'battery',
    y: 'hex',
    intended: 'x',
    level: 'strong',
    reason: 'The Battery stores a third of each Hex curse burst, then adds it to its next bump.',
  },
  {
    x: 'battery',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet’s pull steers the Battery into bumps, and bumps are never stored.',
  },
  {
    x: 'battery',
    y: 'spider',
    intended: 'y',
    level: 'edge',
    reason: 'The fast Battery bounces off the most walls, and each Spider web slows it.',
  },
];
