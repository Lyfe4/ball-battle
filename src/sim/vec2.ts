import type { Vec2 } from './types.ts';

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function scale(v: Vec2, factor: number): Vec2 {
  return { x: v.x * factor, y: v.y * factor };
}

/** Returns `v + direction * distance`. */
export function addScaled(v: Vec2, direction: Vec2, distance: number): Vec2 {
  return { x: v.x + direction.x * distance, y: v.y + direction.y * distance };
}
