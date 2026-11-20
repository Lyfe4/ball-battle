// How a floating ball drifts (ADR 0075): its velocity, followed smoothly, so its shadow on the floor
// can trail a touch behind it and its knot swing back as it moves. Smoothed so a bounce off a wall
// swings it round rather than snapping it. Render-only and on effect time (ADR 0007): it freezes
// in a hit-stop. With reduced motion there is none, so nothing moves but the ball itself.
import type { Vec2, WorldState } from '../sim/types.ts';
import { BALL_DESIGNS } from './ball-designs/index.ts';
import { theme } from './theme.ts';

export const STILL: Vec2 = { x: 0, y: 0 };

/** `drift` followed towards `velocity` over `frameMs`: closing theme.driftFollowMs's share each. */
export function followDrift(drift: Vec2, velocity: Vec2, frameMs: number): Vec2 {
  const share = 1 - Math.exp(-Math.max(0, frameMs) / theme.driftFollowMs);
  return {
    x: drift.x + (velocity.x - drift.x) * share,
    y: drift.y + (velocity.y - drift.y) * share,
  };
}

/**
 * Where a floating ball's shadow sits from its centre, in world units: below it, away from the
 * light, and trailing its drift by theme.shadowLagSeconds of it (at most theme.shadowLagMost r).
 * `stretch` (0-1) is how far it has trailed, for the shadow to stretch with speed.
 */
export function shadowOffset(
  radius: number,
  drift: Vec2,
): { x: number; y: number; stretch: number } {
  let x = -drift.x * theme.shadowLagSeconds;
  let y = -drift.y * theme.shadowLagSeconds;
  const trail = Math.hypot(x, y);
  const most = theme.shadowLagMost * radius;
  if (trail > most) {
    x *= most / trail;
    y *= most / trail;
  }
  return {
    x: theme.shadowOffsetX * radius + x,
    y: theme.shadowOffsetY * radius + y,
    stretch: Math.min(trail, most) / most,
  };
}

export interface Drift {
  /** Follows every live floating ball in `world` to `nowMs` (effect time). */
  update(world: WorldState, nowMs: number, reducedMotion: boolean): void;
  /** A ball's drift, world units a second; still for a ball that doesn't float. */
  of(ballId: string): Vec2;
}

export function createDrift(): Drift {
  let drifts = new Map<string, Vec2>();
  let lastMs: number | undefined;
  return {
    update(world, nowMs, reducedMotion) {
      const frameMs = lastMs === undefined ? 0 : nowMs - lastMs;
      lastMs = nowMs;
      const next = new Map<string, Vec2>();
      if (!reducedMotion) {
        for (const ball of world.balls) {
          if (ball.health <= 0 || BALL_DESIGNS.get(ball.definitionId)?.floats !== true) continue;
          const before = drifts.get(ball.id);
          // A ball seen for the first time (a new match) starts already drifting as it moves.
          next.set(
            ball.id,
            before === undefined ? ball.velocity : followDrift(before, ball.velocity, frameMs),
          );
        }
      }
      drifts = next;
    },
    of: (ballId) => drifts.get(ballId) ?? STILL,
  };
}
