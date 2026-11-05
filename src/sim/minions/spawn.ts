import type { BallState } from '../types.ts';
import type { MinionRequest, MinionSpawnedEvent, MinionState } from './types.ts';

/** Gap between the owner's edge and a new minion's edge, so it never starts inside it. */
const SPAWN_GAP = 1;

function assertValid(owner: BallState, request: MinionRequest): number {
  const { velocity, radius, damage, lifetimeTicks, maxAlive } = request;
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  const valid =
    Number.isFinite(speed) &&
    speed > 0 &&
    Number.isFinite(radius) &&
    radius > 0 &&
    Number.isFinite(damage) &&
    damage >= 0 &&
    Number.isInteger(lifetimeTicks) &&
    lifetimeTicks > 0 &&
    Number.isInteger(maxAlive) &&
    maxAlive > 0;
  if (!valid) throw new Error(`An ability of "${owner.id}" tried to summon an invalid minion`);
  return speed;
}

/**
 * A minion just outside `owner`'s edge, heading along the requested velocity (ADR 0026), or
 * nothing when the owner already has `maxAlive` minions or that point is outside the arena (a
 * summon into an adjacent wall). Nothing is summoned and no id is used in either case.
 */
export function spawnMinion(
  owner: BallState,
  request: MinionRequest,
  existing: readonly MinionState[],
  id: string,
  arenaSize: number,
  tick: number,
): { readonly minion: MinionState; readonly event: MinionSpawnedEvent } | undefined {
  const speed = assertValid(owner, request);
  const alive = existing.filter((minion) => minion.ownerId === owner.id).length;
  if (alive >= request.maxAlive) return undefined;
  const { velocity, radius } = request;
  const offset = (owner.radius + radius + SPAWN_GAP) / speed;
  const position = {
    x: owner.position.x + velocity.x * offset,
    y: owner.position.y + velocity.y * offset,
  };
  const max = arenaSize - radius;
  const inside =
    position.x >= radius && position.x <= max && position.y >= radius && position.y <= max;
  if (!inside) return undefined;
  return {
    minion: {
      id,
      ownerId: owner.id,
      position,
      velocity,
      radius,
      damage: request.damage,
      ticksLeft: request.lifetimeTicks,
    },
    event: { type: 'minionSpawned', tick, minionId: id, ownerId: owner.id, position, velocity },
  };
}
