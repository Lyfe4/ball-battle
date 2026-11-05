// Drawing between ticks. The sim runs at 60 ticks a second, but displays refresh at 90, 120 or
// 144 Hz, so without this some frames repeat a position and others skip ahead (judder). The
// renderer draws a world blended between the last two ticks instead. Pure and render-only: it
// builds a new world for drawing and never changes the sim's (ADR 0001 rule 4).
import { DT } from '../sim/constants.ts';
import type { BallState, Vec2, WorldState } from '../sim/types.ts';

function lerp(from: Vec2, to: Vec2, alpha: number): Vec2 {
  return { x: from.x + (to.x - from.x) * alpha, y: from.y + (to.y - from.y) * alpha };
}

/**
 * The world as it looks `alpha` (0 to 1) of the way from `previous` to `current`. Only positions
 * move: everything else (health, statuses, zones, the tick) is `current`'s, so what is drawn is
 * never ahead of the sim.
 *
 * - A ball moves along the straight line between its two positions. Over a wall bounce that
 *   cuts the corner by a fraction of a tick, and both ends are inside the arena, so the line is.
 * - Projectiles and minions move the same way (everything that moves is blended, or it steps
 *   once a tick while the balls glide: on a 120 Hz phone it would stand still every other frame).
 *   One that appeared this tick has no previous position, so it is traced back along its velocity
 *   to where it was launched from. Over a minion's wall bounce the line cuts the corner, as a
 *   ball's does.
 * - A projectile or minion gone this tick (hit, wall or lifetime) is not drawn: its hit shows as a
 *   spark.
 */
export function interpolateWorld(
  previous: WorldState,
  current: WorldState,
  alpha: number,
): WorldState {
  const t = Math.min(1, Math.max(0, alpha));
  if (previous === current || t === 1) return current;

  const ballsBefore = new Map(previous.balls.map((ball) => [ball.id, ball]));
  const balls = current.balls.map((ball): BallState => {
    const before = ballsBefore.get(ball.id);
    return before === undefined
      ? ball
      : { ...ball, position: lerp(before.position, ball.position, t) };
  });

  const projectiles = blendMovers(previous.projectiles, current.projectiles, t);
  const minions = blendMovers(previous.minions, current.minions, t);

  return { ...current, balls, projectiles, minions };
}

/** Projectiles or minions `t` of the way from their previous positions to their current ones. */
function blendMovers<
  T extends { readonly id: string; readonly position: Vec2; readonly velocity: Vec2 },
>(previous: readonly T[], current: readonly T[], t: number): T[] {
  const before = new Map(previous.map((mover) => [mover.id, mover.position]));
  return current.map((mover) => {
    const from = before.get(mover.id) ?? {
      x: mover.position.x - mover.velocity.x * DT,
      y: mover.position.y - mover.velocity.y * DT,
    };
    return { ...mover, position: lerp(from, mover.position, t) };
  });
}
