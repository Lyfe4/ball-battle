// The style guide's tiles for batches 3 and 4 (ADR 0026, 0034), kept apart so each file stays
// readable. sections.ts lists them in roster order with the rest.
import type { Tile } from './sections.ts';
import { TICK } from './tick.ts';

export const BATCH_THREE_AND_FOUR: readonly (readonly [string, readonly Tile[]])[] = [
  [
    'Magnet: a horseshoe; its tips glow while it pulls (a dashed line runs to its enemy)',
    [
      { label: 'idle', id: 'magnet' },
      {
        label: 'pulling',
        id: 'magnet',
        abilityState: { nextPullTick: TICK + 100, pullUntilTick: TICK + 10 },
      },
      { label: 'mirror B', id: 'magnet', repeat: true },
      { label: 'defeated', id: 'magnet', defeated: true },
    ],
  ],
  [
    'Ghost: a ghost’s face; see-through with a broken outline while faded',
    [
      { label: 'solid', id: 'ghost' },
      {
        label: 'faded',
        id: 'ghost',
        abilityState: { fadedUntil: TICK + 10, nextFadeTick: TICK + 100 },
      },
      { label: 'mirror B', id: 'ghost', repeat: true },
      {
        label: 'faded, mirror B',
        id: 'ghost',
        repeat: true,
        abilityState: { fadedUntil: TICK + 10, nextFadeTick: TICK + 100 },
      },
    ],
  ],
  [
    'Necromancer: a hood with glowing eyes; its minions are skulls ringed in its colour',
    [
      { label: 'idle', id: 'necromancer' },
      { label: 'hit flash', id: 'necromancer', flash: 0.6 },
      { label: 'mirror B', id: 'necromancer', repeat: true },
      { label: 'defeated', id: 'necromancer', defeated: true },
    ],
  ],
  [
    'Chrono: a clock face whose minute hand sweeps; stopped and faded once its rewind is spent',
    [
      { label: 'running', id: 'chrono' },
      { label: 'recharging', id: 'chrono', abilityState: { history: [], readyTick: TICK + 100 } },
      { label: 'mirror B', id: 'chrono', repeat: true },
      { label: 'defeated', id: 'chrono', defeated: true },
    ],
  ],
  [
    'Titan: a helm with a visor and crest; it grows over the match (shown at one size here)',
    [
      { label: 'idle', id: 'titan' },
      { label: 'hit flash', id: 'titan', flash: 0.6 },
      { label: 'mirror B', id: 'titan', repeat: true },
      { label: 'defeated', id: 'titan', defeated: true },
    ],
  ],
  [
    'Inferno: a flame with a pale heart; its patches burn under the balls (see the phone arena)',
    [
      { label: 'idle', id: 'inferno' },
      { label: 'hit flash', id: 'inferno', flash: 0.6 },
      { label: 'mirror B', id: 'inferno', repeat: true },
      { label: 'defeated', id: 'inferno', defeated: true },
    ],
  ],
];
