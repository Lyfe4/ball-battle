import { isAlive } from './combat.ts';
import type { Movement } from './movement.ts';
import { nextRange, type RngState } from './rng.ts';
import type { BallState, Vec2 } from './types.ts';

/** Largest random turn applied to a ball's velocity when it bounces off a wall (ADR 0004). */
export const BOUNCE_MAX_ANGLE_DEGREES = 8;

/**
 * tan(BOUNCE_MAX_ANGLE_DEGREES / 2), precomputed because Math.tan is not allowed in the sim
 * (ADR 0001). A test checks it against Math.tan.
 */
export const BOUNCE_MAX_HALF_TAN = 0.06992681194351041;

/**
 * Rotates `v` by the angle 2·atan(t), using the rational parametrisation of the circle:
 * cos = (1 − t²)/(1 + t²), sin = 2t/(1 + t²). Only + − * /, so it is exact on every engine and
 * keeps the speed to within rounding.
 */
export function rotateByHalfTan(v: Vec2, t: number): Vec2 {
  const tSquared = t * t;
  const denominator = 1 + tSquared;
  const cos = (1 - tSquared) / denominator;
  const sin = (2 * t) / denominator;
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** True if `rotated` still moves away from every wall bounced off along the given axes. */
function keepsAwayFromWalls(
  reflected: Vec2,
  rotated: Vec2,
  bouncedX: boolean,
  bouncedY: boolean,
): boolean {
  return (
    (!bouncedX || Math.sign(rotated.x) === Math.sign(reflected.x)) &&
    (!bouncedY || Math.sign(rotated.y) === Math.sign(reflected.y))
  );
}

/**
 * The reflected velocity turned by 2·atan(t), mirrored to −t if that would point back into a wall
 * it just bounced off. A turn can only flip an axis whose component is smaller than |v|·sin of the
 * angle, and both components can't be that small at once, so one of ±t always works for a moving
 * ball. The unturned fallback is only a guard for a zero velocity.
 */
export function turnBounce(reflected: Vec2, t: number, bouncedX: boolean, bouncedY: boolean): Vec2 {
  for (const candidate of [t, -t]) {
    const rotated = rotateByHalfTan(reflected, candidate);
    if (keepsAwayFromWalls(reflected, rotated, bouncedX, bouncedY)) return rotated;
  }
  return reflected;
}

export interface VarianceResult {
  readonly balls: readonly BallState[];
  readonly rngState: RngState;
}

/**
 * Gives every live ball that bounced this tick a small random turn, drawn from the world RNG: one
 * draw per bouncing ball, in ball order, however many walls it hit. Positions never change, so
 * balls stay inside the arena.
 */
export function applyBounceVariance(
  movements: readonly Movement[],
  rngState: RngState,
): VarianceResult {
  let state = rngState;
  const balls = movements.map(({ ball, bounces, bouncesX, bouncesY }) => {
    if (bounces === 0 || !isAlive(ball)) return ball;
    const draw = nextRange(state, -BOUNCE_MAX_HALF_TAN, BOUNCE_MAX_HALF_TAN);
    state = draw.state;
    const turned = turnBounce(ball.velocity, draw.value, bouncesX > 0, bouncesY > 0);
    return { ...ball, velocity: offNormal(ball.velocity, turned, bouncesX > 0, bouncesY > 0) };
  });
  return { balls, rngState: state };
}

/** sin 10�: a bounce leaves at least this far off the wall's normal (prototype A). */
export const MIN_OFF_NORMAL_SIN = 0.17364817766693033;

/**
 * Prototype A: after a single-wall bounce, the component along the wall keeps the sign it had
 * before the turn (so the ball never reverses sideways without touching a side wall) and is at
 * least MIN_OFF_NORMAL_SIN of the speed (no near-perpendicular lanes). Speed is kept.
 */
export function offNormal(reflected: Vec2, turned: Vec2, bouncedX: boolean, bouncedY: boolean): Vec2 {
  if (bouncedX === bouncedY) return turned;
  const speed = Math.sqrt(turned.x * turned.x + turned.y * turned.y);
  if (speed === 0) return turned;
  const along = bouncedY ? 'x' : 'y';
  const across = bouncedY ? 'y' : 'x';
  const sign = reflected[along] !== 0 ? Math.sign(reflected[along]) : Math.sign(turned[along]) || 1;
  const minAlong = MIN_OFF_NORMAL_SIN * speed;
  const alongValue = sign * Math.max(minAlong, Math.abs(turned[along]) * (Math.sign(turned[along]) === sign ? 1 : 0));
  const value = Math.abs(alongValue) >= minAlong ? alongValue : sign * minAlong;
  const acrossValue = Math.sign(turned[across]) * Math.sqrt(Math.max(0, speed * speed - value * value));
  return (along === 'x' ? { x: value, y: acrossValue } : { x: acrossValue, y: value }) as Vec2;
}
