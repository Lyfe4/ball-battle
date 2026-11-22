// Counter-map entries for the Slime (ADR 0060): every pair of it with another ball, measured at 500
// seeds in ruleset 19. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * At half health the Slime splits into two small, quick slimes, and the enemy must finish both. So
 * it beats the balls that win with one aimed hit at a time (an arrow, a heavy shot only ever
 * finishes one half), and loses to the balls that gain from two bodies: the Spider's webs catch
 * both halves, and the Vampire drinks from two.
 */
export const SLIME_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'slime',
    y: 'brawler',
    intended: 'even',
    reason: 'The Brawler’s hard bumps split the Slime, then knock out each half fast.',
  },
  {
    x: 'slime',
    y: 'speedster',
    intended: 'x',
    level: 'edge',
    reason: 'The Slime’s halves are 20% faster, and the Speedster must finish two bodies.',
  },
  {
    x: 'slime',
    y: 'vampire',
    intended: 'y',
    level: 'edge',
    reason: 'Two Slime halves give the Vampire more bumps to heal from.',
  },
  {
    x: 'slime',
    y: 'archer',
    intended: 'x',
    level: 'edge',
    reason: 'An Archer arrow can finish one Slime half at most, and the other is already on it.',
  },
  {
    x: 'slime',
    y: 'storm',
    intended: 'even',
    reason: 'A Storm strike hits one Slime half, and the halves rarely stand together.',
  },
  {
    x: 'slime',
    y: 'frost',
    intended: 'y',
    level: 'edge',
    reason:
      'The Frost’s slow takes away the Slime halves’ extra speed, and the Frost has more health.',
  },
  {
    x: 'slime',
    y: 'thorns',
    intended: 'even',
    reason: 'Two Slime halves meet the Thorns’ spikes twice as often, for less each time.',
  },
  {
    x: 'slime',
    y: 'venom',
    intended: 'y',
    level: 'edge',
    reason: 'The Venom’s poison ticks on each Slime half it bumps, and two halves mean more bumps.',
  },
  {
    x: 'slime',
    y: 'berserker',
    intended: 'even',
    reason: 'Two Slime halves hit the Berserker often, and every hit builds its rage.',
  },
  {
    x: 'slime',
    y: 'sniper',
    intended: 'x',
    level: 'strong',
    reason:
      'One Sniper shot finishes a Slime half at most, and the other closes in while it reloads.',
  },
  {
    x: 'slime',
    y: 'quake',
    intended: 'even',
    reason: 'The Quake’s shockwaves catch both Slime halves, but each for little.',
  },
  {
    x: 'slime',
    y: 'magnet',
    intended: 'even',
    reason: 'The Slime never hits from range, so the Magnet pulls only on its timer.',
  },
  {
    x: 'slime',
    y: 'ghost',
    intended: 'y',
    level: 'edge',
    reason: 'The phased Ghost hits each Slime half it passes through, and no half can touch it.',
  },
  {
    x: 'slime',
    y: 'necromancer',
    intended: 'even',
    reason: 'The skull chases one Slime half while the other bumps the Necromancer.',
  },
  {
    x: 'slime',
    y: 'chrono',
    intended: 'even',
    reason: 'The Slime only bumps, so the Chrono’s rewind never acts.',
  },
  {
    x: 'slime',
    y: 'titan',
    intended: 'even',
    reason: 'The Titan grows and bumps harder, but must catch two small Slime halves.',
  },
  {
    x: 'slime',
    y: 'inferno',
    intended: 'even',
    reason: 'The Inferno’s fire burns one Slime half at a time.',
  },
  {
    x: 'slime',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Boomerang’s throw can hit both Slime halves on its way back, but rarely does.',
  },
  {
    x: 'slime',
    y: 'bomber',
    intended: 'even',
    reason: 'A Bomber blast can catch both Slime halves, but they rarely bunch.',
  },
  {
    x: 'slime',
    y: 'spartan',
    intended: 'x',
    level: 'edge',
    reason: 'The spear finishes one Slime half, while the other bumps the frail Spartan.',
  },
  {
    x: 'slime',
    y: 'bloom',
    intended: 'y',
    level: 'edge',
    reason: 'The Slime halves’ lighter bumps leave gaps the Bloom regrows in.',
  },
  {
    x: 'slime',
    y: 'hex',
    intended: 'x',
    level: 'edge',
    reason: 'Once the Slime splits, a Hex curse lands on one half, and the other bumps free.',
  },
  {
    x: 'slime',
    y: 'spider',
    intended: 'y',
    level: 'edge',
    reason: 'Both Slime halves bounce off walls, and every Spider web slows the one it catches.',
  },
  {
    x: 'slime',
    y: 'battery',
    intended: 'even',
    reason: 'The Slime only bumps, so the Battery never stores anything.',
  },
];
