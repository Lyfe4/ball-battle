// Counter-map entries for the Hex (ADR 0049): every pair of it with another ball. The map is in
// counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The Hex's bump curses, and 3 s later the mark bursts for a quarter of the cursed ball's full
 * health. A big ball takes a big burst, so it beats the sturdy balls (and the Inferno, whose light
 * bumps barely hurt back), and loses to the frail ones that take a small burst and heal or halve
 * it, and to the Ghost, which can't be cursed while phased.
 */
export const HEX_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'hex',
    y: 'brawler',
    intended: 'even',
    reason: 'A burst is worth about one of its hard bumps: plain trades decide it.',
  },
  {
    x: 'hex',
    y: 'speedster',
    intended: 'x',
    reason:
      'Every bump that builds its speed hit curses it, and a burst is a quarter of its health.',
  },
  {
    x: 'hex',
    y: 'vampire',
    intended: 'y',
    reason: 'Its small health makes a small burst, and it drinks that back with its next bump.',
  },
  {
    x: 'hex',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows land from afar between the bumps that curse it: neither pulls ahead.',
  },
  {
    x: 'hex',
    y: 'storm',
    intended: 'even',
    reason: 'A burst and a strike are both one big hit now and then: neither pulls ahead.',
  },
  {
    x: 'hex',
    y: 'frost',
    intended: 'x',
    reason: 'Its big health makes a big burst, and slow as it is, it can’t trade bumps fast.',
  },
  {
    x: 'hex',
    y: 'thorns',
    intended: 'even',
    reason: 'A burst is no bump, so the spikes never answer it, but its bumps meet them.',
  },
  {
    x: 'hex',
    y: 'venom',
    intended: 'even',
    reason: 'Poison and the curse both hurt after the touch: neither pulls ahead.',
  },
  {
    x: 'hex',
    y: 'berserker',
    intended: 'x',
    reason:
      'The most health makes the biggest burst, and one burst gives it one rage, not several.',
  },
  {
    x: 'hex',
    y: 'sniper',
    intended: 'even',
    reason: 'One heavy shot from afar against a burst up close: neither pulls ahead.',
  },
  {
    x: 'hex',
    y: 'quake',
    intended: 'even',
    reason: 'Small shockwaves against a big burst now and then: neither pulls ahead.',
  },
  {
    x: 'hex',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull brings the bumps that curse it, and its hard bumps hit back.',
  },
  {
    x: 'hex',
    y: 'ghost',
    intended: 'y',
    reason: 'Passing through it while phased lays no curse, and a burst on a phased Ghost misses.',
  },
  {
    x: 'hex',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skeletons bite between bumps, and its middling health takes a middling burst.',
  },
  {
    x: 'hex',
    y: 'chrono',
    intended: 'even',
    reason: 'Its burst is under the big hit it rewinds, so plain trades decide it.',
  },
  {
    x: 'hex',
    y: 'titan',
    intended: 'even',
    reason: 'Its big health makes a big burst, but its growing bumps hit back harder.',
  },
  {
    x: 'hex',
    y: 'inferno',
    intended: 'x',
    reason: 'Its big health makes a big burst, and its light bumps barely hurt back.',
  },
  {
    x: 'hex',
    y: 'boomerang',
    intended: 'even',
    reason: 'The boomerang hits it from afar between the bumps that curse: neither pulls ahead.',
  },
  {
    x: 'hex',
    y: 'bomber',
    intended: 'even',
    reason: 'A burst and a blast are both one big hit now and then: neither pulls ahead.',
  },
  {
    x: 'hex',
    y: 'spartan',
    intended: 'y',
    reason: 'Its small health makes a small burst, halved again when its shield is planted.',
  },
  {
    x: 'hex',
    y: 'bloom',
    intended: 'even',
    reason: 'Its burst restarts the wait, but it is small: neither pulls ahead.',
  },
  {
    x: 'hex',
    y: 'spider',
    intended: 'even',
    reason: 'Webs slow it on the walls, and the curse hits back: neither pulls ahead.',
  },
];
