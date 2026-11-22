// Counter-map entries for the Banshee (ADR 0075): every pair of it with another ball, measured at
// 500 seeds in ruleset 22. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Its wail hits all around it and nothing blocks it. So it beats the balls whose defence is not
 * being touched (the phased Ghost); it edges the frail Vampire, which heals only from bumps (since
 * ruleset 23 each wail sends it in fast, ADR 0077); and loses to the Chrono, which rewinds one big
 * hit, to shooters outside its ring and to the grown Titan.
 */
export const BANSHEE_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'banshee',
    y: 'brawler',
    intended: 'even',
    reason: 'The Banshee wails from afar, and the Brawler’s heavy bumps answer up close.',
  },
  {
    x: 'banshee',
    y: 'speedster',
    intended: 'even',
    reason: 'The Speedster builds its rush on the walls, often outside the Banshee’s wail.',
  },
  {
    x: 'banshee',
    y: 'vampire',
    intended: 'x',
    level: 'edge',
    reason:
      'The Banshee’s wail hits the Vampire with no bump to heal from, though it speeds it up.',
  },
  {
    x: 'banshee',
    y: 'archer',
    intended: 'y',
    level: 'strong',
    reason: 'The Archer’s arrows reach the Banshee from beyond the wail’s ring.',
  },
  {
    x: 'banshee',
    y: 'storm',
    intended: 'even',
    reason: 'The Storm’s lightning and the Banshee’s wail both hit from afar.',
  },
  {
    x: 'banshee',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost’s big health takes the Banshee’s wails, and its bumps slow the Banshee.',
  },
  {
    x: 'banshee',
    y: 'thorns',
    intended: 'even',
    reason:
      'The Banshee’s wail never touches the Thorns’ spikes, and the Thorns’ big health takes it.',
  },
  {
    x: 'banshee',
    y: 'venom',
    intended: 'even',
    reason: 'The Venom’s poison ticks after each bump; the Banshee’s wail needs no bump.',
  },
  {
    x: 'banshee',
    y: 'berserker',
    intended: 'y',
    level: 'edge',
    reason: 'Every wail builds the Berserker’s rage, and its next bump lets it out on the Banshee.',
  },
  {
    x: 'banshee',
    y: 'sniper',
    intended: 'y',
    level: 'edge',
    reason: 'The Sniper’s heavy shot reaches the Banshee from beyond the wail’s ring.',
  },
  {
    x: 'banshee',
    y: 'quake',
    intended: 'even',
    reason: 'The Banshee’s wail and the Quake’s shockwaves both hit all around.',
  },
  {
    x: 'banshee',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet pulls the Banshee close, right into the wail’s ring.',
  },
  {
    x: 'banshee',
    y: 'ghost',
    intended: 'x',
    level: 'strong',
    reason: 'The Ghost phases through bumps, but the Banshee’s wail goes through phasing.',
  },
  {
    x: 'banshee',
    y: 'necromancer',
    intended: 'even',
    reason:
      'The Necromancer’s skulls bite the Banshee; the wail skips the skulls and hits their owner.',
  },
  {
    x: 'banshee',
    y: 'chrono',
    intended: 'y',
    level: 'strong',
    reason: 'The Chrono rewinds a wail every 10 s and bumps for 22 to the Banshee’s 4.',
  },
  {
    x: 'banshee',
    y: 'titan',
    intended: 'y',
    level: 'strong',
    reason: 'The Titan grows and bumps ever harder, and the Banshee’s own bump is weak.',
  },
  {
    x: 'banshee',
    y: 'inferno',
    intended: 'even',
    reason: 'The Inferno’s fire and the Banshee’s wail both hurt without a bump.',
  },
  {
    x: 'banshee',
    y: 'boomerang',
    intended: 'y',
    level: 'edge',
    reason: 'The Boomerang’s throw can hit the Banshee twice, from beyond the wail’s ring.',
  },
  {
    x: 'banshee',
    y: 'bomber',
    intended: 'even',
    reason: 'The Bomber’s blasts and the Banshee’s wails both hit hard from afar.',
  },
  {
    x: 'banshee',
    y: 'spartan',
    intended: 'even',
    reason:
      'The Banshee’s wail skips the Spartan’s shield, and the spear still lands on the Banshee.',
  },
  {
    x: 'banshee',
    y: 'bloom',
    intended: 'even',
    reason: 'Each Banshee wail shuts the Bloom’s bud, but wails come only every 2.8 s.',
  },
  {
    x: 'banshee',
    y: 'hex',
    intended: 'even',
    reason: 'The Hex’s curse bursts for 15 on the Banshee; each wail hits the Hex for 33.',
  },
  {
    x: 'banshee',
    y: 'spider',
    intended: 'x',
    level: 'edge',
    reason: 'The Banshee’s wail needs no wall or bump, so the Spider’s webs barely slow it.',
  },
  {
    x: 'banshee',
    y: 'battery',
    intended: 'even',
    reason: 'Nothing blocks the Banshee’s wail, so the Battery stores none of it.',
  },
  {
    x: 'banshee',
    y: 'slime',
    intended: 'y',
    level: 'edge',
    reason:
      'The Slime bumps for 24 to the Banshee’s 4, and splits into two bumpers at half health.',
  },
  {
    x: 'banshee',
    y: 'kraken',
    intended: 'even',
    reason: 'The Banshee’s wail still reaches the Kraken while it anchors to squeeze.',
  },
];
