// The style guide's tiles for the Balloon, the Banshee and the Kraken (ADR 0075), in each state their
// look shows. sections.ts lists them in roster order with the rest; the Balloon's shadow, the
// Banshee's ring and the Kraken's ripples and tentacles show in the phone arena.
import { WAIL_EVERY_TICKS } from '../sim/balls/banshee.ts';
import { GRAB_EVERY_TICKS, HOLD_TICKS } from '../sim/balls/kraken.ts';
import type { AbilityState, BallState } from '../sim/types.ts';
import type { Tile } from './sections.ts';
import { TICK } from './tick.ts';

/** A Banshee whose next wail is this many ticks away (negative: it wailed that long ago). */
const wail = (inTicks: number): AbilityState => ({
  nextWailTick: inTicks >= 0 ? TICK + inTicks : TICK + inTicks + WAIL_EVERY_TICKS,
});

/** A Kraken holding nothing, its next call `share` of the way through its wait. */
const kraken = (share: number): AbilityState => ({
  nextGrabTick: TICK + Math.round((1 - share) * GRAB_EVERY_TICKS),
  burstTick: -1,
  spots: [],
  holds: {},
});

export const BATCH_SEVEN: readonly (readonly [string, readonly Tile[]])[] = [
  [
    'Balloon: a glossy coral balloon with its knot, and the only shadow on the floor (see the phone arena); area hits glance off it and shots pop into it',
    [
      { label: 'idle', id: 'balloon' },
      { label: 'hit flash', id: 'balloon', flash: 0.6 },
      { label: 'mirror B', id: 'balloon', repeat: true },
      { label: 'defeated', id: 'balloon', defeated: true },
    ],
  ],
  [
    'Banshee: a pale face whose mouth follows its wail: a slit while it waits, opening as it draws breath, gaping on the wail; the breath glows round it and the wail rings out on the floor (see the phone arena)',
    [
      { label: 'waiting', id: 'banshee', abilityState: wail(100) },
      { label: 'drawing breath', id: 'banshee', abilityState: wail(12) },
      { label: 'wailing', id: 'banshee', abilityState: wail(-3) },
      { label: 'hit flash', id: 'banshee', flash: 0.6 },
      { label: 'mirror B', id: 'banshee', repeat: true },
      { label: 'defeated', id: 'banshee', defeated: true },
    ],
  ],
  [
    'Kraken: two eyes and a tentacle up each side, rising as its next call nears and gone from the ball while they are out: ripples on the floor, then tentacles wrapped round the ball it holds (see the phone arena)',
    [
      { label: 'just back', id: 'kraken', abilityState: kraken(0.05) },
      { label: 'rising', id: 'kraken', abilityState: kraken(0.5) },
      { label: 'ready', id: 'kraken', abilityState: kraken(1) },
      {
        label: 'out',
        id: 'kraken',
        abilityState: {
          nextGrabTick: TICK + GRAB_EVERY_TICKS - 20,
          burstTick: -1,
          spots: [],
          holds: { other: TICK + HOLD_TICKS - 20 },
        },
      },
      { label: 'hit flash', id: 'kraken', flash: 0.6 },
      { label: 'mirror B', id: 'kraken', repeat: true },
      { label: 'defeated', id: 'kraken', defeated: true },
    ],
  ],
];

/**
 * The three in the phone arena: the Banshee mid-wail (its ring sweeping out), and the Kraken holding
 * the ball before it in the grid half-way to the crush.
 */
export function batchSevenState(ball: BallState, balls: readonly BallState[]): BallState {
  if (ball.definitionId === 'banshee') return { ...ball, abilityState: wail(-6) };
  if (ball.definitionId !== 'kraken') return ball;
  const held = balls[balls.indexOf(ball) - 1];
  if (held === undefined) return ball;
  return {
    ...ball,
    abilityState: {
      nextGrabTick: TICK + GRAB_EVERY_TICKS - HOLD_TICKS / 2,
      burstTick: -1,
      spots: [],
      holds: { [held.id]: TICK + HOLD_TICKS / 2 },
    },
  };
}
