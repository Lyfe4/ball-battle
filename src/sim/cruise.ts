import { isAlive } from './combat.ts';
import { getDefinition } from './definitions.ts';
import type { BallDefinition, BallState, DefinitionLookup } from './types.ts';
import { scale } from './vec2.ts';

/**
 * The speed a ball travels at in its current ability state: its definition's `cruiseSpeed` if it
 * declares one, otherwise its definition speed. Throws for a non-finite or non-positive speed,
 * which only a bug can produce.
 */
export function cruiseSpeedOf(ball: BallState, definition: BallDefinition): number {
  const speed = definition.cruiseSpeed?.(ball.abilityState, definition) ?? definition.speed;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`Ball "${ball.id}" has an invalid cruise speed (${String(speed)})`);
  }
  return speed;
}

/**
 * Rescales every live ball's velocity to its cruise speed, keeping its direction (ADR 0008).
 * Collisions change where a ball is heading, never how fast it goes. A ball with zero velocity has
 * no direction and is left as it is; defeated balls are left alone. Pure: returns new states only
 * for balls whose velocity changed.
 */
export function applyCruiseSpeed(
  balls: readonly BallState[],
  definitions: DefinitionLookup,
): readonly BallState[] {
  return balls.map((ball) => {
    if (!isAlive(ball)) return ball;
    const { x, y } = ball.velocity;
    const current = Math.sqrt(x * x + y * y);
    if (current === 0) return ball;
    const target = cruiseSpeedOf(ball, getDefinition(definitions, ball.definitionId));
    if (current === target) return ball;
    return { ...ball, velocity: scale(ball.velocity, target / current) };
  });
}
