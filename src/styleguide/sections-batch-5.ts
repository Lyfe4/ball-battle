// The style guide's tiles for batch 5 (ADR 0043, 0045), kept apart so each file stays readable.
// sections.ts lists them in roster order with the rest.
import type { Tile } from './sections.ts';

export const BATCH_FIVE: readonly (readonly [string, readonly Tile[]])[] = [
  [
    'Boomerang: a bent bar; its boomerang spins in flight (see the phone arena)',
    [
      { label: 'idle', id: 'boomerang' },
      { label: 'hit flash', id: 'boomerang', flash: 0.6 },
      { label: 'mirror B', id: 'boomerang', repeat: true },
      { label: 'defeated', id: 'boomerang', defeated: true },
    ],
  ],
  [
    'Bomber: a bomb with a flickering fuse; its bombs lie under the balls (see the phone arena)',
    [
      { label: 'idle', id: 'bomber' },
      { label: 'hit flash', id: 'bomber', flash: 0.6 },
      { label: 'mirror B', id: 'bomber', repeat: true },
      { label: 'defeated', id: 'bomber', defeated: true },
    ],
  ],
  [
    'Guardian: a heater shield; a hit on its armor glances off in a broken gold ring (see the phone arena)',
    [
      { label: 'idle', id: 'guardian' },
      { label: 'hit flash', id: 'guardian', flash: 0.6 },
      { label: 'mirror B', id: 'guardian', repeat: true },
      { label: 'defeated', id: 'guardian', defeated: true },
    ],
  ],
  [
    'Bloom: a flower, always open; every regrowth is a heal pulse',
    [
      { label: 'idle', id: 'bloom' },
      { label: 'regrowing', id: 'bloom', heal: 0.6, healShare: 0.05 },
      { label: 'mirror B', id: 'bloom', repeat: true },
      { label: 'defeated', id: 'bloom', defeated: true },
    ],
  ],
];
