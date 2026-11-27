// The style guide's tiles for the Hunter and the Tortoise (ADR 0091), in each state their look
// shows. sections.ts lists them with the rest; a snare on the floor and a ball a snare holds show in
// the phone arena.
import {
  SNARE_ARM_TICKS,
  SNARE_HOLD_RADIUS,
  SNARE_HOLD_TICKS,
  SNARE_RADIUS,
  SNARE_TICKS,
} from '../sim/balls/hunter.ts';
import type { BallState, ZoneState } from '../sim/types.ts';
import type { Tile } from './sections.ts';
import { TICK } from './tick.ts';

export const BATCH_NINE: readonly (readonly [string, readonly Tile[]])[] = [
  [
    'Hunter: a hunter under a wolf pelt: the wolf’s head worn as a hood down low (ears up past its edge, slanted amber eyes, a paler muzzle and upper fangs over the brow, ragged fur down its sides), the hunter’s face in shadow under it with only two eyes glinting, a scarf in its leather over the mouth. No state on the ball (the owner waives ADR 0071 for it): its snares on the floor (the same trap, faint until armed) and the trap clamped on a caught ball show its ability (see the phone arena)',
    [
      { label: 'hunting', id: 'hunter' },
      { label: 'hit flash', id: 'hunter', flash: 0.6 },
      { label: 'mirror B', id: 'hunter', repeat: true },
      { label: 'defeated', id: 'hunter', defeated: true },
    ],
  ],
  [
    'Tortoise: a shell of plates (a lighter centre plate, seams out to the rim) with its head and four feet peeking out while it moves; when its shell cuts a hit they duck in as the glance ring flashes, and they stay in while it is held',
    [
      { label: 'moving', id: 'tortoise' },
      { label: 'ducking', id: 'tortoise', glance: 0.5 },
      { label: 'just hit', id: 'tortoise', glance: 1 },
      { label: 'held', id: 'tortoise', statuses: ['held'] },
      { label: 'hit flash', id: 'tortoise', flash: 0.6 },
      { label: 'mirror B', id: 'tortoise', repeat: true },
      { label: 'defeated', id: 'tortoise', defeated: true },
    ],
  ],
];

/**
 * In the phone arena: the ball before the Hunter in the grid caught by one of its snares a moment
 * ago (the trap clamped round it).
 */
export function batchNineState(ball: BallState, balls: readonly BallState[]): BallState {
  const next = balls[balls.indexOf(ball) + 1];
  if (next?.definitionId !== 'hunter') return ball;
  const status = {
    kind: 'held' as const,
    sourceId: next.id,
    expiresTick: TICK + SNARE_HOLD_TICKS - 10,
    sinceTick: TICK - 10,
  };
  return { ...ball, statuses: [...ball.statuses, status] };
}

/** A snare the Hunter laid a moment ago, armed, on the floor below it. */
export function batchNineZones(balls: readonly BallState[]): readonly ZoneState[] {
  const hunter = balls.find((ball) => ball.definitionId === 'hunter');
  if (hunter === undefined) return [];
  return [
    {
      id: 'zone-9',
      ownerId: hunter.id,
      position: { x: hunter.position.x - 125, y: hunter.position.y },
      radius: SNARE_HOLD_RADIUS,
      damage: 0,
      spawnTick: TICK - 60,
      strikeTick: TICK - 60 + SNARE_TICKS,
      status: { kind: 'held', durationTicks: SNARE_HOLD_TICKS },
      trigger: { radius: SNARE_RADIUS, armTick: TICK - 60 + SNARE_ARM_TICKS },
    },
  ];
}
