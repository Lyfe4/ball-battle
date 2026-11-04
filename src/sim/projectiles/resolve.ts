import { dealAbilityDamage } from '../abilities/apply-actions.ts';
import { isAlive } from '../combat.ts';
import { DT } from '../constants.ts';
import type { BallState, DefinitionLookup, ProjectileState, SimEvent, Vec2 } from '../types.ts';
import { addScaled, scale } from '../vec2.ts';
import { sweepHitTime, wallHitTime } from './sweep.ts';

export interface ProjectileResult {
  readonly balls: readonly BallState[];
  readonly projectiles: readonly ProjectileState[];
  readonly events: readonly SimEvent[];
}

const subtract = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

/**
 * Moves every projectile one tick and resolves what it touches (ADR 0005). Each projectile's path
 * is swept against each live enemy ball's motion over the tick (from `startPositions` to where the
 * ball is now). The nearest hit along the path wins if it comes before the wall; otherwise a wall
 * or an exhausted lifetime removes it. Projectiles resolve in creation order and each hit is
 * applied before the next is checked, so a ball brought to 0 health by one projectile is passed
 * through by the rest.
 */
export function resolveProjectiles(
  projectiles: readonly ProjectileState[],
  balls: readonly BallState[],
  startPositions: ReadonlyMap<string, Vec2>,
  definitions: DefinitionLookup,
  arenaSize: number,
  tick: number,
): ProjectileResult {
  let current = balls;
  const remaining: ProjectileState[] = [];
  const events: SimEvent[] = [];

  for (const projectile of projectiles) {
    const travel = scale(projectile.velocity, DT);
    let nearest: { readonly s: number; readonly ball: BallState } | undefined;
    for (const ball of current) {
      // Current health, so a ball killed earlier in this phase is not hit again.
      if (ball.id === projectile.ownerId || !isAlive(ball)) continue;
      const ballStart = startPositions.get(ball.id) ?? ball.position;
      const s = sweepHitTime(
        subtract(projectile.position, ballStart),
        subtract(travel, subtract(ball.position, ballStart)),
        ball.radius + projectile.radius,
      );
      if (s !== undefined && (nearest === undefined || s < nearest.s)) nearest = { s, ball };
    }
    const wallS = wallHitTime(projectile.position, travel, projectile.radius, arenaSize);
    const base = { tick, projectileId: projectile.id, ownerId: projectile.ownerId };

    if (nearest !== undefined && (wallS === undefined || nearest.s <= wallS)) {
      const { balls: afterHit, damage } = dealAbilityDamage(
        current,
        projectile.ownerId,
        nearest.ball.id,
        projectile.damage,
        definitions,
        tick,
      );
      current = afterHit;
      events.push({
        type: 'projectileHit',
        ...base,
        targetId: nearest.ball.id,
        point: addScaled(projectile.position, travel, nearest.s),
        amount: damage?.amount ?? 0,
      });
      if (damage !== undefined) events.push(damage);
    } else if (wallS !== undefined) {
      events.push({ type: 'projectileExpired', ...base, reason: 'wall' });
    } else if (projectile.ticksLeft <= 1) {
      events.push({ type: 'projectileExpired', ...base, reason: 'lifetime' });
    } else {
      remaining.push({
        ...projectile,
        position: addScaled(projectile.position, travel, 1),
        ticksLeft: projectile.ticksLeft - 1,
      });
    }
  }
  return { balls: current, projectiles: remaining, events };
}
