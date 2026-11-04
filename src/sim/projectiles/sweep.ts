import type { Vec2 } from '../types.ts';

const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/**
 * Swept circle test on relative motion. A point starts at offset `start` from a circle's centre
 * and moves by `travel` (both relative to the circle) over one tick; returns the earliest fraction
 * of the tick, in [0, 1], at which it comes within `reach` of the centre, or undefined if it never
 * does. Solves |start + s·travel|² = reach² with only + − * / and Math.sqrt (ADR 0001).
 */
export function sweepHitTime(start: Vec2, travel: Vec2, reach: number): number | undefined {
  const c = dot(start, start) - reach * reach;
  // Already touching at the start of the tick.
  if (c <= 0) return 0;
  const a = dot(travel, travel);
  const halfB = dot(start, travel);
  // Not moving relative to the circle, or moving away from it.
  if (a === 0 || halfB >= 0) return undefined;
  const discriminant = halfB * halfB - a * c;
  if (discriminant < 0) return undefined;
  const s = (-halfB - Math.sqrt(discriminant)) / a;
  return s <= 1 ? s : undefined;
}

/**
 * Earliest fraction of the tick, in [0, 1], at which a circle of radius `radius` starting at
 * `start` and moving by `travel` touches a wall of a `size` × `size` arena, or undefined.
 */
export function wallHitTime(
  start: Vec2,
  travel: Vec2,
  radius: number,
  size: number,
): number | undefined {
  const axis = (position: number, delta: number): number | undefined => {
    if (delta > 0) return (size - radius - position) / delta;
    if (delta < 0) return (radius - position) / delta;
    return undefined;
  };
  let earliest: number | undefined;
  for (const s of [axis(start.x, travel.x), axis(start.y, travel.y)]) {
    if (s !== undefined && s <= 1 && (earliest === undefined || s < earliest)) {
      earliest = Math.max(0, s);
    }
  }
  return earliest;
}
