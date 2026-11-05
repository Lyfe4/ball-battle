// Steering another ball (ADR 0026): an ability can turn an enemy's heading toward a point without
// changing how fast it goes. Cruise speed (ADR 0008) rescales every ball at the end of the tick
// anyway, and keeping the magnitude here means a steered ball never moves faster for one tick.
import type { Vec2 } from './types.ts';

/**
 * `velocity` turned toward `toward` (a point) from `position`: the unit heading plus `share` of the
 * unit direction to the point, renormalised to the original speed. `share` 0 leaves it alone, 1
 * turns it halfway between its heading and the point (or straight at it if it was heading away).
 * Only + − * / and Math.sqrt (ADR 0001). A ball standing still, or already on the point, is left
 * as it is.
 */
export function steerToward(position: Vec2, velocity: Vec2, toward: Vec2, share: number): Vec2 {
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  const dx = toward.x - position.x;
  const dy = toward.y - position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (speed === 0 || distance === 0 || share === 0) return velocity;
  const x = velocity.x / speed + (dx / distance) * share;
  const y = velocity.y / speed + (dy / distance) * share;
  const length = Math.sqrt(x * x + y * y);
  // Pointing exactly away with share 1: the blend cancels; head straight for the point.
  if (length === 0) return { x: (dx / distance) * speed, y: (dy / distance) * speed };
  return { x: (x / length) * speed, y: (y / length) * speed };
}

/** Throws unless `share` is a finite number from 0 to 1; only a bug can produce another. */
export function assertSteerShare(share: number, ownerId: string): void {
  if (!Number.isFinite(share) || share < 0 || share > 1) {
    throw new Error(`An ability of "${ownerId}" tried to steer with an invalid share ${share}`);
  }
}
