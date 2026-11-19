// The style guide's tiles for batch 5 (ADR 0043, 0045), kept apart so each file stays readable.
// sections.ts lists them in roster order with the rest.
import { PAUSE_TICKS } from '../sim/balls/bloom.ts';
import { DROP_TICKS } from '../sim/balls/bomber.ts';
import type { Tile } from './sections.ts';
import { TICK } from './tick.ts';

export const BATCH_FIVE: readonly (readonly [string, readonly Tile[]])[] = [
  [
    'Boomerang: the bent bar it holds; only a faint shape while its boomerang is in the air (see the phone arena) (ADR 0071)',
    [
      { label: 'idle', id: 'boomerang' },
      { label: 'hit flash', id: 'boomerang', flash: 0.6 },
      { label: 'mirror B', id: 'boomerang', repeat: true },
      { label: 'defeated', id: 'boomerang', defeated: true },
    ],
  ],
  [
    'Bomber: a bomb whose stick fuse burns down to its next drop, the spark creeping to the bomb, whole again after each drop; its bombs lie under the balls (see the phone arena) (ADR 0072)',
    [
      { label: 'just dropped', id: 'bomber', abilityState: { nextDropTick: TICK + DROP_TICKS } },
      {
        label: 'half burnt',
        id: 'bomber',
        abilityState: { nextDropTick: TICK + DROP_TICKS / 2 },
      },
      { label: 'about to drop', id: 'bomber', abilityState: { nextDropTick: TICK + 12 } },
      { label: 'hit flash', id: 'bomber', flash: 0.6 },
      { label: 'mirror B', id: 'bomber', repeat: true },
      { label: 'defeated', id: 'bomber', defeated: true },
    ],
  ],
  [
    'Spartan: a bronze crested helmet in profile on crimson, looking at the enemy, its cream crest past the edge; while planted, a thick rimmed bronze arc on the side facing the enemy, clear of the helmet, gone once the spear is thrown (open). The spear shows only in flight, and a hit on the planted shield glances off in a broken gold ring (see the phone arena)',
    [
      { label: 'shield planted', id: 'spartan', abilityState: { phase: 0, raised: true } },
      { label: 'open', id: 'spartan', abilityState: { phase: 0, raised: false } },
      { label: 'hit flash', id: 'spartan', flash: 0.6, abilityState: { phase: 0, raised: true } },
      { label: 'mirror B', id: 'spartan', repeat: true, abilityState: { phase: 0, raised: true } },
      { label: 'defeated', id: 'spartan', defeated: true },
    ],
  ],
  [
    'Bloom: a flower. Left alone it opens and regrows (each regrowth a heal pulse); any hit closes it into a bud, which stays shut through its whole wait and opens over the last part of it',
    [
      { label: 'open (regrowing)', id: 'bloom', heal: 0.6, healShare: 0.02 },
      {
        label: 'just hit (bud)',
        id: 'bloom',
        abilityState: { nextHealTick: TICK + PAUSE_TICKS, pausedUntil: TICK + PAUSE_TICKS },
      },
      {
        label: 'opening',
        id: 'bloom',
        abilityState: { nextHealTick: TICK + 10, pausedUntil: TICK + 10 },
      },
      { label: 'mirror B', id: 'bloom', repeat: true },
      { label: 'defeated', id: 'bloom', defeated: true },
    ],
  ],
];
