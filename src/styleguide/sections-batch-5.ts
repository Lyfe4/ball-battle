// The style guide's tiles for batch 5 (ADR 0043), kept apart so each file stays readable.
// sections.ts lists them in roster order with the rest.
import { CALM_TICKS } from '../sim/balls/bloom.ts';
import type { Tile } from './sections.ts';
import { TICK } from './tick.ts';

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
    'Guardian: a heater shield; a gold ring while its shield is up',
    [
      { label: 'shield up', id: 'guardian', statuses: ['shielded'] },
      { label: 'shield down', id: 'guardian' },
      { label: 'mirror B', id: 'guardian', repeat: true, statuses: ['shielded'] },
      { label: 'defeated', id: 'guardian', defeated: true },
    ],
  ],
  [
    'Bloom: a flower; petals open while it rests and regrows, a bud just after a hit',
    [
      {
        label: 'resting',
        id: 'bloom',
        abilityState: { lastHitTick: TICK - CALM_TICKS, regrown: 0 },
      },
      { label: 'just hit', id: 'bloom', abilityState: { lastHitTick: TICK, regrown: 0 } },
      { label: 'mirror B', id: 'bloom', repeat: true },
      { label: 'defeated', id: 'bloom', defeated: true },
    ],
  ],
];
