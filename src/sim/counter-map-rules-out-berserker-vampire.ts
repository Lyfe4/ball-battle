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
    reason: 'Every arrow stores rage, so each bump it lands on the frail Archer hits far harder.',
  },
  {
    x: 'berserker',
    y: 'bloom',
    intended: 'y',
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
    reason: 'Every boomerang hit stores rage, and the thrower can’t keep away from its bumps.',
  },
  {
    x: 'berserker',
    y: 'frost',
    intended: 'y',
    reason:
      'Slowed, it reaches the Frost less often, and the Frost’s big health outlasts its rage.',
  },
  {
    x: 'berserker',
    y: 'inferno',
    intended: 'x',
    reason: 'Every burn stores rage, so the Inferno takes a raging bump each time they meet.',
  },
  {
    x: 'berserker',
    y: 'necromancer',
    intended: 'even',
    reason:
      'Every skull bite stores rage, but the Necromancer raises another: neither pulls ahead.',
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
    intended: 'even',
    reason:
      'Its raging bumps come back off the spikes, but its big health soaks them: neither pulls ahead.',
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
    reason: 'The Berserker only bumps, and the Vampire drinks back most of every bump it trades.',
  },
  {
    x: 'archer',
    y: 'vampire',
    intended: 'x',
    reason: 'Arrows never touch it, so it has nothing to drink, and its health is small.',
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
    reason:
      'Each bump restarts the wait and is drunk back, but on little health it can’t pull away.',
  },
  {
    x: 'vampire',
    y: 'bomber',
    intended: 'even',
    reason:
      'A blast takes much of its small health, but it drinks back most of every bump: it evens out.',
  },
  {
    x: 'vampire',
    y: 'boomerang',
    intended: 'y',
    reason: 'The boomerang never touches it, so it has nothing to drink, and its health is small.',
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
    intended: 'even',
    reason: 'A bigger target means more bumps to drink from, and harder ones back.',
  },
  {
    x: 'vampire',
    y: 'venom',
    intended: 'even',
    reason: 'Lifesteal heals back some of the poison, but the poison keeps ticking.',
  },
];
