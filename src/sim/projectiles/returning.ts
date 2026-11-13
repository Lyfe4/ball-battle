// Returning projectiles (ADR 0043), the Boomerang's: it flies out, turns on its turn tick or at the
// first wall it reaches, then homes back on its owner, who catches it. It is not used up by a hit:
// it can hit each enemy ball once on the way out and once on the way back. Like every projectile
// it is swept against each ball's motion over the tick (ADR 0005), so nothing skips through it.
import { dealAbilityDamage } from '../abilities/apply-actions.ts';
import { isAlive, isPhased } from '../combat.ts';
import { DT } from '../constants.ts';
import { getDefinition } from '../definitions.ts';
import type { MinionState } from '../minions/types.ts';
import type { BallState, DefinitionLookup, ProjectileState, SimEvent, Vec2 } from '../types.ts';
import { addScaled, scale } from '../vec2.ts';
import { sweepHitTime, wallHitTime } from './sweep.ts';

/** Where a returning projectile is in its flight. Plain data on its ProjectileState. */
export interface ReturnFlight {
  /** It turns back on this tick, if it hasn't reached a wall first. */
  readonly turnTick: number;
  /** True once it has turned and is flying back to its owner. */
  readonly back: boolean;
  /** Balls it has hit on this leg; each can be hit once each way. */
  readonly hitIds: readonly string[];
}

/** What one tick did to a returning projectile, for resolveProjectiles to merge. */
export interface ReturnResult {
  readonly balls: readonly BallState[];
  /** Still flying, or undefined when it was caught, stopped by a minion or ran out. */
  readonly projectile: ProjectileState | undefined;
  /** The enemy minion it hit and destroyed, if any. */
  readonly destroyedMinionId: string | undefined;
  readonly events: readonly SimEvent[];
}

const subtract = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

/** The velocity that heads from `from` straight at `to` at `speed`; unchanged if already there. */
function homing(from: Vec2, to: Vec2, speed: number, fallback: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance === 0 ? fallback : { x: (dx / distance) * speed, y: (dy / distance) * speed };
}

/** Earliest swept touch of `projectile` moving by `travel` against a body moving start → now. */
function touchTime(
  projectile: ProjectileState,
  travel: Vec2,
  body: { readonly position: Vec2; readonly radius: number },
  start: Vec2,
): number | undefined {
  return sweepHitTime(
    subtract(projectile.position, start),
    subtract(travel, subtract(body.position, start)),
    body.radius + projectile.radius,
  );
}

/**
 * Moves one returning projectile a tick. In order of where along its path it happens: an enemy
 * minion it reaches first destroys it (minions soak shots, ADR 0026); the nearest enemy ball it has
 * not hit on this leg takes its damage, and it flies on; on the way back, reaching its owner is a
 * catch, and it is gone. On the way out a wall turns it back; on the way back (its path always
 * heads into the arena, where its owner is) a wall or a defeated owner drops it.
 */
export function resolveReturning(
  projectile: ProjectileState,
  flight: ReturnFlight,
  balls: readonly BallState[],
  startPositions: ReadonlyMap<string, Vec2>,
  minions: readonly MinionState[],
  minionStarts: ReadonlyMap<string, Vec2>,
  definitions: DefinitionLookup,
  arenaSize: number,
  tick: number,
): ReturnResult {
  const base = { tick, projectileId: projectile.id, ownerId: projectile.ownerId };
  const turning = !flight.back && tick >= flight.turnTick;
  const leg: ReturnFlight = turning ? { ...flight, back: true, hitIds: [] } : flight;
  const owner = balls.find((ball) => ball.id === projectile.ownerId);
  if (leg.back && (owner === undefined || !isAlive(owner))) {
    return {
      balls,
      projectile: undefined,
      destroyedMinionId: undefined,
      events: [{ type: 'projectileExpired', ...base, reason: 'lifetime' }],
    };
  }

  const speed = Math.sqrt(
    projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y,
  );
  const velocity =
    leg.back && owner !== undefined
      ? homing(projectile.position, owner.position, speed, projectile.velocity)
      : projectile.velocity;
  const travel = scale(velocity, DT);

  let ballHit: { readonly s: number; readonly ball: BallState } | undefined;
  for (const ball of balls) {
    if (ball.id === projectile.ownerId || !isAlive(ball) || leg.hitIds.includes(ball.id)) continue;
    // A phased ball lets it through, as it does a ball (ADR 0049).
    if (isPhased(ball, getDefinition(definitions, ball.definitionId))) continue;
    const s = touchTime(projectile, travel, ball, startPositions.get(ball.id) ?? ball.position);
    if (s !== undefined && (ballHit === undefined || s < ballHit.s)) ballHit = { s, ball };
  }
  let minionHit: { readonly s: number; readonly minion: MinionState } | undefined;
  for (const minion of minions) {
    if (minion.ownerId === projectile.ownerId) continue;
    const s = touchTime(projectile, travel, minion, minionStarts.get(minion.id) ?? minion.position);
    if (s !== undefined && (minionHit === undefined || s < minionHit.s)) minionHit = { s, minion };
  }
  const catchS =
    leg.back && owner !== undefined
      ? touchTime(projectile, travel, owner, startPositions.get(owner.id) ?? owner.position)
      : undefined;
  const wallS = wallHitTime(projectile.position, travel, projectile.radius, arenaSize);
  const endS = Math.min(catchS ?? Infinity, wallS ?? Infinity);

  // A minion is hit if it comes strictly before any ball (a tie goes to the ball) and the end.
  if (minionHit !== undefined && minionHit.s <= endS && minionHit.s < (ballHit?.s ?? Infinity)) {
    const destroyed = minionHit.minion;
    return {
      balls,
      projectile: undefined,
      destroyedMinionId: destroyed.id,
      events: [
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
      ],
    };
  }

  let current = balls;
  const events: SimEvent[] = [];
  let hitIds = leg.hitIds;
  if (ballHit !== undefined && ballHit.s <= endS) {
    const hit = dealAbilityDamage(
      current,
      projectile.ownerId,
      ballHit.ball.id,
      projectile.damage,
      definitions,
      tick,
      'projectile',
    );
    current = hit.balls;
    hitIds = [...hitIds, ballHit.ball.id];
    events.push(
      {
        type: 'projectileHit',
        ...base,
        targetId: ballHit.ball.id,
        point: addScaled(projectile.position, travel, ballHit.s),
        amount: hit.damage?.amount ?? 0,
      },
      ...hit.events,
    );
  }

  const done = (reason: 'lifetime' | 'wall' | 'caught'): ReturnResult => ({
    balls: current,
    projectile: undefined,
    destroyedMinionId: undefined,
    events: [...events, { type: 'projectileExpired', ...base, reason }],
  });
  if (catchS !== undefined && catchS <= (wallS ?? Infinity)) return done('caught');
  if (wallS !== undefined) {
    if (leg.back) return done('wall');
    // On the way out, the wall turns it back from where it touched.
    return {
      balls: current,
      projectile: {
        ...projectile,
        position: addScaled(projectile.position, travel, wallS),
        velocity,
        ticksLeft: projectile.ticksLeft - 1,
        returning: { ...leg, back: true, hitIds: [] },
      },
      destroyedMinionId: undefined,
      events,
    };
  }
  if (projectile.ticksLeft <= 1) return done('lifetime');
  return {
    balls: current,
    projectile: {
      ...projectile,
      position: addScaled(projectile.position, travel, 1),
      velocity,
      ticksLeft: projectile.ticksLeft - 1,
      returning: { ...leg, hitIds },
    },
    destroyedMinionId: undefined,
    events,
  };
}
