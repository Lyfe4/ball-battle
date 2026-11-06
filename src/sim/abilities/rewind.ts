// The `rewind` action (the Chrono, ADR 0034): a ball puts itself back where it was, with the health
// it had then. Plain data in, a new ball state and its event out.
import type { BallState, Vec2 } from '../types.ts';

export interface RewindRequest {
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly health: number;
}

/** A ball rewound: where it left, where it landed, and its health before and after. */
export interface RewoundEvent {
  readonly type: 'rewound';
  readonly tick: number;
  readonly ballId: string;
  readonly from: Vec2;
  readonly to: Vec2;
  readonly healthBefore: number;
  readonly healthAfter: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * `ball` put back at `request`: its position (kept inside the arena), velocity and health (a whole
 * number from 1 to `maxHealth`). Statuses, projectiles and zones are not rewound. Throws for a
 * non-finite value, which only a bug can produce.
 */
export function rewindBall(
  ball: BallState,
  request: RewindRequest,
  maxHealth: number,
  arenaSize: number,
  tick: number,
): { readonly ball: BallState; readonly event: RewoundEvent } {
  const { position, velocity, health } = request;
  const values = [position.x, position.y, velocity.x, velocity.y, health];
  if (!values.every(Number.isFinite)) {
    throw new Error(`"${ball.id}" tried to rewind to a non-finite state`);
  }
  const max = arenaSize - ball.radius;
  const to = { x: clamp(position.x, ball.radius, max), y: clamp(position.y, ball.radius, max) };
  const healthAfter = clamp(Math.round(health), 1, maxHealth);
  return {
    ball: { ...ball, position: to, velocity, health: healthAfter },
    event: {
      type: 'rewound',
      tick,
      ballId: ball.id,
      from: ball.position,
      to,
      healthBefore: ball.health,
      healthAfter,
    },
  };
}
