import { isAlive } from '../combat.ts';
import type { MinionState } from '../minions/types.ts';
import type { BallState, Vec2 } from '../types.ts';

/**
 * The live ball closest to `self` (by centre distance), other than itself; undefined if none.
 * Ties go to the earlier ball in the array, so the choice is deterministic. For abilities that act
 * on a ball (the Magnet's pull); aimed attacks use `nearestTarget`.
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

/** What an aimed attack aims at: an enemy ball or an enemy minion. */
export interface Target {
  readonly kind: 'ball' | 'minion';
  readonly id: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
}

/**
 * The target an aimed attack picks (ADR 0026): the nearest live enemy ball or enemy minion,
 * whichever is closer. One rule for every ball that aims (the Archer, Storm and Sniper), so a
 * minion nearer than its owner draws the arrow, the lightning or the shot. Ties go to the ball,
 * then to the earlier one in its array, so the choice is deterministic.
 */
export function nearestTarget(
  self: Readonly<{ id: string; position: Vec2 }>,
  balls: readonly BallState[],
  minions: readonly MinionState[] = [],
): Target | undefined {
  const ball = nearestEnemy(self, balls);
  let nearest: Target | undefined =
    ball === undefined ? undefined : { kind: 'ball', ...pick(ball) };
  let nearestDistance =
    ball === undefined ? Infinity : distanceSquared(self.position, ball.position);
  for (const minion of minions) {
    if (minion.ownerId === self.id) continue;
    const distance = distanceSquared(self.position, minion.position);
    if (distance < nearestDistance) {
      nearest = { kind: 'minion', ...pick(minion) };
      nearestDistance = distance;
    }
  }
  return nearest;
}

function pick({
  id,
  position,
  velocity,
}: Readonly<{ id: string; position: Vec2; velocity: Vec2 }>) {
  return { id, position, velocity };
}

function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}
