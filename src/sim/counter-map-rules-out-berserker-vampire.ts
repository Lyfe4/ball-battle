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
    reason: 'Every arrow stores rage, so each bump it lands on the frail Archer hits far harder.',
  },
  {
    x: 'berserker',
    y: 'bloom',
    intended: 'y',
    level: 'strong',
    reason: 'Its raging bumps come with long gaps, and the Bloom regrows in each.',
  },
  {
    x: 'berserker',
    y: 'bomber',
    intended: 'even',
    reason:
      'A blast stores just one rage, and its big health soaks the blast: neither pulls ahead.',
  },
  {
    x: 'berserker',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
    reason: 'Every boomerang hit stores rage, and the thrower can’t keep away from its bumps.',
  },
  {
    x: 'berserker',
    y: 'frost',
    intended: 'y',
    level: 'edge',
    reason:
      'Slowed, it reaches the Frost less often, and the Frost’s big health outlasts its rage.',
  },
  {
    x: 'berserker',
    y: 'inferno',
    intended: 'x',
    level: 'strong',
    reason: 'Every burn stores rage, so the Inferno takes a raging bump each time they meet.',
  },
  {
    x: 'berserker',
    y: 'necromancer',
    intended: 'x',
    level: 'edge',
    reason: 'Every skull bite stores rage, so it meets the Necromancer with a full next bump.',
  },
  {
    x: 'berserker',
    y: 'speedster',
    intended: 'even',
    reason: 'Every rush stores rage, but the fastest ball lands more often: neither pulls ahead.',
  },
  {
    x: 'berserker',
    y: 'venom',
    intended: 'x',
    level: 'strong',
    reason: 'Every poison tick stores rage, so each bump it lands hits far harder.',
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
    x: 'magnet',
    y: 'berserker',
    intended: 'even',
    reason: 'Both want a brawl: the pull feeds its rage as much as the Magnet’s hits.',
  },
  {
    x: 'sniper',
    y: 'berserker',
    intended: 'even',
    reason:
      'Shots hurt it from range, but each one stores rage for its next bump: neither pulls ahead.',
  },
  {
    x: 'thorns',
    y: 'berserker',
    intended: 'x',
    level: 'edge',
    reason: 'Its raging bumps come back off the spikes, and the spikes store it no rage.',
  },
  {
    x: 'titan',
    y: 'berserker',
    intended: 'even',
    reason: 'Every growing bump stores rage, and the rage pays it back: neither pulls ahead.',
  },
  {
    x: 'vampire',
    y: 'berserker',
    intended: 'x',
    level: 'strong',
    reason: 'The Berserker only bumps, and the Vampire drinks back most of every bump it trades.',
  },
  {
    x: 'archer',
    y: 'vampire',
    intended: 'x',
    level: 'edge',
    reason: 'Arrows never touch it, though each one makes it thirsty and quick to close in.',
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
    intended: 'y',
    level: 'edge',
    reason: 'Being slowed doesn’t change a bump trade, and it drinks back most of every one.',
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
    intended: 'y',
    level: 'edge',
    reason: 'The spikes hurt it back, but its lifesteal heals more than they take.',
  },
  {
    x: 'vampire',
    y: 'bloom',
    intended: 'x',
    level: 'edge',
    reason: 'Each bump shuts the bud and is drunk back, so the Bloom never regrows its lead.',
  },
  {
    x: 'vampire',
    y: 'bomber',
    intended: 'y',
    level: 'strong',
    reason: 'A blast takes three quarters of its small health, and a blast heals it nothing.',
  },
  {
    x: 'vampire',
    y: 'boomerang',
    intended: 'even',
    reason: 'The boomerang never touches it, but each hit sends it in fast to drink: even.',
  },
  {
    x: 'vampire',
    y: 'chrono',
    intended: 'x',
    level: 'edge',
    reason: 'Bumps are never rewound, and it drinks back most of each one it trades.',
  },
  {
    x: 'vampire',
    y: 'inferno',
    intended: 'x',
    level: 'edge',
    reason: 'Burns make it thirsty, so it closes in fast and drinks back the fire.',
  },
  {
    x: 'vampire',
    y: 'speedster',
    intended: 'x',
    level: 'strong',
    reason: 'Its bumps drink back each rush, and the rush’s extra hit makes it thirsty.',
  },
  {
    x: 'vampire',
    y: 'titan',
    intended: 'x',
    level: 'edge',
    reason: 'It drinks back most of each trade before the Titan grows big enough to outhit it.',
  },
  {
    x: 'vampire',
    y: 'venom',
    intended: 'x',
    level: 'edge',
    reason: 'Poison makes it thirsty, so it closes in and drinks back what drips.',
  },
];
