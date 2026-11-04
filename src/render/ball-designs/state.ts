// Pure helpers that turn ability state into design state. No canvas, so they are unit tested.
import { nearestEnemy } from '../../sim/balls/targeting.ts';
import type { BallState, Vec2 } from '../../sim/types.ts';
import { theme } from '../theme.ts';

/** How far a cooldown that ends on `nextTick` has recharged by `tick`, from 0 to 1. */
export function chargeFraction(nextTick: number, tick: number, cooldown: number): number {
  if (cooldown <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - (nextTick - tick) / cooldown));
}

/** Speedster streaks: one per stack, never negative or fractional. */
export function streakCount(stacks: number): number {
  return Math.max(0, Math.floor(stacks));
}

/**
 * Brightness of the Storm's bolt, 0 to 1: rises with the charge, then flickers in the last stretch
 * before a strike, stepped by sim tick so a replay flickers the same way.
 */
export function stormFlicker(fraction: number, tick: number): number {
  const level = theme.stormBoltMinAlpha + (1 - theme.stormBoltMinAlpha) * fraction;
  if (fraction < theme.stormFlickerFrom || fraction >= 1) return level;
  const dim = Math.floor(tick / theme.stormFlickerTicks) % 2 === 1;
  return dim ? level * theme.stormFlickerDim : level;
}

/** Unit vector of a velocity, or undefined when the ball is not moving. */
export function velocityHeading(velocity: Vec2): Vec2 | undefined {
  const length = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  return length === 0 ? undefined : { x: velocity.x / length, y: velocity.y / length };
}

/** Unit vector towards the nearest live enemy, or undefined if there is none (or it overlaps). */
export function aimHeading(self: BallState, balls: readonly BallState[]): Vec2 | undefined {
  const target = nearestEnemy(self, balls);
  if (target === undefined) return undefined;
  return velocityHeading({
    x: target.position.x - self.position.x,
    y: target.position.y - self.position.y,
  });
}
