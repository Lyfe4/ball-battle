import { DT } from './constants.ts';
import type { BallState } from './types.ts';
import { vec2 } from './vec2.ts';

interface AxisState {
  readonly position: number;
  readonly velocity: number;
  /** Walls hit along this axis during the move. */
  readonly bounces: number;
}

/**
 * Folds a position that may have travelled past either wall back into [min, max], flipping the
 * velocity once per wall hit. Movement is treated as a straight line that reflects off the walls
 * like light between two mirrors, so the result is exact no matter how far the ball travelled in
 * one tick: a very fast ball bounces several times instead of tunnelling out.
 */
function reflectAxis(position: number, velocity: number, min: number, max: number): AxisState {
  if (position >= min && position <= max) {
    return { position, velocity, bounces: 0 };
  }

  const range = max - min;
  if (range <= 0) {
    // The ball fills this axis exactly; it has nowhere to move.
    return { position: min, velocity: 0, bounces: 0 };
  }

  // Each full `range` travelled past the first wall is one more wall hit.
  const travelled = position - min;
  const bounces =
    travelled > range ? Math.floor(travelled / range) : Math.floor(-travelled / range) + 1;

  // Positions repeat every 2 * range: out to one wall and back from it. `%` is exact in IEEE 754.
  const period = 2 * range;
  let offset = (position - min) % period;
  if (offset < 0) offset += period;

  const onReturnLeg = offset > range;
  const folded = onReturnLeg ? min + (period - offset) : min + offset;
  return {
    position: Math.min(max, Math.max(min, folded)),
    // On the return leg the ball hit an odd number of walls and is now travelling backwards.
    velocity: onReturnLeg ? -velocity : velocity,
    bounces,
  };
}

export interface Movement {
  readonly ball: BallState;
  /** Wall hits this tick, both axes together; a corner hit counts as 2. */
  readonly bounces: number;
}

/** Moves a ball one tick along its velocity, bouncing off the arena walls. */
export function moveBall(ball: BallState, arenaSize: number): Movement {
  const { position, velocity, radius } = ball;
  if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) {
    throw new Error(`Ball "${ball.id}" has a non-finite velocity`);
  }

  const min = radius;
  const max = arenaSize - radius;
  const x = reflectAxis(position.x + velocity.x * DT, velocity.x, min, max);
  const y = reflectAxis(position.y + velocity.y * DT, velocity.y, min, max);

  return {
    ball: {
      ...ball,
      position: vec2(x.position, y.position),
      velocity: vec2(x.velocity, y.velocity),
    },
    bounces: x.bounces + y.bounces,
  };
}
