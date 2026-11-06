// Counter-map entries for the first eight balls (ADR 0010, 0012, 0013, 0014). The map and its
// checks are in counter-map.ts (and scripts/counter-map.ts); a new ball adds its entries in the
// file for its batch.
import type { CounterEntry } from './counter-map.ts';

/**
 * One soft triangle from the balls' mechanics (Speedster > Archer > Vampire > Speedster), the
 * Storm's place (favoured against the Vampire, unfavoured against the Speedster, even with the
 * Archer), and the Brawler as the safe pick, even against everyone but Thorns, its one designed counter
 * (docs/vision.md, ADR 0013). Frost
 * (ADR 0012) has one favoured and one unfavoured matchup from its mechanics and is even against
 * the rest. Venom (ADR 0014) is favoured against Thorns and unfavoured against the Vampire.
 * ADR 0016 adds the Archer over the Frost (and the Frost over Venom, even again since ADR 0028
 * removed the cold's resistance to poison). ADR 0028 also makes the Vampire and Speedster even.
 */
export const FIRST_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'speedster',
    y: 'archer',
    intended: 'x',
    reason: 'Closes the distance faster than arrows can stop it.',
  },
  {
    x: 'archer',
    y: 'vampire',
    intended: 'x',
    reason: 'Chips the Vampire from range, where lifesteal cannot answer.',
  },
  {
    x: 'vampire',
    y: 'speedster',
    intended: 'even',
    reason: 'It heals off every exchange, and the faster stacks hit back as hard as it drinks.',
  },
  {
    x: 'storm',
    y: 'vampire',
    intended: 'x',
    reason: 'Lightning is ranged damage, which lifesteal cannot answer.',
  },
  {
    x: 'speedster',
    y: 'storm',
    intended: 'x',
    reason: 'The fastest target outruns the most warnings.',
  },
  {
    x: 'archer',
    y: 'storm',
    intended: 'even',
    reason: 'Two ranged balls: arrows hit more often, a strike hits harder.',
  },
  {
    x: 'brawler',
    y: 'speedster',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'brawler',
    y: 'vampire',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'brawler',
    y: 'archer',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'brawler',
    y: 'storm',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'frost',
    y: 'speedster',
    intended: 'x',
    reason: 'Slowed, it loses its speed and the wall bounces that build its stacks.',
  },
  {
    x: 'storm',
    y: 'frost',
    intended: 'x',
    reason: 'The slowest ball is the least likely to leave a lightning warning in time.',
  },
  {
    x: 'brawler',
    y: 'frost',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'frost',
    y: 'vampire',
    intended: 'even',
    reason: 'Slowing does not change a contact trade, and Frost never stops the healing.',
  },
  {
    x: 'frost',
    y: 'archer',
    intended: 'y',
    reason: 'Leading arrows land most often on the slowest ball, and the Archer rarely touches it.',
  },
  {
    x: 'thorns',
    y: 'brawler',
    intended: 'x',
    reason: 'The hardest hitter hurts itself the most on the spikes.',
  },
  {
    x: 'archer',
    y: 'thorns',
    intended: 'x',
    reason: 'Arrows never touch the spikes, so they are never reflected.',
  },
  {
    x: 'storm',
    y: 'thorns',
    intended: 'x',
    reason: 'Lightning never touches the spikes, so it is never reflected.',
  },
  {
    x: 'thorns',
    y: 'speedster',
    intended: 'even',
    reason: 'Reflection answers its contact hits, but it hits softly and often.',
  },
  {
    x: 'thorns',
    y: 'vampire',
    intended: 'even',
    reason: 'Reflection hurts the Vampire, but lifesteal heals back part of every trade.',
  },
  {
    x: 'thorns',
    y: 'frost',
    intended: 'even',
    reason: 'Two contact balls: the Frost hits hard into the spikes, but slows Thorns.',
  },
  {
    x: 'venom',
    y: 'thorns',
    intended: 'x',
    reason: 'Poison never touches the spikes, and its light hits leave little to reflect.',
  },
  {
    x: 'vampire',
    y: 'venom',
    intended: 'x',
    reason: 'Lifesteal out-heals the poison: every trade heals back what the poison chipped.',
  },
  {
    x: 'brawler',
    y: 'venom',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'venom',
    y: 'speedster',
    intended: 'even',
    reason: 'Poison works between the Speedster bursts, but Venom’s own hits are light.',
  },
  {
    x: 'venom',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows chip Venom from range, but every contact poisons the fragile Archer.',
  },
  {
    x: 'venom',
    y: 'storm',
    intended: 'even',
    reason: 'Lightning outdamages poison per hit, but every Storm contact is poisoned too.',
  },
  {
    x: 'venom',
    y: 'frost',
    intended: 'even',
    reason: 'Poison wears it down between contacts, and every touch slows Venom in turn.',
  },
];
