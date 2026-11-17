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
    reason: 'Its hard bumps knock out a half as easily as they split it: even.',
  },
  {
    x: 'slime',
    y: 'speedster',
    intended: 'even',
    reason: 'Quick halves keep up with its speed, but only just: even.',
  },
  {
    x: 'slime',
    y: 'vampire',
    intended: 'y',
    reason: 'Two bodies to bite means twice the lifesteal.',
  },
  {
    x: 'slime',
    y: 'archer',
    intended: 'x',
    reason: 'An arrow finishes one half at most; the other is already on it.',
  },
  {
    x: 'slime',
    y: 'storm',
    intended: 'even',
    reason: 'A strike hits one half, and the halves rarely stand together.',
  },
  {
    x: 'slime',
    y: 'frost',
    intended: 'even',
    reason: 'Its slows reach both halves, but every frosty hit splits them sooner.',
  },
  {
    x: 'slime',
    y: 'thorns',
    intended: 'even',
    reason: 'Two halves bump the spikes twice as often, for less each time.',
  },
  {
    x: 'slime',
    y: 'venom',
    intended: 'even',
    reason: 'Poison splits it, but the new half arrives clean: even.',
  },
  {
    x: 'slime',
    y: 'berserker',
    intended: 'even',
    reason: 'Its rage grows on every hit, and both halves keep hitting: even.',
  },
  {
    x: 'slime',
    y: 'sniper',
    intended: 'x',
    reason: 'One heavy shot finishes one half; the other closes in while it reloads.',
  },
  {
    x: 'slime',
    y: 'quake',
    intended: 'even',
    reason: 'Shockwaves catch both halves, but each for little: even.',
  },
  {
    x: 'slime',
    y: 'magnet',
    intended: 'even',
    reason: 'It never hits from range, so it meets only the timed pull: a plain brawl.',
  },
  {
    x: 'slime',
    y: 'ghost',
    intended: 'even',
    reason: 'Two halves wait out a phase as well as one: even.',
  },
  {
    x: 'slime',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skulls chase one half while the other bumps: even.',
  },
  {
    x: 'slime',
    y: 'chrono',
    intended: 'even',
    reason: 'A rewind undoes a hit on one half, not the split: even.',
  },
  {
    x: 'slime',
    y: 'titan',
    intended: 'even',
    reason: 'The grown Titan crushes a small half, but halves keep it from growing.',
  },
  {
    x: 'slime',
    y: 'inferno',
    intended: 'even',
    reason: 'Its trail burns one half at a time: even.',
  },
  {
    x: 'slime',
    y: 'boomerang',
    intended: 'even',
    reason: 'Its blade hits both halves on the way back, but rarely: even.',
  },
  {
    x: 'slime',
    y: 'bomber',
    intended: 'even',
    reason: 'A blast can catch both halves together, but they rarely bunch: even.',
  },
  {
    x: 'slime',
    y: 'spartan',
    intended: 'even',
    reason: 'The spear finishes one half; the shield holds off the other: even.',
  },
  {
    x: 'slime',
    y: 'bloom',
    intended: 'even',
    reason: 'Two small halves hit often enough to keep the bud shut, no more.',
  },
  {
    x: 'slime',
    y: 'hex',
    intended: 'even',
    reason: 'The curse lands on one half; the other is free: even.',
  },
  {
    x: 'slime',
    y: 'spider',
    intended: 'y',
    reason: 'Both halves bounce off the walls, and every web slows the one it catches.',
  },
  {
    x: 'slime',
    y: 'battery',
    intended: 'even',
    reason: 'Its stored hits are spent on one half: even.',
  },
];
