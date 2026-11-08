// Counter-map entries for every pair with the Storm and the Quake, from the roster redesign's first group
// (ADR 0045): the Storm, Quake, Berserker, Vampire, Archer, Sniper and Boomerang, each pair in the
// file of the first of its balls in that order. The map is in counter-map.ts; its checks in
// scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
 * the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
 * from range, lifesteal drinks only from bumps, and rage grows with every wound. A favoured pair
 * names its band: `kind` when a kind of hit decides it, `movement` when speed, size, range or a pull
 * does.
 */
export const RULES_OUT_STORM_QUAKE_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'archer',
    y: 'storm',
    intended: 'even',
    reason: 'Two ranged balls: arrows hit more often, a strike hits harder.',
  },
  {
    x: 'berserker',
    y: 'storm',
    intended: 'even',
    reason: 'Lightning is never answered, but the biggest health pool outlasts it.',
  },
  {
    x: 'brawler',
    y: 'storm',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'chrono',
    y: 'storm',
    intended: 'x',
    band: 'kind',
    reason: 'A strike is one big hit, and the rewind undoes it.',
  },
  {
    x: 'magnet',
    y: 'storm',
    intended: 'x',
    band: 'movement',
    reason: 'Pulls the caller into a brawl.',
  },
  {
    x: 'necromancer',
    y: 'storm',
    intended: 'even',
    reason: 'A strike clears a skull, but the Necromancer raises another.',
  },
  {
    x: 'speedster',
    y: 'storm',
    intended: 'x',
    band: 'movement',
    reason: 'Too fast to stay in the warning circle.',
  },
  {
    x: 'storm',
    y: 'bloom',
    intended: 'even',
    reason: 'Strikes are big, but they come with time to regrow between.',
  },
  {
    x: 'storm',
    y: 'bomber',
    intended: 'even',
    reason: 'Lightning from above against bombs below: both are dodged as often as not.',
  },
  {
    x: 'storm',
    y: 'boomerang',
    intended: 'even',
    reason: 'Lightning and a boomerang both strike from afar, and neither stops the other.',
  },
  {
    x: 'storm',
    y: 'frost',
    intended: 'x',
    band: 'movement',
    reason: 'Too slow to leave the warning circle.',
  },
  {
    x: 'storm',
    y: 'ghost',
    intended: 'even',
    reason: 'Lightning needs a target to call: it waits while the Ghost is phased.',
  },
  {
    x: 'storm',
    y: 'guardian',
    intended: 'even',
    reason: 'The shield soaks part of a strike, but the next strike lands whole.',
  },
  {
    x: 'storm',
    y: 'inferno',
    intended: 'even',
    reason: 'Both burn from afar: lightning against the trail of fire.',
  },
  {
    x: 'storm',
    y: 'quake',
    intended: 'even',
    reason: 'One big strike against many small shockwaves: neither stops the other.',
  },
  {
    x: 'storm',
    y: 'sniper',
    intended: 'even',
    reason: 'Lightning hits a wider area, the shot hits harder; neither is ever answered.',
  },
  {
    x: 'storm',
    y: 'thorns',
    intended: 'even',
    reason: 'Lightning never touches the spikes, but Thorns wins the bumps between strikes.',
  },
  {
    x: 'storm',
    y: 'vampire',
    intended: 'even',
    reason: 'Lightning gives it nothing to drink, but it drinks from every bump with the Storm.',
  },
  {
    x: 'titan',
    y: 'storm',
    intended: 'even',
    reason: 'A big target for lightning, but its heavy bumps pay the Storm back.',
  },
  {
    x: 'venom',
    y: 'storm',
    intended: 'even',
    reason: 'Lightning outdamages poison per hit, but every Storm contact is poisoned too.',
  },
  {
    x: 'archer',
    y: 'quake',
    intended: 'even',
    reason: 'Shockwaves and arrows both chip from afar; neither stops the other.',
  },
  {
    x: 'brawler',
    y: 'quake',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'chrono',
    y: 'quake',
    intended: 'even',
    reason: 'Shockwaves chip rather than strike hard, so a rewind undoes little.',
  },
  {
    x: 'frost',
    y: 'quake',
    intended: 'even',
    reason: 'The cold slows it to fewer walls, but every shockwave still lands.',
  },
  {
    x: 'inferno',
    y: 'quake',
    intended: 'even',
    reason: 'Shockwaves and fire both hurt from afar, and neither needs a touch.',
  },
  {
    x: 'magnet',
    y: 'quake',
    intended: 'x',
    band: 'movement',
    reason: 'The pull drags it away from the walls its shockwaves need.',
  },
  {
    x: 'quake',
    y: 'berserker',
    intended: 'even',
    reason: 'Shockwaves wear down its huge health, and every wound makes its hits harder.',
  },
  {
    x: 'quake',
    y: 'bloom',
    intended: 'even',
    reason: 'Shockwaves chip and reset its rest, but each one is small enough to regrow.',
  },
  {
    x: 'quake',
    y: 'bomber',
    intended: 'even',
    reason: 'It races to the walls for its shockwaves and crosses bombs on the way.',
  },
  {
    x: 'quake',
    y: 'boomerang',
    intended: 'even',
    reason: 'Shockwaves and a boomerang both chip from afar; neither stops the other.',
  },
  {
    x: 'quake',
    y: 'ghost',
    intended: 'even',
    reason: 'Shockwaves still hit it phased, but phased, it passes through the Quake.',
  },
  {
    x: 'quake',
    y: 'guardian',
    intended: 'even',
    reason: 'A shockwave breaks the shield, but the shield grows back.',
  },
  {
    x: 'quake',
    y: 'necromancer',
    intended: 'x',
    band: 'movement',
    reason: 'Every shockwave clears the skulls around it.',
  },
  {
    x: 'quake',
    y: 'sniper',
    intended: 'even',
    reason: 'Shockwaves by the walls against one heavy shot: neither stops the other.',
  },
  {
    x: 'quake',
    y: 'speedster',
    intended: 'x',
    band: 'movement',
    reason: 'The fastest ball runs into the most shockwaves.',
  },
  {
    x: 'quake',
    y: 'thorns',
    intended: 'even',
    reason: 'Shockwaves are never reflected, but its contact hits are.',
  },
  {
    x: 'quake',
    y: 'vampire',
    intended: 'even',
    reason: 'Shockwaves chip it from afar, and it drinks back from every bump.',
  },
  {
    x: 'quake',
    y: 'venom',
    intended: 'even',
    reason: 'Both wear their enemy down between contacts: one on the walls, one over time.',
  },
  {
    x: 'titan',
    y: 'quake',
    intended: 'even',
    reason: 'A big target for shockwaves, but its heavy bumps pay the Quake back.',
  },
];
