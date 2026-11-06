import { isAlive } from './combat.ts';
import { getDefinition } from './definitions.ts';
import type { BallState, DefinitionLookup } from './types.ts';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Sets every live ball that declares `radiusOf` to its radius for `tick`, and moves it back inside
 * the arena if it grew into a wall (ADR 0034). An overlap with another ball is left to the next
 * tick's collision pass, which separates it like any other. Throws for a radius that isn't a
 * positive number fitting the arena, which only a bug can produce. Pure: returns new states only
 * for balls whose size changed.
 */
export function applySize(
  balls: readonly BallState[],
  definitions: DefinitionLookup,
  tick: number,
  arenaSize: number,
): readonly BallState[] {
  return balls.map((ball) => {
    if (!isAlive(ball)) return ball;
    const radiusOf = getDefinition(definitions, ball.definitionId).radiusOf;
    if (radiusOf === undefined) return ball;
    const radius = radiusOf(ball, tick);
    if (!Number.isFinite(radius) || radius <= 0 || radius * 2 > arenaSize) {
      throw new Error(`Ball "${ball.id}" has an invalid radius (${String(radius)})`);
    }
    if (radius === ball.radius) return ball;
    const max = arenaSize - radius;
    const { x, y } = ball.position;
    return { ...ball, radius, position: { x: clamp(x, radius, max), y: clamp(y, radius, max) } };
  });
}
