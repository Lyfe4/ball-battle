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
    reason: 'Two plain bumpers: nothing big to store, so bumps trade evenly.',
  },
  {
    x: 'battery',
    y: 'speedster',
    intended: 'even',
    reason: 'Its speed hits come as bumps, which it never stores: an even race.',
  },
  {
    x: 'battery',
    y: 'vampire',
    intended: 'y',
    level: 'edge',
    reason: 'The Battery stores no bumps, and it drinks back most of each one they trade.',
  },
  {
    x: 'battery',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows are small and never stored; it closes in about as fast as they chip.',
  },
  {
    x: 'battery',
    y: 'storm',
    intended: 'x',
    level: 'strong',
    reason: 'It stores part of every big strike and bumps the Storm back with it.',
  },
  {
    x: 'battery',
    y: 'frost',
    intended: 'y',
    level: 'edge',
    reason: 'Its speed is its strength, and every frosty hit slows it right down.',
  },
  {
    x: 'battery',
    y: 'thorns',
    intended: 'y',
    level: 'strong',
    reason: 'Its hard bumps, and anything it lets out, meet the spikes.',
  },
  {
    x: 'battery',
    y: 'venom',
    intended: 'even',
    reason: 'Poison ticks are small and never stored: plain trades decide it.',
  },
  {
    x: 'battery',
    y: 'berserker',
    intended: 'even',
    reason: 'Neither has a big hit for the other to use: bump against bump.',
  },
  {
    x: 'battery',
    y: 'sniper',
    intended: 'even',
    reason: 'Heavy shots are never stored, so it fights the Sniper as a plain ball.',
  },
  {
    x: 'battery',
    y: 'quake',
    intended: 'even',
    reason: 'Shockwaves are small; nothing to store, nothing to let out.',
  },
  {
    x: 'battery',
    y: 'ghost',
    intended: 'even',
    reason: 'Its stored bumps pass through a phased Ghost like any other.',
  },
  {
    x: 'battery',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skulls nip and never feed it; it bumps through them evenly.',
  },
  {
    x: 'battery',
    y: 'chrono',
    intended: 'even',
    reason: 'It hits by bumps, which the Chrono never rewinds: an even trade.',
  },
  {
    x: 'battery',
    y: 'titan',
    intended: 'even',
    reason: 'The Titan grows into big bumps, which it never stores.',
  },
  {
    x: 'battery',
    y: 'inferno',
    intended: 'even',
    reason: 'Burns are small and never stored; it outruns the trail about as often as not.',
  },
  {
    x: 'battery',
    y: 'boomerang',
    intended: 'even',
    reason: 'A returning boomerang is a shot, never stored: plain trades.',
  },
  {
    x: 'battery',
    y: 'bomber',
    intended: 'x',
    level: 'strong',
    reason: 'It stores part of every blast and bumps the Bomber back with it.',
  },
  {
    x: 'battery',
    y: 'spartan',
    intended: 'even',
    reason: 'The spear is a shot, never stored, and the shield halves its bumps.',
  },
  {
    x: 'battery',
    y: 'bloom',
    intended: 'y',
    level: 'edge',
    reason: 'It has no big hit for the Battery to store, so it regrows between plain trades.',
  },
  {
    x: 'battery',
    y: 'hex',
    intended: 'x',
    level: 'strong',
    reason: 'It stores part of every curse burst, and its next bump answers it.',
  },
  {
    x: 'battery',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull only steers it into bumps, and bumps are never stored: an even trade.',
  },
  {
    x: 'battery',
    y: 'spider',
    intended: 'y',
    level: 'edge',
    reason: 'It bounces off walls at speed, and every web it hits slows it down.',
  },
];
