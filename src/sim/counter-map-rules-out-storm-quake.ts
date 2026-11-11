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
    reason: 'Two ranged balls: arrows hit more often, a strike hits harder.',
  },
  {
    x: 'berserker',
    y: 'storm',
    intended: 'even',
    reason:
      'A strike stores only one rage, and its big health outlasts the lightning: neither pulls ahead.',
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
    reason: 'A strike is a big hit, and the rewind undoes it.',
  },
  {
    x: 'magnet',
    y: 'storm',
    intended: 'even',
    reason:
      'The pull drags the caller into a brawl, but the strikes still land: neither pulls ahead.',
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
    intended: 'even',
    reason: 'Fast enough to leave some warning circles, not all of them: neither pulls ahead.',
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
    intended: 'even',
    reason: 'Slow to leave the warning circle, but sturdy enough to take a strike.',
  },
  {
    x: 'storm',
    y: 'ghost',
    intended: 'even',
    reason: 'One strike at a time: each lands whole, after the fade ends.',
  },
  {
    x: 'storm',
    y: 'guardian',
    intended: 'even',
    reason: 'Armor takes only a little off a big strike.',
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
    intended: 'x',
    reason: 'One strike takes most of its small health, and lightning gives it nothing to drink.',
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
    intended: 'y',
    reason: 'Shockwaves are far too small to rewind, and they keep coming.',
  },
  {
    x: 'frost',
    y: 'quake',
    intended: 'even',
    reason:
      'Slowed, it hits fewer walls, but the Frost still meets its shockwaves: neither pulls ahead.',
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
    intended: 'even',
    reason: 'The pull drags it away from the walls, but into a brawl it can hold.',
  },
  {
    x: 'quake',
    y: 'berserker',
    intended: 'y',
    reason: 'Every small shockwave stores rage, so its next bump hits far harder.',
  },
  {
    x: 'quake',
    y: 'bloom',
    intended: 'even',
    reason: 'Shockwaves are small enough to regrow, but they keep coming.',
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
    reason: 'It fades after a shockwave, but the next wall comes after the fade.',
  },
  {
    x: 'quake',
    y: 'guardian',
    intended: 'y',
    reason: 'Armor takes half of every small shockwave.',
  },
  {
    x: 'quake',
    y: 'necromancer',
    intended: 'x',
    reason: 'Wide shockwaves keep popping the skull before it reaches the Quake.',
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
    intended: 'even',
    reason: 'The fastest ball runs into the most shockwaves, but rushes in hard between them.',
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
