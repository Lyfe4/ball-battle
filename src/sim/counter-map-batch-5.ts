// Counter-map entries for batch 5, first half: the Boomerang and the Bomber with every earlier ball
// (ADR 0043). The rest of the batch is in counter-map-batch-5-defenders.ts; the map is in
// counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Each counter was measured before it was kept (ADR 0043). A boomerang chips twice a throw from
 * range, so lifesteal, phasing and fire answer it poorly; a fast ball outruns it, a stagger holds
 * it, a bigger body wins the trades and a skull stops it dead. Bombs punish whoever covers the most
 * ground, and a ball that shoots from range crosses them least.
 */
export const BATCH_FIVE_ENTRIES: readonly CounterEntry[] = [
  // The Boomerang.
  {
    x: 'brawler',
    y: 'boomerang',
    intended: 'even',
    reason: 'It chips from range, the Brawler hits hard up close: plain trades decide it.',
  },
  {
    x: 'speedster',
    y: 'boomerang',
    intended: 'x',
    reason: 'It outruns the throw and closes in while the boomerang is away.',
  },
  {
    x: 'vampire',
    y: 'boomerang',
    intended: 'even',
    reason: 'Lifesteal drinks from every contact, and the boomerang chips it back from range.',
  },
  {
    x: 'archer',
    y: 'boomerang',
    intended: 'even',
    reason: 'Both chip from range: arrows lead their aim, a boomerang hits twice.',
  },
  {
    x: 'storm',
    y: 'boomerang',
    intended: 'even',
    reason: 'Lightning and a boomerang both strike from afar, and neither stops the other.',
  },
  {
    x: 'frost',
    y: 'boomerang',
    intended: 'even',
    reason: 'The slowest ball is the easiest to hit twice, and its heavy hits pay it back.',
  },
  {
    x: 'thorns',
    y: 'boomerang',
    intended: 'even',
    reason: 'The boomerang never touches the spikes, and Thorns soaks its light hits.',
  },
  {
    x: 'venom',
    y: 'boomerang',
    intended: 'even',
    reason: 'Poison works between throws, and its light hits can’t stop the boomerang.',
  },
  {
    x: 'berserker',
    y: 'boomerang',
    intended: 'even',
    reason: 'Its huge health soaks the chips, and every chip feeds its rage.',
  },
  {
    x: 'sniper',
    y: 'boomerang',
    intended: 'even',
    reason: 'A shot and a throw from range each, and neither stops the other.',
  },
  {
    x: 'quake',
    y: 'boomerang',
    intended: 'x',
    reason: 'A shockwave staggers the Boomerang: it can’t aim, so it holds its throw.',
  },
  {
    x: 'magnet',
    y: 'boomerang',
    intended: 'even',
    reason: 'The pull drags it into a brawl, but the boomerang hits the Magnet on the way in.',
  },
  {
    x: 'boomerang',
    y: 'ghost',
    intended: 'x',
    reason: 'A boomerang in flight still hits it phased, and comes back to hit again.',
  },
  {
    x: 'necromancer',
    y: 'boomerang',
    intended: 'x',
    reason: 'A skull nearer than its owner draws the throw, and a skull stops a boomerang dead.',
  },
  {
    x: 'chrono',
    y: 'boomerang',
    intended: 'even',
    reason: 'Two light hits a throw, and a rewind undoes about one of them.',
  },
  {
    x: 'titan',
    y: 'boomerang',
    intended: 'x',
    reason: 'The growing body meets it more often, and its light hits lose every trade.',
  },
  {
    x: 'boomerang',
    y: 'inferno',
    intended: 'x',
    reason: 'It throws from range and never has to cross the fire.',
  },
  // The Bomber.
  {
    x: 'brawler',
    y: 'bomber',
    intended: 'even',
    reason: 'It runs into bombs like anyone, and hits hard when it gets there.',
  },
  {
    x: 'bomber',
    y: 'speedster',
    intended: 'x',
    reason: 'The fastest ball covers the most ground, so it runs into the most bombs.',
  },
  {
    x: 'vampire',
    y: 'bomber',
    intended: 'even',
    reason: 'A blast costs it, and lifesteal wins some back on every contact.',
  },
  {
    x: 'archer',
    y: 'bomber',
    intended: 'x',
    reason: 'It shoots from range, so it has the least need to cross the bombs.',
  },
  {
    x: 'storm',
    y: 'bomber',
    intended: 'even',
    reason: 'Lightning from above against bombs below: both are dodged as often as not.',
  },
  {
    x: 'frost',
    y: 'bomber',
    intended: 'even',
    reason: 'The slowest ball runs into few bombs, but it can’t outrun a blast either.',
  },
  {
    x: 'thorns',
    y: 'bomber',
    intended: 'even',
    reason: 'A blast never touches the spikes, but the Bomber’s own hits are light.',
  },
  {
    x: 'venom',
    y: 'bomber',
    intended: 'even',
    reason: 'Poison ticks on between blasts, and a blast hurts it like anyone.',
  },
  {
    x: 'berserker',
    y: 'bomber',
    intended: 'even',
    reason: 'Every blast is a wound that feeds its rage, and its huge health soaks them.',
  },
  {
    x: 'sniper',
    y: 'bomber',
    intended: 'even',
    reason: 'It shoots from range and seldom crosses the bombs, but it misses a moving target.',
  },
  {
    x: 'quake',
    y: 'bomber',
    intended: 'even',
    reason: 'It races to the walls for its shockwaves and crosses bombs on the way.',
  },
  {
    x: 'magnet',
    y: 'bomber',
    intended: 'even',
    reason: 'The pull drags it across the bombs, and its heavy hits pay them back.',
  },
  {
    x: 'ghost',
    y: 'bomber',
    intended: 'even',
    reason: 'Phased, it passes over bombs without setting them off, but a blast still catches it.',
  },
  {
    x: 'necromancer',
    y: 'bomber',
    intended: 'even',
    reason: 'Skulls pass over the bombs, but a blast clears any skull inside it.',
  },
  {
    x: 'chrono',
    y: 'bomber',
    intended: 'even',
    reason: 'A rewind can undo one blast, and it hits hard back.',
  },
  {
    x: 'titan',
    y: 'bomber',
    intended: 'even',
    reason: 'The bigger body sets off more bombs, and hits back harder for it.',
  },
  {
    x: 'inferno',
    y: 'bomber',
    intended: 'even',
    reason: 'Fire and bombs both lie in wait behind them, and each crosses the other’s.',
  },
];
