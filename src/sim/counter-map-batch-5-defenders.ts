// Counter-map entries for batch 5, second half: the Guardian and the Bloom with every earlier ball,
// and the four new balls with each other (ADR 0043). The first half (the Boomerang and the Bomber)
// is in counter-map-batch-5.ts; the map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Measured before kept, like the first half. The shield soaks part of one hit and takes seconds to
 * regrow, so a steady drip (poison, burns, reflections) strips it, while a heavy hit that heals
 * its owner loses a slice. Regrowth heals a small hit back after a short rest, so drip and heavy
 * hits outweigh it, and rare or small hits (skulls, blasts, a boomerang) do not. Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
 * counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules.
 */
export const BATCH_FIVE_DEFENDER_ENTRIES: readonly CounterEntry[] = [
  // The Guardian.
  {
    x: 'brawler',
    y: 'guardian',
    intended: 'even',
    reason: 'The shield blunts one hard hit, and the next one lands: plain trades decide it.',
  },
  {
    x: 'speedster',
    y: 'guardian',
    intended: 'even',
    reason: 'Its rush is a hit and a bonus: the shield soaks the hit, and the bonus lands.',
  },
  {
    x: 'frost',
    y: 'guardian',
    intended: 'even',
    reason: 'The shield blunts one heavy hit, and the slow can’t stop a shield from regrowing.',
  },
  {
    x: 'thorns',
    y: 'guardian',
    intended: 'x',
    band: 'kind',
    reason:
      'Its hard hits come back off the spikes, and the shield blunts only one hit in a while.',
  },
  {
    x: 'venom',
    y: 'guardian',
    intended: 'x',
    band: 'kind',
    reason: 'Poison ticks every half second: the first tick breaks the shield, the rest land.',
  },
  {
    x: 'magnet',
    y: 'guardian',
    intended: 'even',
    reason: 'The pull forces a brawl, and the shield blunts one of its heavy hits.',
  },
  {
    x: 'ghost',
    y: 'guardian',
    intended: 'even',
    reason: 'Its hits are few, so the shield is often up; phasing dodges the Guardian’s.',
  },
  {
    x: 'necromancer',
    y: 'guardian',
    intended: 'even',
    reason: 'A skull breaks the shield, and the Necromancer’s light hits do little after it.',
  },
  {
    x: 'chrono',
    y: 'guardian',
    intended: 'even',
    reason: 'The shield blunts one of its heavy hits, and a rewind undoes one of the Guardian’s.',
  },
  {
    x: 'titan',
    y: 'guardian',
    intended: 'even',
    reason: 'The growing body meets it often, and the shield blunts only the first hit.',
  },
  {
    x: 'inferno',
    y: 'guardian',
    intended: 'x',
    band: 'kind',
    reason: 'Burns tick often: the first breaks the shield, and the rest land.',
  },
  // The Bloom.
  {
    x: 'brawler',
    y: 'bloom',
    intended: 'even',
    reason:
      'It regrows a little after each hit, and the Brawler’s hits are big: plain trades decide it.',
  },
  {
    x: 'speedster',
    y: 'bloom',
    intended: 'even',
    reason: 'Its rush lands often, and the Bloom regrows a little between rushes.',
  },
  {
    x: 'frost',
    y: 'bloom',
    intended: 'even',
    reason: 'The slow can’t stop it regrowing, and the Frost’s heavy hits outweigh it.',
  },
  {
    x: 'thorns',
    y: 'bloom',
    intended: 'x',
    band: 'kind',
    reason: 'Its own hits come back off the spikes, and each heavy hit costs more than it regrows.',
  },
  {
    x: 'venom',
    y: 'bloom',
    intended: 'x',
    band: 'kind',
    reason: 'Poison ticks every half second, so it never rests long enough to regrow.',
  },
  {
    x: 'magnet',
    y: 'bloom',
    intended: 'even',
    reason: 'The pull forces heavy hits, and the Bloom regrows between pulls.',
  },
  {
    x: 'ghost',
    y: 'bloom',
    intended: 'even',
    reason: 'Phasing makes its hits few, so the Bloom regrows in the gaps; its hits are heavy.',
  },
  {
    x: 'bloom',
    y: 'necromancer',
    intended: 'x',
    band: 'kind',
    reason: 'Skulls come one at a time, and it regrows between them.',
  },
  {
    x: 'chrono',
    y: 'bloom',
    intended: 'even',
    reason: 'A long, heavy-hitting fight: it regrows between hits, and a rewind undoes one.',
  },
  {
    x: 'titan',
    y: 'bloom',
    intended: 'even',
    reason: 'The growing body hits it often and hard, and it regrows between hits.',
  },
  {
    x: 'inferno',
    y: 'bloom',
    intended: 'even',
    reason: 'A burn resets its rest, but out of the fire it regrows each small burn back.',
  },
  // The new balls with each other.
  {
    x: 'bomber',
    y: 'guardian',
    intended: 'even',
    reason: 'A blast breaks the shield, and the next bomb is a while coming.',
  },
  {
    x: 'bloom',
    y: 'bomber',
    intended: 'x',
    band: 'kind',
    reason: 'Blasts come with gaps between, and it regrows in every gap.',
  },
  {
    x: 'guardian',
    y: 'bloom',
    intended: 'even',
    reason: 'Neither hits often enough to wear the other’s trick down: plain trades decide it.',
  },
];
