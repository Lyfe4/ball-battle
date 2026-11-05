// Counter-map entries for batch 2: the Berserker, Sniper and Quake (ADR 0015), one per pair with
// every earlier ball and each other. The map is in counter-map.ts; its checks in
// scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Each new ball has one favoured and one unfavoured matchup from its mechanics and is even with
 * the rest: the Berserker's health pool soaks the Speedster's burst but feeds the Vampire; the
 * Speedster outruns the Sniper's locked line, whose shots never touch Thorns' spikes; the Quake's
 * short warning can't be outrun by the Speedster, and the Frost's slow keeps it off the walls.
 * ADR 0016 adds pair-specific interactions: poison numbs the Berserker's rage (Venom over it), the
 * Berserker can't be slowed (it over the Frost), and the Quake's shockwaves stagger the balls that
 * aim (it over the Archer, Storm and Sniper).
 */
export const BATCH_TWO_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'berserker',
    y: 'speedster',
    intended: 'x',
    reason: 'Its huge health soaks the burst, and every hit it soaks makes its own hits harder.',
  },
  {
    x: 'vampire',
    y: 'berserker',
    intended: 'x',
    reason: 'The biggest health pool gives lifesteal the most to drink, and rage never stops it.',
  },
  {
    x: 'brawler',
    y: 'berserker',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'thorns',
    y: 'berserker',
    intended: 'even',
    reason: 'Rage hits are contact hits, so the spikes reflect them, but its health takes it.',
  },
  {
    x: 'berserker',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows chip it from range, but every wound makes its hits on the Archer harder.',
  },
  {
    x: 'berserker',
    y: 'storm',
    intended: 'even',
    reason: 'Lightning is never answered, but the biggest health pool outlasts it.',
  },
  {
    x: 'berserker',
    y: 'frost',
    intended: 'x',
    reason:
      'Rage burns off the cold: it can never be slowed, so the Frost’s one trick does nothing.',
  },
  {
    x: 'berserker',
    y: 'venom',
    intended: 'y',
    reason: 'Poison numbs its rage, so it never hits hard while Venom keeps it poisoned.',
  },
  {
    x: 'speedster',
    y: 'sniper',
    intended: 'x',
    reason: 'The fastest ball, faster still with stacks, is off the locked line before the shot.',
  },
  {
    x: 'sniper',
    y: 'thorns',
    intended: 'x',
    reason: 'Shots never touch the spikes, and its light contact hits leave little to reflect.',
  },
  {
    x: 'brawler',
    y: 'sniper',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'sniper',
    y: 'vampire',
    intended: 'even',
    reason: 'Lifesteal cannot answer a shot, but the Vampire wins the contacts in between.',
  },
  {
    x: 'archer',
    y: 'sniper',
    intended: 'even',
    reason: 'Two ranged balls: arrows lead their target, the shot hits harder.',
  },
  {
    x: 'storm',
    y: 'sniper',
    intended: 'even',
    reason: 'Lightning hits a wider area, the shot hits harder; neither is ever answered.',
  },
  {
    x: 'sniper',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost takes several shots to bring down, and wins the contacts in between.',
  },
  {
    x: 'sniper',
    y: 'venom',
    intended: 'even',
    reason: 'A shot outdamages the poison, but every contact poisons the Sniper.',
  },
  {
    x: 'sniper',
    y: 'berserker',
    intended: 'even',
    reason: 'Shots wound it from range, but every wound makes its contact hits harder.',
  },
  {
    x: 'quake',
    y: 'speedster',
    intended: 'x',
    reason: 'The warning is too short to outrun, so speed buys the Speedster nothing.',
  },
  {
    x: 'frost',
    y: 'quake',
    intended: 'x',
    reason: 'Slowed, the Quake reaches the walls less often, and every shockwave needs a wall.',
  },
  {
    x: 'brawler',
    y: 'quake',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'quake',
    y: 'vampire',
    intended: 'even',
    reason: 'Lifesteal cannot answer a shockwave, but the Vampire wins the contacts.',
  },
  {
    x: 'archer',
    y: 'quake',
    intended: 'y',
    reason: 'A shockwave staggers the Archer: it can’t aim, so it loses arrows.',
  },
  {
    x: 'storm',
    y: 'quake',
    intended: 'y',
    reason: 'A shockwave staggers the Storm: it can’t aim, so it calls less lightning.',
  },
  {
    x: 'quake',
    y: 'thorns',
    intended: 'even',
    reason: 'Shockwaves are never reflected, but its contact hits are.',
  },
  {
    x: 'quake',
    y: 'venom',
    intended: 'even',
    reason: 'Both wear their enemy down between contacts: one on the walls, one over time.',
  },
  {
    x: 'quake',
    y: 'berserker',
    intended: 'even',
    reason: 'Shockwaves wound it from a distance, but every wound makes its hits harder.',
  },
  {
    x: 'quake',
    y: 'sniper',
    intended: 'x',
    reason:
      'A shockwave staggers the Sniper: its lock breaks without a shot, and it waits to aim again.',
  },
];
