// The Sniper's laser: where its locked aim line runs, and how bright it is. Pure, with no canvas,
// so it can be unit tested; drawAimLines in projectiles.ts draws it.
import { CHARGE_TICKS, chargeOf } from '../sim/balls/sniper.ts';
import type { BallState, Vec2 } from '../sim/types.ts';
import { theme } from './theme.ts';

/**
 * How far a ray from `origin` along the unit vector `direction` travels before it leaves the
 * square arena [0, size]². 0 if `origin` is already on or past the wall it points at.
 */
export function distanceToWall(origin: Vec2, direction: Vec2, size: number): number {
  const along = (position: number, step: number): number => {
    if (step > 0) return (size - position) / step;
    if (step < 0) return -position / step;
    return Infinity;
  };
  return Math.max(0, Math.min(along(origin.x, direction.x), along(origin.y, direction.y)));
}

export interface AimLine {
  readonly from: Vec2;
  readonly to: Vec2;
  /** How far through the charge, 0 just locked to 1 on the shot tick. */
  readonly progress: number;
}

/** The laser of a ball with a locked aim: from its edge to the wall. Undefined without one. */
export function aimLineOf(ball: BallState, tick: number, size: number): AimLine | undefined {
  const charge = chargeOf(ball);
  if (charge === undefined || ball.health <= 0) return undefined;
  const { aim } = charge;
  const from = {
    x: ball.position.x + aim.x * ball.radius,
    y: ball.position.y + aim.y * ball.radius,
  };
  const length = distanceToWall(from, aim, size);
  const progress = Math.min(1, Math.max(0, 1 - (charge.fireTick - tick) / CHARGE_TICKS));
  return { from, to: { x: from.x + aim.x * length, y: from.y + aim.y * length }, progress };
}

/** Laser opacity: faint when the aim locks, brightest just before the shot. */
export function laserAlpha(progress: number): number {
  return theme.laserMinAlpha + (theme.laserMaxAlpha - theme.laserMinAlpha) * progress;
}
