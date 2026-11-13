import { dealAbilityDamage } from '../abilities/apply-actions.ts';
import { isAlive, isPhased } from '../combat.ts';
import { DT } from '../constants.ts';
import { getDefinition } from '../definitions.ts';
import type { BallState, DefinitionLookup, ProjectileState, SimEvent, Vec2 } from '../types.ts';
import { addScaled, scale } from '../vec2.ts';
import type { MinionState } from '../minions/types.ts';
import { resolveReturning } from './returning.ts';
import { sweepHitTime, wallHitTime } from './sweep.ts';

export interface ProjectileResult {
  readonly balls: readonly BallState[];
  readonly projectiles: readonly ProjectileState[];
  /** Minions still in play: a projectile that reaches an enemy minion first destroys it. */
  readonly minions: readonly MinionState[];
  readonly events: readonly SimEvent[];
}

const subtract = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

/**
 * Moves every projectile one tick and resolves what it touches (ADR 0005). Each projectile's path
 * is swept against each live enemy ball's motion over the tick (from `startPositions` to where the
 * ball is now). The nearest hit along the path wins if it comes before the wall; otherwise a wall
 * or an exhausted lifetime removes it. Projectiles resolve in creation order and each hit is
 * applied before the next is checked, so a ball brought to 0 health by one projectile is passed
 * through by the rest. Enemy minions are targets too (ADR 0026), swept on their motion this tick
 * (from `minionStarts`): a projectile that reaches one first destroys it and is used up, which is
 * how minions soak shots meant for their owner.
 */
export function resolveProjectiles(
  projectiles: readonly ProjectileState[],
  balls: readonly BallState[],
  startPositions: ReadonlyMap<string, Vec2>,
  definitions: DefinitionLookup,
  arenaSize: number,
  tick: number,
  minions: readonly MinionState[] = [],
  minionStarts: ReadonlyMap<string, Vec2> = new Map(),
): ProjectileResult {
  let current = balls;
  let standing = minions;
  const remaining: ProjectileState[] = [];
  const events: SimEvent[] = [];

  for (const projectile of projectiles) {
    if (projectile.returning !== undefined) {
      const flown = resolveReturning(
        projectile,
        projectile.returning,
        current,
        startPositions,
        standing,
        minionStarts,
        definitions,
        arenaSize,
        tick,
      );
      current = flown.balls;
      if (flown.destroyedMinionId !== undefined) {
        standing = standing.filter((minion) => minion.id !== flown.destroyedMinionId);
      }
      if (flown.projectile !== undefined) remaining.push(flown.projectile);
      events.push(...flown.events);
      continue;
    }
    const travel = scale(projectile.velocity, DT);
    let nearest: { readonly s: number; readonly ball: BallState } | undefined;
    for (const ball of current) {
      // Current health, so a ball killed earlier in this phase is not hit again.
      if (ball.id === projectile.ownerId || !isAlive(ball)) continue;
      // A phased ball lets a shot through, as it does a ball (ADR 0049).
      if (isPhased(ball, getDefinition(definitions, ball.definitionId))) continue;
      const ballStart = startPositions.get(ball.id) ?? ball.position;
      const s = sweepHitTime(
        subtract(projectile.position, ballStart),
        subtract(travel, subtract(ball.position, ballStart)),
        ball.radius + projectile.radius,
      );
      if (s !== undefined && (nearest === undefined || s < nearest.s)) nearest = { s, ball };
    }
    let minionHit: { readonly s: number; readonly minion: MinionState } | undefined;
    for (const minion of standing) {
      if (minion.ownerId === projectile.ownerId) continue;
      const minionStart = minionStarts.get(minion.id) ?? minion.position;
      const s = sweepHitTime(
        subtract(projectile.position, minionStart),
        subtract(travel, subtract(minion.position, minionStart)),
        minion.radius + projectile.radius,
      );
      if (s !== undefined && (minionHit === undefined || s < minionHit.s))
        minionHit = { s, minion };
    }
    const wallS = wallHitTime(projectile.position, travel, projectile.radius, arenaSize);
    const base = { tick, projectileId: projectile.id, ownerId: projectile.ownerId };

    // A minion is hit if it comes strictly before any ball (a tie goes to the ball) and the wall.
    const minionFirst =
      minionHit !== undefined &&
      (wallS === undefined || minionHit.s <= wallS) &&
      (nearest === undefined || minionHit.s < nearest.s);
    if (minionHit !== undefined && minionFirst) {
      const destroyed = minionHit.minion;
      standing = standing.filter((minion) => minion.id !== destroyed.id);
      events.push(
        { type: 'projectileExpired', ...base, reason: 'minion' },
        {
          type: 'minionDestroyed',
          tick,
          minionId: destroyed.id,
          ownerId: destroyed.ownerId,
          position: destroyed.position,
          reason: 'projectile',
          byId: projectile.ownerId,
        },
      );
    } else if (nearest !== undefined && (wallS === undefined || nearest.s <= wallS)) {
      const {
        balls: afterHit,
        damage,
        events: hitEvents,
      } = dealAbilityDamage(
        current,
        projectile.ownerId,
        nearest.ball.id,
        projectile.damage,
        definitions,
        tick,
        'projectile',
      );
      current = afterHit;
      events.push({
        type: 'projectileHit',
        ...base,
        targetId: nearest.ball.id,
        point: addScaled(projectile.position, travel, nearest.s),
        amount: damage?.amount ?? 0,
      });
      events.push(...hitEvents);
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
  return { balls: current, projectiles: remaining, minions: standing, events };
}
