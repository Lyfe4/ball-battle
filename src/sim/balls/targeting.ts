import { isAlive } from '../combat.ts';
import type { BallState, Vec2 } from '../types.ts';

/**
 * The live ball closest to `self` (by centre distance), other than itself; undefined if none.
 * Ties go to the earlier ball in the array, so the choice is deterministic.
 */
export function nearestEnemy(
  self: Readonly<{ id: string; position: Vec2 }>,
  balls: readonly BallState[],
): BallState | undefined {
  let nearest: BallState | undefined;
  let nearestDistance = Infinity;
  for (const ball of balls) {
    if (ball.id === self.id || !isAlive(ball)) continue;
    const dx = ball.position.x - self.position.x;
    const dy = ball.position.y - self.position.y;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearest = ball;
      nearestDistance = distance;
    }
  }
  return nearest;
}
