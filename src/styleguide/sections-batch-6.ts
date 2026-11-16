// The style guide's tiles for the Hex and the Spider (ADR 0049) and the Battery (ADR 0056), kept
// apart so each file stays readable. sections.ts lists them in roster order with the rest; the
// curse and the webs show in the phone arena.
import type { Tile } from './sections.ts';

export const BATCH_SIX: readonly (readonly [string, readonly Tile[]])[] = [
  [
    'Hex: a hexagon sigil with an open eye; the ball it curses wears the hexagon on a dark badge at its lower edge, with a ring that empties as the burst comes and flickers at the end (see the phone arena)',
    [
      { label: 'idle', id: 'hex' },
      { label: 'hit flash', id: 'hex', flash: 0.6 },
      { label: 'mirror B', id: 'hex', repeat: true },
      { label: 'defeated', id: 'hex', defeated: true },
    ],
  ],
  [
    'Spider: a dark spider seen from above on silver, facing its travel; its webs are pale silk fans on the walls, under the balls (see the phone arena)',
    [
      { label: 'idle', id: 'spider' },
      { label: 'hit flash', id: 'spider', flash: 0.6 },
      { label: 'mirror B', id: 'spider', repeat: true },
      { label: 'defeated', id: 'spider', defeated: true },
    ],
  ],
  [
    'Battery: a dark battery seen side on, on electric blue, with four cells that light from the bottom as it stores big hits; its next bump empties them (at phone size the cells merge into one gauge)',
    [
      { label: 'empty', id: 'battery' },
      { label: 'storing (10)', id: 'battery', abilityState: { stored: 10 } },
      { label: 'charged (25)', id: 'battery', abilityState: { stored: 25 } },
      { label: 'full (40)', id: 'battery', abilityState: { stored: 40 } },
      { label: 'hit flash', id: 'battery', flash: 0.6 },
      { label: 'mirror B', id: 'battery', repeat: true },
      { label: 'defeated', id: 'battery', defeated: true },
    ],
  ],
];
