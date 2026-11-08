// Counter-map entries for every pair with the Berserker and the Vampire, from the roster redesign's first group
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
export const RULES_OUT_BERSERKER_VAMPIRE_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'berserker',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows chip it from range, but every wound makes its hits on the Archer harder.',
  },
  {
    x: 'berserker',
    y: 'bloom',
    intended: 'even',
    reason: 'Its huge health makes a long fight to regrow in, and its rage grows as it goes.',
  },
  {
    x: 'berserker',
    y: 'bomber',
    intended: 'even',
    reason: 'Every blast is a wound that feeds its rage, and its huge health soaks them.',
  },
  {
    x: 'berserker',
    y: 'boomerang',
    intended: 'even',
    reason: 'Its huge health soaks the chips, and every chip feeds its rage.',
  },
  {
    x: 'berserker',
    y: 'frost',
    intended: 'even',
    reason: 'The cold slows it like any ball, and its huge health outlasts the slow.',
  },
  {
    x: 'berserker',
    y: 'guardian',
    intended: 'even',
    reason: 'Raging hits lose little to armor, but the rage takes wounds to build.',
  },
  {
    x: 'berserker',
    y: 'inferno',
    intended: 'even',
    reason: 'Every burn is a wound that feeds its rage, and the fire keeps burning.',
  },
  {
    x: 'berserker',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skull pops feed its rage, but the Necromancer raises more.',
  },
  {
    x: 'berserker',
    y: 'speedster',
    intended: 'x',
    band: 'kind',
    reason: 'Its huge health soaks the stacked rush.',
  },
  {
    x: 'berserker',
    y: 'venom',
    intended: 'even',
    reason: 'Poison chips its huge health, and every chip feeds its rage.',
  },
  {
    x: 'brawler',
    y: 'berserker',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'chrono',
    y: 'berserker',
    intended: 'even',
    reason: 'A raging bump is never big enough to rewind: plain trades decide it.',
  },
  {
    x: 'ghost',
    y: 'berserker',
    intended: 'y',
    band: 'kind',
    reason: 'Its raging hits come one at a time, and each lands whole.',
  },
  {
    x: 'magnet',
    y: 'berserker',
    intended: 'even',
    reason: 'Both want a brawl: the pull feeds its rage as much as the Magnet’s hits.',
  },
  {
    x: 'sniper',
    y: 'berserker',
    intended: 'even',
    reason: 'Shots wound it from range, but every wound makes its contact hits harder.',
  },
  {
    x: 'thorns',
    y: 'berserker',
    intended: 'x',
    band: 'kind',
    reason: 'Its raging bumps hurt it back.',
  },
  {
    x: 'titan',
    y: 'berserker',
    intended: 'even',
    reason: 'Every heavy hit feeds the rage, and the rage pays it back.',
  },
  {
    x: 'vampire',
    y: 'berserker',
    intended: 'even',
    reason: 'Lifesteal drinks from the biggest health pool, but its heavy hits pay it back.',
  },
  {
    x: 'archer',
    y: 'vampire',
    intended: 'x',
    band: 'kind',
    reason: 'It can’t drink from an arrow.',
  },
  {
    x: 'brawler',
    y: 'vampire',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'frost',
    y: 'vampire',
    intended: 'even',
    reason: 'Slowing does not change a contact trade, and Frost never stops the healing.',
  },
  {
    x: 'ghost',
    y: 'vampire',
    intended: 'even',
    reason: 'Bumps come one at a time and land whole: plain trades decide it.',
  },
  {
    x: 'guardian',
    y: 'vampire',
    intended: 'even',
    reason: 'Armor takes little off a heavy bump, and the Vampire drinks what lands.',
  },
  {
    x: 'magnet',
    y: 'vampire',
    intended: 'even',
    reason: 'Pulled into brawls, the Vampire heals off them as fast as it loses.',
  },
  {
    x: 'necromancer',
    y: 'vampire',
    intended: 'even',
    reason: 'Minion pops chip it, but it heals off its hits on the Necromancer.',
  },
  {
    x: 'sniper',
    y: 'vampire',
    intended: 'even',
    reason: 'Lifesteal cannot answer a shot, but the Vampire wins the contacts in between.',
  },
  {
    x: 'thorns',
    y: 'vampire',
    intended: 'even',
    reason: 'Reflection hurts the Vampire, but lifesteal heals back part of every trade.',
  },
  {
    x: 'vampire',
    y: 'bloom',
    intended: 'even',
    reason: 'Both heal: the Vampire from its bumps, the Bloom all the time.',
  },
  {
    x: 'vampire',
    y: 'bomber',
    intended: 'even',
    reason: 'A blast costs it, and lifesteal wins some back on every contact.',
  },
  {
    x: 'vampire',
    y: 'boomerang',
    intended: 'y',
    band: 'kind',
    reason: 'It can’t drink from a boomerang.',
  },
  {
    x: 'vampire',
    y: 'chrono',
    intended: 'even',
    reason: 'A rewind never undoes what the Vampire drank, but bumps decide it.',
  },
  {
    x: 'vampire',
    y: 'inferno',
    intended: 'even',
    reason: 'It heals back the burns off its own hits, as fast as the fire takes them.',
  },
  {
    x: 'vampire',
    y: 'speedster',
    intended: 'even',
    reason: 'It heals off every exchange, and the faster stacks hit back as hard as it drinks.',
  },
  {
    x: 'vampire',
    y: 'titan',
    intended: 'x',
    band: 'movement',
    reason: 'A growing giant is a bigger target: more of its bumps land, and each one heals it.',
  },
  {
    x: 'vampire',
    y: 'venom',
    intended: 'even',
    reason: 'Lifesteal heals back some of the poison, but the poison keeps ticking.',
  },
];
