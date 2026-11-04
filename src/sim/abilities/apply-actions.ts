import { isAlive } from '../combat.ts';
import { getDefinition } from '../definitions.ts';
import { spawnProjectile } from '../projectiles/spawn.ts';
import { spawnZone } from '../zones/spawn.ts';
import type {
  AbilityAction,
  BallState,
  DamageEvent,
  DefinitionLookup,
  ProjectileState,
  SimEvent,
  Vec2,
  ZoneState,
} from '../types.ts';

/** The parts of the world that actions can change. */
export interface Scene {
  readonly balls: readonly BallState[];
  readonly projectiles: readonly ProjectileState[];
  readonly nextProjectileId: number;
  readonly zones: readonly ZoneState[];
  readonly nextZoneId: number;
}

export interface ActionResult extends Scene {
  readonly events: readonly SimEvent[];
}

function assertFinite(velocity: Vec2, ownerId: string): Vec2 {
  if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) {
    throw new Error(`An ability of "${ownerId}" produced a non-finite velocity`);
  }
  return velocity;
}

/**
 * Applies one hook's actions, in the order returned, on behalf of `ownerId`. Pure: returns the
 * changed scene and the events the actions produced. Actions on a defeated target or from a
 * defeated owner do nothing (a heal never revives); an unknown target id throws because only a
 * bug can produce one.
 */
export function applyActions(
  scene: Scene,
  ownerId: string,
  actions: readonly AbilityAction[],
  definitions: DefinitionLookup,
  tick: number,
  arenaSize: number,
): ActionResult {
  const next = [...scene.balls];
  const projectiles = [...scene.projectiles];
  let { nextProjectileId } = scene;
  const zones = [...scene.zones];
  let { nextZoneId } = scene;
  const events: SimEvent[] = [];

  const indexOf = (id: string): number => {
    const index = next.findIndex((ball) => ball.id === id);
    if (index === -1) throw new Error(`An ability of "${ownerId}" targeted unknown ball "${id}"`);
    return index;
  };
  const update = (id: string, change: (ball: BallState) => BallState | undefined): void => {
    const index = indexOf(id);
    const ball = next[index];
    if (ball === undefined || !isAlive(ball)) return;
    const changed = change(ball);
    if (changed !== undefined) next[index] = changed;
  };

  for (const action of actions) {
    switch (action.kind) {
      case 'damage':
        update(action.targetId, (target) => {
          const amount = Math.min(target.health, Math.max(0, action.amount));
          if (amount <= 0) return undefined;
          const healthAfter = target.health - amount;
          events.push({
            type: 'damage',
            tick,
            targetId: target.id,
            sourceId: ownerId,
            cause: 'ability',
            amount,
            healthAfter,
            multiplier: 1,
            survivedLethal: false,
          });
          return { ...target, health: healthAfter };
        });
        break;
      case 'heal':
        update(action.targetId, (target) => {
          const { maxHealth } = getDefinition(definitions, target.definitionId);
          const healthAfter = Math.min(maxHealth, target.health + Math.max(0, action.amount));
          const amount = healthAfter - target.health;
          if (amount <= 0) return undefined;
          events.push({
            type: 'healed',
            tick,
            ballId: target.id,
            sourceId: ownerId,
            amount,
            healthAfter,
          });
          return { ...target, health: healthAfter };
        });
        break;
      case 'setVelocity':
        update(ownerId, (self) => ({
          ...self,
          velocity: assertFinite(action.velocity, ownerId),
        }));
        break;
      case 'setAbilityState':
        update(ownerId, (self) => ({ ...self, abilityState: action.state }));
        break;
      case 'spawnProjectile':
        update(ownerId, (self) => {
          const id = `projectile-${nextProjectileId}`;
          nextProjectileId++;
          const spawned = spawnProjectile(self, action, id, arenaSize, tick);
          if (spawned.projectile !== undefined) projectiles.push(spawned.projectile);
          events.push(...spawned.events);
          return undefined;
        });
        break;
      case 'spawnZone':
        update(ownerId, (self) => {
          const spawned = spawnZone(self, action, `zone-${nextZoneId}`, arenaSize, tick);
          nextZoneId++;
          zones.push(spawned.zone);
          events.push(spawned.event);
          return undefined;
        });
        break;
      default: {
        // Adding an action kind without handling it here is a compile error.
        const unhandled: never = action;
        throw new Error(`Unhandled ability action ${JSON.stringify(unhandled)}`);
      }
    }
  }
  return { balls: next, projectiles, nextProjectileId, zones, nextZoneId, events };
}

/**
 * Ability damage from `ownerId` to one ball, through the same path as the `damage` action. Used
 * by projectile hits and zone strikes. `damage` is the event, or undefined if nothing was removed
 * (the target was already defeated, or the amount was 0).
 */
export function dealAbilityDamage(
  balls: readonly BallState[],
  ownerId: string,
  targetId: string,
  amount: number,
  definitions: DefinitionLookup,
  tick: number,
): { readonly balls: readonly BallState[]; readonly damage: DamageEvent | undefined } {
  const result = applyActions(
    { balls, projectiles: [], nextProjectileId: 0, zones: [], nextZoneId: 0 },
    ownerId,
    [{ kind: 'damage', targetId, amount }],
    definitions,
    tick,
    // A damage action never uses the arena size.
    Infinity,
  );
  const damage = result.events.find((event) => event.type === 'damage');
  return { balls: result.balls, damage };
}
