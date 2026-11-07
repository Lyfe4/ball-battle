import type { BallState, ProjectileState, SimEvent, Vec2 } from '../types.ts';

/** Gap between the owner's edge and a new projectile's edge, so it never starts touching it. */
const SPAWN_GAP = 1;

export interface SpawnRequest {
  readonly velocity: Vec2;
  readonly radius: number;
  readonly damage: number;
  readonly lifetimeTicks: number;
  /**
   * Makes it a returning projectile (ADR 0043): it turns back this many ticks after it is thrown
   * (or at a wall), homes on its owner, and can hit each enemy once each way.
   */
  readonly returnAfterTicks?: number;
}

export interface SpawnResult {
  /** Undefined if the spawn point was outside the arena (ADR 0005). */
  readonly projectile: ProjectileState | undefined;
  readonly events: readonly SimEvent[];
}

function assertValid(owner: BallState, request: SpawnRequest): number {
  const { velocity, radius, damage, lifetimeTicks } = request;
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  const valid =
    Number.isFinite(speed) &&
    speed > 0 &&
    Number.isFinite(radius) &&
    radius > 0 &&
    Number.isFinite(damage) &&
    Number.isInteger(lifetimeTicks) &&
    lifetimeTicks > 0 &&
    (request.returnAfterTicks === undefined ||
      (Number.isInteger(request.returnAfterTicks) && request.returnAfterTicks >= 1));
  if (!valid) {
    throw new Error(`An ability of "${owner.id}" tried to spawn an invalid projectile`);
  }
  return speed;
}

/**
 * Creates a projectile just outside `owner`'s edge, heading along the requested velocity. If that
 * point is outside the arena (e.g. fired into an adjacent wall), no projectile is created, but it
 * still gets `id` and reports projectileFired then projectileExpired('wall'), so every fired
 * projectile has a matching end.
 */
export function spawnProjectile(
  owner: BallState,
  request: SpawnRequest,
  id: string,
  arenaSize: number,
  tick: number,
): SpawnResult {
  const speed = assertValid(owner, request);
  const { velocity, radius } = request;
  const offset = (owner.radius + radius + SPAWN_GAP) / speed;
  const position = {
    x: owner.position.x + velocity.x * offset,
    y: owner.position.y + velocity.y * offset,
  };
  const fired: SimEvent = {
    type: 'projectileFired',
    tick,
    projectileId: id,
    ownerId: owner.id,
    position,
    velocity,
  };

  const max = arenaSize - radius;
  const inside =
    position.x >= radius && position.x <= max && position.y >= radius && position.y <= max;
  if (!inside) {
    return {
      projectile: undefined,
      events: [
        fired,
        { type: 'projectileExpired', tick, projectileId: id, ownerId: owner.id, reason: 'wall' },
      ],
    };
  }

  return {
    projectile: {
      id,
      ownerId: owner.id,
      position,
      velocity,
      radius,
      damage: request.damage,
      ticksLeft: request.lifetimeTicks,
      ...(request.returnAfterTicks === undefined
        ? {}
        : { returning: { turnTick: tick + request.returnAfterTicks, back: false, hitIds: [] } }),
    },
    events: [fired],
  };
}
