// Counter-map entries for every pair with the Berserker and the Vampire, from the roster redesign's first group
// (ADR 0045): the Storm, Quake, Berserker, Vampire, Archer, Sniper and Boomerang, each pair in the
// file of the first of its balls in that order. The map is in counter-map.ts; its checks in
// scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
 * the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
 * from range, lifesteal drinks most of what its bumps deal, and rage grows with every hit taken.
 */
export const RULES_OUT_BERSERKER_VAMPIRE_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'berserker',
    y: 'archer',
    intended: 'x',
    level: 'edge',
    reason: 'Every arrow stores rage, so the Berserker’s next bump hits the Archer far harder.',
  },
  {
    x: 'berserker',
    y: 'bloom',
    intended: 'y',
    level: 'strong',
    reason: 'The Berserker’s raging bumps come with gaps, and the Bloom regrows in each.',
  },
  {
    x: 'berserker',
    y: 'bomber',
    intended: 'even',
    reason: 'A Bomber blast stores just one rage, and the Berserker’s big health takes it.',
  },
  {
    x: 'berserker',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
    reason:
      'Every Boomerang hit stores the Berserker rage for a bump the thrower can’t keep clear of.',
  },
  {
    x: 'berserker',
    y: 'frost',
    intended: 'y',
    level: 'edge',
    reason: 'Each Frost bump slows the Berserker and hits harder than its plain bump.',
  },
  {
    x: 'berserker',
    y: 'inferno',
    intended: 'x',
    level: 'strong',
    reason:
      'Every burn stores the Berserker rage, so the Inferno takes a raging bump at each meeting.',
  },
  {
    x: 'berserker',
    y: 'necromancer',
    intended: 'x',
    level: 'edge',
    reason:
      'Every skull bite stores rage, so the Berserker meets the Necromancer with a full bump.',
  },
  {
    x: 'berserker',
    y: 'speedster',
    intended: 'even',
    reason:
      'Every Speedster bump stores the Berserker rage, and the Speedster lands bumps more often.',
  },
  {
    x: 'berserker',
    y: 'venom',
    intended: 'x',
    level: 'strong',
    reason: 'Every poison tick stores rage, so each Berserker bump on the Venom hits harder.',
  },
  {
    x: 'brawler',
    y: 'berserker',
    intended: 'even',
    reason: 'The Brawler’s hard bumps each store rage for the Berserker’s next one.',
  },
  {
    x: 'chrono',
    y: 'berserker',
    intended: 'even',
    reason: 'A raging Berserker bump is still a bump, which the Chrono never rewinds.',
  },
  {
    x: 'magnet',
    y: 'berserker',
    intended: 'even',
    reason: 'The Magnet pulls the Berserker into the brawl, and each bump feeds its rage.',
  },
  {
    x: 'sniper',
    y: 'berserker',
    intended: 'even',
    reason: 'Sniper shots hurt the Berserker from range, but each stores rage for its next bump.',
  },
  {
    x: 'thorns',
    y: 'berserker',
    intended: 'x',
    level: 'edge',
    reason: 'The Berserker’s raging bumps come back off the Thorns’ spikes, which store no rage.',
  },
  {
    x: 'titan',
    y: 'berserker',
    intended: 'even',
    reason: 'Every growing Titan bump stores rage, and the Berserker’s next bump pays it back.',
  },
  {
    x: 'vampire',
    y: 'berserker',
    intended: 'x',
    level: 'strong',
    reason: 'The Berserker only bumps, and the Vampire heals 95% of each one.',
  },
  {
    x: 'archer',
    y: 'vampire',
    intended: 'x',
    level: 'edge',
    reason: 'Archer arrows give the Vampire nothing to heal from, only a burst of speed.',
  },
  {
    x: 'brawler',
    y: 'vampire',
    intended: 'even',
    reason: 'The Vampire heals off every bump, and the Brawler bumps hardest.',
  },
  {
    x: 'frost',
    y: 'vampire',
    intended: 'y',
    level: 'edge',
    reason: 'The Frost’s slow doesn’t stop a bump trade, and the Vampire heals most of each one.',
  },
  {
    x: 'magnet',
    y: 'vampire',
    intended: 'even',
    reason: 'The Magnet pulls the Vampire into bumps, and the Vampire heals off each.',
  },
  {
    x: 'necromancer',
    y: 'vampire',
    intended: 'even',
    reason: 'Skull bites chip the Vampire, and it heals off its bumps on the Necromancer.',
  },
  {
    x: 'sniper',
    y: 'vampire',
    intended: 'even',
    reason: 'The Vampire can’t heal off a Sniper shot, but it heals off their bumps.',
  },
  {
    x: 'thorns',
    y: 'vampire',
    intended: 'y',
    level: 'edge',
    reason: 'The Thorns’ spikes hurt the Vampire back, but it heals more than they take.',
  },
  {
    x: 'vampire',
    y: 'bloom',
    intended: 'x',
    level: 'edge',
    reason: 'Each Vampire bump shuts the Bloom’s bud and heals the Vampire.',
  },
  {
    x: 'vampire',
    y: 'bomber',
    intended: 'y',
    level: 'strong',
    reason: 'A Bomber blast takes 28 of the Vampire’s 37 health and heals it nothing.',
  },
  {
    x: 'vampire',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Boomerang’s throw gives the Vampire no bump to heal from, only speed to close in.',
  },
  {
    x: 'vampire',
    y: 'chrono',
    intended: 'x',
    level: 'edge',
    reason: 'The Chrono never rewinds bumps, and the Vampire heals most of each one.',
  },
  {
    x: 'vampire',
    y: 'inferno',
    intended: 'x',
    level: 'edge',
    reason: 'Inferno burns speed the Vampire up, so it closes in fast and heals off its bumps.',
  },
  {
    x: 'vampire',
    y: 'speedster',
    intended: 'x',
    level: 'edge',
    reason:
      'The Vampire heals off each bump; the Speedster’s rush speeds it up but is never healed.',
  },
  {
    x: 'vampire',
    y: 'titan',
    intended: 'x',
    level: 'edge',
    reason: 'The Vampire heals off each trade before the Titan grows big enough to outhit it.',
  },
  {
    x: 'vampire',
    y: 'venom',
    intended: 'x',
    level: 'edge',
    reason: 'Venom poison speeds the Vampire up, so it closes in and heals off its bumps.',
  },
];
