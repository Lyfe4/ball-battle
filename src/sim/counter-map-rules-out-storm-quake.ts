// Counter-map entries for every pair with the Storm and the Quake, from the roster redesign's first group
// (ADR 0045): the Storm, Quake, Berserker, Vampire, Archer, Sniper and Boomerang, each pair in the
// file of the first of its balls in that order. The map is in counter-map.ts; its checks in
// scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
 * the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
 * from range, lifesteal drinks most of what its bumps deal, and rage grows with every hit taken.
 */
export const RULES_OUT_STORM_QUAKE_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'archer',
    y: 'storm',
    intended: 'even',
    reason: 'Archer arrows hit more often; the Storm’s lightning hits harder.',
  },
  {
    x: 'berserker',
    y: 'storm',
    intended: 'even',
    reason: 'A Storm strike stores just one rage, and the Berserker’s big health takes it.',
  },
  {
    x: 'brawler',
    y: 'storm',
    intended: 'even',
    reason: 'The Storm’s lightning hits from afar, and the Brawler bumps hard up close.',
  },
  {
    x: 'chrono',
    y: 'storm',
    intended: 'x',
    level: 'strong',
    reason: 'Each Storm strike hits for 42, a big hit the Chrono rewinds.',
  },
  {
    x: 'magnet',
    y: 'storm',
    intended: 'even',
    reason: 'The Magnet pulls the Storm into a brawl, but the strikes still land.',
  },
  {
    x: 'necromancer',
    y: 'storm',
    intended: 'even',
    reason: 'A Storm strike clears the skull, and the Necromancer raises a new one 0.9 s later.',
  },
  {
    x: 'speedster',
    y: 'storm',
    intended: 'x',
    level: 'edge',
    reason:
      'The Speedster leaves most warning circles in time, and rushes the Storm between strikes.',
  },
  {
    x: 'storm',
    y: 'bloom',
    intended: 'even',
    reason: 'Storm strikes hit hard, but each dodged one gives the Bloom time to regrow.',
  },
  {
    x: 'storm',
    y: 'bomber',
    intended: 'even',
    reason: 'The Storm’s strikes and the Bomber’s bombs can both be dodged, as often as not.',
  },
  {
    x: 'storm',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Storm’s lightning and the Boomerang’s throw both hit from afar.',
  },
  {
    x: 'storm',
    y: 'frost',
    intended: 'even',
    reason: 'The slow Frost leaves the Storm’s circle late, but its big health takes a strike.',
  },
  {
    x: 'storm',
    y: 'inferno',
    intended: 'even',
    reason: 'The Storm strikes from afar; the Inferno burns along its trail.',
  },
  {
    x: 'storm',
    y: 'quake',
    intended: 'even',
    reason: 'The Storm lands one big strike; the Quake sends many small shockwaves.',
  },
  {
    x: 'storm',
    y: 'sniper',
    intended: 'even',
    reason: 'The Storm’s strike hits harder; the Sniper’s shot comes with less warning.',
  },
  {
    x: 'storm',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason: 'Storm lightning never touches the spikes, and one strike outweighs the Thorns’ bumps.',
  },
  {
    x: 'storm',
    y: 'vampire',
    intended: 'x',
    level: 'strong',
    reason: 'One Storm strike hits for 42, more than the Vampire’s 37, and heals it nothing.',
  },
  {
    x: 'titan',
    y: 'storm',
    intended: 'even',
    reason: 'The grown Titan is a big target for lightning, and its bumps pay the Storm back.',
  },
  {
    x: 'venom',
    y: 'storm',
    intended: 'even',
    reason: 'A Storm strike outhits the Venom’s poison, but every bump poisons the Storm.',
  },
  {
    x: 'archer',
    y: 'quake',
    intended: 'even',
    reason: 'The Quake’s shockwaves and the Archer’s arrows both chip without a bump.',
  },
  {
    x: 'brawler',
    y: 'quake',
    intended: 'even',
    reason: 'The Quake’s shockwaves chip the Brawler at the walls, and the Brawler bumps harder.',
  },
  {
    x: 'chrono',
    y: 'quake',
    intended: 'y',
    level: 'strong',
    reason: 'The Quake’s shockwaves come off every wall, each too small for the Chrono to rewind.',
  },
  {
    x: 'frost',
    y: 'quake',
    intended: 'even',
    reason: 'Frost bumps slow the Quake to fewer walls, but each shockwave still chips the Frost.',
  },
  {
    x: 'inferno',
    y: 'quake',
    intended: 'y',
    level: 'edge',
    reason: 'The Quake bumps for 15 to the Inferno’s 7, and both hurt without a touch.',
  },
  {
    x: 'magnet',
    y: 'quake',
    intended: 'even',
    reason: 'The Magnet’s pull drags the Quake away from the walls its shockwaves come from.',
  },
  {
    x: 'quake',
    y: 'berserker',
    intended: 'y',
    level: 'edge',
    reason:
      'Every small shockwave stores rage, so the Berserker’s next bump hits the Quake harder.',
  },
  {
    x: 'quake',
    y: 'bloom',
    intended: 'x',
    level: 'edge',
    reason: 'Each Quake shockwave shuts the Bloom’s bud, and they come off every wall.',
  },
  {
    x: 'quake',
    y: 'bomber',
    intended: 'even',
    reason:
      'The Quake races to the walls for shockwaves and crosses the Bomber’s bombs on the way.',
  },
  {
    x: 'quake',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Quake’s shockwaves and the Boomerang’s throw both chip without a bump.',
  },
  {
    x: 'quake',
    y: 'necromancer',
    intended: 'x',
    level: 'strong',
    reason: 'Wide Quake shockwaves clear the skull before it arrives, and chip the Necromancer.',
  },
  {
    x: 'quake',
    y: 'sniper',
    intended: 'even',
    reason: 'The Quake shakes the walls; the Sniper fires one heavy shot every 2 s.',
  },
  {
    x: 'quake',
    y: 'speedster',
    intended: 'x',
    level: 'edge',
    reason: 'The Speedster covers the most ground, so it runs into the most Quake shockwaves.',
  },
  {
    x: 'quake',
    y: 'thorns',
    intended: 'even',
    reason: 'The Quake’s shockwaves are never reflected, but its bumps meet the Thorns’ spikes.',
  },
  {
    x: 'quake',
    y: 'vampire',
    intended: 'even',
    reason: 'The Quake’s shockwaves chip the Vampire from afar, and it heals off every bump.',
  },
  {
    x: 'quake',
    y: 'venom',
    intended: 'even',
    reason: 'The Quake chips at the walls; the Venom’s poison ticks after each bump.',
  },
  {
    x: 'titan',
    y: 'quake',
    intended: 'even',
    reason: 'The grown Titan is a big target for shockwaves, and its bumps pay the Quake back.',
  },
];
