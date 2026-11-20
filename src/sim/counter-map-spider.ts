// Counter-map entries for the Spider (ADR 0049): every pair of it with another ball. The map is in
// counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The Spider webs every wall it bounces off; a ball that bounces off a web is slowed and nipped.
 * The slow is the decider, so it beats the balls whose ability feeds on speed or walls, and the
 * Slime, whose two halves both bounce into webs. A web that catches is used up (ADR 0060), so a
 * ball that keeps coming back to one wall (the Chrono) is even. It loses to the balls a slow costs nothing
 * (the Archer's arrows, the Boomerang, the Bomber's blasts, the Spartan's spear behind its shield).
 */
export const SPIDER_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'spider',
    y: 'brawler',
    intended: 'even',
    reason: 'Webs slow and nip it, but its hard bumps still trade evenly.',
  },
  {
    x: 'spider',
    y: 'speedster',
    intended: 'x',
    level: 'strong',
    reason: 'The fastest ball hits the most walls, and every web slows it right down.',
  },
  {
    x: 'spider',
    y: 'vampire',
    intended: 'even',
    reason: 'A nip is too small to matter to lifesteal: plain trades decide it.',
  },
  {
    x: 'spider',
    y: 'archer',
    intended: 'y',
    level: 'strong',
    reason: 'Its arrows don’t need speed, so a slow costs nothing, and they land from afar.',
  },
  {
    x: 'spider',
    y: 'storm',
    intended: 'even',
    reason: 'Slowed, it leaves a strike late, but strikes come one at a time: neither pulls ahead.',
  },
  {
    x: 'spider',
    y: 'frost',
    intended: 'even',
    reason: 'Both slow the other, so neither outruns anyone: plain trades decide it.',
  },
  {
    x: 'spider',
    y: 'thorns',
    intended: 'even',
    reason: 'A nip is no bump, so the spikes never answer it, but they punish its bumps.',
  },
  {
    x: 'spider',
    y: 'venom',
    intended: 'even',
    reason: 'Poison and nips both chip away: neither pulls ahead.',
  },
  {
    x: 'spider',
    y: 'berserker',
    intended: 'y',
    level: 'edge',
    reason: 'Its big health shrugs off the nips, and every nip stores rage for its next bump.',
  },
  {
    x: 'spider',
    y: 'sniper',
    intended: 'even',
    reason: 'A heavy shot from afar against slowing webs: neither pulls ahead.',
  },
  {
    x: 'spider',
    y: 'quake',
    intended: 'even',
    reason: 'Slowed, it reaches fewer walls and sends fewer shockwaves, but they still land: even.',
  },
  {
    x: 'spider',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull drags it off the walls, so fewer webs catch it: neither pulls ahead.',
  },
  {
    x: 'spider',
    y: 'ghost',
    intended: 'even',
    reason: 'A phased bounce slips through the web, a solid one is caught: neither pulls ahead.',
  },
  {
    x: 'spider',
    y: 'necromancer',
    intended: 'even',
    reason: 'Webs catch only the Necromancer, never its skeletons: neither pulls ahead.',
  },
  {
    x: 'spider',
    y: 'chrono',
    intended: 'x',
    level: 'edge',
    reason: 'Webs nip and slow it on every wall, and a nip is too small to rewind.',
  },
  {
    x: 'spider',
    y: 'titan',
    intended: 'even',
    reason: 'A slowed giant still grows, and its bumps get heavier: neither pulls ahead.',
  },
  {
    x: 'spider',
    y: 'inferno',
    intended: 'even',
    reason: 'Nips against burns, small hits both ways: neither pulls ahead.',
  },
  {
    x: 'spider',
    y: 'boomerang',
    intended: 'y',
    level: 'edge',
    reason:
      'A slow costs a returning boomerang nothing, and each pass chips it as nips can’t keep up.',
  },
  {
    x: 'spider',
    y: 'bomber',
    intended: 'y',
    level: 'strong',
    reason: 'A slow doesn’t stop a blast, and each bomb it runs into costs more than nips win.',
  },
  {
    x: 'spider',
    y: 'spartan',
    intended: 'y',
    level: 'edge',
    reason: 'The shield halves the nips, and the spear lands however slow it is.',
  },
  {
    x: 'spider',
    y: 'bloom',
    intended: 'even',
    reason: 'Webs and nips restart the wait, but they are small: neither pulls ahead.',
  },
];
