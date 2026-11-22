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
    reason: 'The Spider’s webs slow and nip the Brawler, but its hard bumps still land.',
  },
  {
    x: 'spider',
    y: 'speedster',
    intended: 'x',
    level: 'strong',
    reason: 'The Speedster hits the most walls, and every Spider web slows it right down.',
  },
  {
    x: 'spider',
    y: 'vampire',
    intended: 'even',
    reason: 'A Spider web’s nip of 3 barely dents the Vampire’s healing.',
  },
  {
    x: 'spider',
    y: 'archer',
    intended: 'y',
    level: 'strong',
    reason: 'A Spider web’s slow costs the Archer little: its arrows still fly at full speed.',
  },
  {
    x: 'spider',
    y: 'storm',
    intended: 'even',
    reason: 'The Spider’s webs slow the Storm, and the Storm’s strikes come one at a time.',
  },
  {
    x: 'spider',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost and the Spider both slow the other, so neither outruns anyone.',
  },
  {
    x: 'spider',
    y: 'thorns',
    intended: 'even',
    reason:
      'A Spider web’s nip is no bump, so the Thorns’ spikes skip it, but its bumps meet them.',
  },
  {
    x: 'spider',
    y: 'venom',
    intended: 'even',
    reason: 'The Venom’s poison and the Spider’s nips both chip away.',
  },
  {
    x: 'spider',
    y: 'berserker',
    intended: 'y',
    level: 'edge',
    reason: 'Every Spider web nip stores the Berserker rage, and its big health shrugs them off.',
  },
  {
    x: 'spider',
    y: 'sniper',
    intended: 'even',
    reason: 'The Sniper hits hard from afar, and the Spider’s webs slow it.',
  },
  {
    x: 'spider',
    y: 'quake',
    intended: 'even',
    reason:
      'Webs slow the Quake to fewer walls and shockwaves, but those still land on the Spider.',
  },
  {
    x: 'spider',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet’s pull steers the Spider off its line, toward bumps instead of walls.',
  },
  {
    x: 'spider',
    y: 'ghost',
    intended: 'even',
    reason: 'A phased Ghost slips through a Spider web; a solid one is caught.',
  },
  {
    x: 'spider',
    y: 'necromancer',
    intended: 'even',
    reason: 'The Spider’s webs catch only the Necromancer, never its skulls.',
  },
  {
    x: 'spider',
    y: 'chrono',
    intended: 'x',
    level: 'edge',
    reason: 'The Spider’s webs nip and slow the Chrono, and a nip is too small to rewind.',
  },
  {
    x: 'spider',
    y: 'titan',
    intended: 'even',
    reason: 'A Titan caught in Spider webs still grows, and its bumps get heavier.',
  },
  {
    x: 'spider',
    y: 'inferno',
    intended: 'even',
    reason: 'The Spider nips at the walls; the Inferno burns along its trail.',
  },
  {
    x: 'spider',
    y: 'boomerang',
    intended: 'y',
    level: 'edge',
    reason:
      'A Spider web’s slow costs the Boomerang’s throw nothing, and each pass chips the Spider.',
  },
  {
    x: 'spider',
    y: 'bomber',
    intended: 'y',
    level: 'strong',
    reason: 'A web’s slow doesn’t stop a Bomber blast, and each bomb costs the Spider 28.',
  },
  {
    x: 'spider',
    y: 'spartan',
    intended: 'y',
    level: 'edge',
    reason:
      'The Spartan’s shield halves the Spider’s nips, and the spear lands however slow it is.',
  },
  {
    x: 'spider',
    y: 'bloom',
    intended: 'even',
    reason: 'Spider webs shut the Bloom’s bud, but each nip is small.',
  },
];
