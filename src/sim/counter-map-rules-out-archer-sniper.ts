// Counter-map entries for every pair with the Archer and the Sniper, from the roster redesign's first group
// (ADR 0045): the Storm, Quake, Berserker, Vampire, Archer, Sniper and Boomerang, each pair in the
// file of the first of its balls in that order. The map is in counter-map.ts; its checks in
// scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
 * the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
 * from range, lifesteal drinks most of what its bumps deal, and rage grows with every hit taken.
 */
export const RULES_OUT_ARCHER_SNIPER_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'archer',
    y: 'bloom',
    intended: 'x',
    level: 'strong',
    reason: 'The Archer shoots every 1.8 s, so the Bloom never gets its 2 s alone.',
  },
  {
    x: 'archer',
    y: 'bomber',
    intended: 'even',
    reason: 'The Archer’s arrows hit from range, but it runs over the Bomber’s bombs like anyone.',
  },
  {
    x: 'archer',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Archer leads its arrows; the Boomerang’s throw can hit twice.',
  },
  {
    x: 'archer',
    y: 'chrono',
    intended: 'x',
    level: 'edge',
    reason: 'Archer arrows are too small for the Chrono to rewind, and land between its bumps.',
  },
  {
    x: 'archer',
    y: 'inferno',
    intended: 'x',
    level: 'edge',
    reason: 'The Archer’s arrows hit from range, more than the Inferno’s fire burns it back.',
  },
  {
    x: 'archer',
    y: 'sniper',
    intended: 'even',
    reason: 'The Archer leads its arrows; the Sniper’s shot hits harder.',
  },
  {
    x: 'archer',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason: 'Arrows never touch the spikes, but the Archer is frail when the Thorns closes in.',
  },
  {
    x: 'brawler',
    y: 'archer',
    intended: 'even',
    reason: 'The Archer chips from range, and the Brawler bumps hard up close.',
  },
  {
    x: 'frost',
    y: 'archer',
    intended: 'y',
    level: 'edge',
    reason: 'The slow Frost is easy for the Archer to lead, so arrows land often.',
  },
  {
    x: 'magnet',
    y: 'archer',
    intended: 'x',
    level: 'strong',
    reason: 'Every arrow on the Magnet starts a pull that drags the Archer into its bumps.',
  },
  {
    x: 'necromancer',
    y: 'archer',
    intended: 'x',
    level: 'strong',
    reason: 'The Archer aims at the skull whenever it is nearer than the Necromancer.',
  },
  {
    x: 'speedster',
    y: 'archer',
    intended: 'x',
    level: 'strong',
    reason: 'The Speedster closes on the Archer fast, and the Archer’s bump is weak.',
  },
  {
    x: 'titan',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows chip the Titan while it is small; grown, it bumps the Archer hard.',
  },
  {
    x: 'venom',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows chip the Venom from range, and every bump poisons the Archer.',
  },
  {
    x: 'brawler',
    y: 'sniper',
    intended: 'even',
    reason: 'The Sniper shoots from afar, and the Brawler bumps hard up close.',
  },
  {
    x: 'chrono',
    y: 'sniper',
    intended: 'x',
    level: 'edge',
    reason: 'Each Sniper shot hits for 22, big enough for the Chrono to rewind.',
  },
  {
    x: 'inferno',
    y: 'sniper',
    intended: 'y',
    level: 'edge',
    reason: 'A Sniper shot every 2 s outweighs the small Inferno burns it takes.',
  },
  {
    x: 'magnet',
    y: 'sniper',
    intended: 'even',
    reason: 'Each Sniper shot on the Magnet starts a pull, but the shots still land.',
  },
  {
    x: 'necromancer',
    y: 'sniper',
    intended: 'x',
    level: 'edge',
    reason: 'The Necromancer’s skull draws the Sniper’s shots whenever it is nearer.',
  },
  {
    x: 'sniper',
    y: 'bloom',
    intended: 'even',
    reason: 'Sniper shots hit hard, but each miss gives the Bloom time to regrow.',
  },
  {
    x: 'sniper',
    y: 'bomber',
    intended: 'even',
    reason: 'The Sniper shoots from range and seldom crosses bombs, but misses a moving Bomber.',
  },
  {
    x: 'sniper',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Sniper and the Boomerang both hit from range, and neither stops the other.',
  },
  {
    x: 'sniper',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost takes several Sniper shots, and its bumps slow the Sniper between them.',
  },
  {
    x: 'sniper',
    y: 'thorns',
    intended: 'x',
    level: 'strong',
    reason: 'The Sniper’s shot never touches the spikes, and the slow Thorns can’t slip its line.',
  },
  {
    x: 'sniper',
    y: 'venom',
    intended: 'even',
    reason: 'A Sniper shot hits harder than the Venom’s poison, but every bump poisons the Sniper.',
  },
  {
    x: 'speedster',
    y: 'sniper',
    intended: 'x',
    level: 'strong',
    reason: 'The fast Speedster is off the Sniper’s locked line before the shot.',
  },
  {
    x: 'titan',
    y: 'sniper',
    intended: 'even',
    reason: 'The grown Titan is a huge target for the shot, and bumps the Sniper hard.',
  },
];
