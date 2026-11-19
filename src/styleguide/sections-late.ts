// The style guide's tiles for batches 3 and 4 (ADR 0026, 0034), kept apart so each file stays
// readable. sections.ts lists them in roster order with the rest.
import { SUMMON_TICKS } from '../sim/balls/necromancer.ts';
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
    'Ghost: a ghost’s face; for one second in four it phases, drawn see-through with a broken outline (a hit on it then glances off)',
    [
      { label: 'solid', id: 'ghost' },
      { label: 'phased', id: 'ghost', abilityState: { phase: 0, phased: true } },
      { label: 'mirror B', id: 'ghost', repeat: true },
      {
        label: 'phased, mirror B',
        id: 'ghost',
        repeat: true,
        abilityState: { phase: 0, phased: true },
      },
    ],
  ],
  [
    'Necromancer: a hood with glowing eyes; while no skull is out, the next forms in the hood as its summon nears; while one is out (a skull ringed in its colour) the hood is empty and the eyes dim (ADR 0072)',
    [
      {
        label: 'skull forming',
        id: 'necromancer',
        abilityState: { nextSummonTick: TICK + Math.round(SUMMON_TICKS / 2) },
      },
      { label: 'skull ready', id: 'necromancer', abilityState: { nextSummonTick: TICK + 2 } },
      { label: 'skull out', id: 'necromancer', minionOut: true },
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
    'Titan: an ancient stone colossus, its brow heavier as it grows; the same parts at every size, drawn here at one size (ADR 0071)',
    [
      { label: 'start', id: 'titan' },
      { label: 'half grown', id: 'titan', radius: 70 },
      { label: 'full grown', id: 'titan', radius: 90 },
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
