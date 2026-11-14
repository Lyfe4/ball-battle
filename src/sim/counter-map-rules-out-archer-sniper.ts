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
    reason: 'Arrows keep coming, and every one restarts its 2 s wait.',
  },
  {
    x: 'archer',
    y: 'bomber',
    intended: 'even',
    reason: 'Arrows hit from range, but the frail Archer runs over bombs like anyone.',
  },
  {
    x: 'archer',
    y: 'boomerang',
    intended: 'even',
    reason: 'Both chip from range: arrows lead their aim, a boomerang hits twice.',
  },
  {
    x: 'archer',
    y: 'chrono',
    intended: 'even',
    reason: 'Arrows are too small to rewind, but the Chrono’s heavy bumps finish a frail Archer.',
  },
  {
    x: 'archer',
    y: 'inferno',
    intended: 'even',
    reason: 'Arrows hit from range, but the fire burns the frail Archer wherever it crosses.',
  },
  {
    x: 'archer',
    y: 'sniper',
    intended: 'even',
    reason: 'Two ranged balls: arrows lead their target, the shot hits harder.',
  },
  {
    x: 'archer',
    y: 'thorns',
    intended: 'x',
    reason: 'Arrows never touch the spikes.',
  },
  {
    x: 'brawler',
    y: 'archer',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'frost',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows land on the slow Frost, but every bump slows and hurts the frail Archer.',
  },
  {
    x: 'magnet',
    y: 'archer',
    intended: 'even',
    reason:
      'The pull drags the shooter into a brawl, but arrows land on the way: neither pulls ahead.',
  },
  {
    x: 'necromancer',
    y: 'archer',
    intended: 'x',
    reason: 'A minion nearer than its owner draws the arrows.',
  },
  {
    x: 'speedster',
    y: 'archer',
    intended: 'x',
    reason: 'Closes the distance faster than arrows can stop it.',
  },
  {
    x: 'titan',
    y: 'archer',
    intended: 'even',
    reason:
      'Arrows land while the Titan is small; once grown, its bumps hit back hard: it evens out.',
  },
  {
    x: 'venom',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows chip Venom from range, but every contact poisons the frail Archer.',
  },
  {
    x: 'brawler',
    y: 'sniper',
    intended: 'even',
    reason: 'No tricks either way: plain hits decide it.',
  },
  {
    x: 'chrono',
    y: 'sniper',
    intended: 'x',
    reason: 'A shot is a big hit, and the rewind undoes it.',
  },
  {
    x: 'inferno',
    y: 'sniper',
    intended: 'even',
    reason: 'The shot is heavy, but the Sniper lingers in the fire while it locks on.',
  },
  {
    x: 'magnet',
    y: 'sniper',
    intended: 'even',
    reason:
      'The pull drags the Sniper into contact, but its heavy shot still lands: neither pulls ahead.',
  },
  {
    x: 'necromancer',
    y: 'sniper',
    intended: 'even',
    reason:
      'The skull draws some shots, but the heavy shot wins when it lands: neither pulls ahead.',
  },
  {
    x: 'sniper',
    y: 'bloom',
    intended: 'even',
    reason: 'Shots are big, but they come with time to regrow between.',
  },
  {
    x: 'sniper',
    y: 'bomber',
    intended: 'even',
    reason: 'It shoots from range and seldom crosses the bombs, but it misses a moving target.',
  },
  {
    x: 'sniper',
    y: 'boomerang',
    intended: 'even',
    reason: 'A shot and a throw from range each, and neither stops the other.',
  },
  {
    x: 'sniper',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost takes several shots to bring down, and wins the contacts in between.',
  },
  {
    x: 'sniper',
    y: 'thorns',
    intended: 'x',
    reason: 'The shot never touches the spikes.',
  },
  {
    x: 'sniper',
    y: 'venom',
    intended: 'even',
    reason: 'A shot outdamages the poison, but every contact poisons the Sniper.',
  },
  {
    x: 'speedster',
    y: 'sniper',
    intended: 'x',
    reason: 'The fastest ball, faster still with stacks, is off the locked line before the shot.',
  },
  {
    x: 'titan',
    y: 'sniper',
    intended: 'even',
    reason: 'A huge target for the shot, but the Titan wins every meeting up close.',
  },
];
