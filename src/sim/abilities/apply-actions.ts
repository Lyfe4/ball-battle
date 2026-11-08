import { isAlive } from '../combat.ts';
import { getDefinition } from '../definitions.ts';
import { spawnMinion } from '../minions/spawn.ts';
import type { MinionState } from '../minions/types.ts';
import { spawnProjectile } from '../projectiles/spawn.ts';
import { assertStatusDuration, resistedDuration, withStatus } from '../status.ts';
import { isShielded, soakHit } from '../shield.ts';
import { assertSteerShare, steerToward } from '../steer.ts';
import { spawnZone } from '../zones/spawn.ts';
import { rewindBall } from './rewind.ts';
import type {
  AbilityAction,
  BallState,
  DamageEvent,
  DamageVia,
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
  readonly minions: readonly MinionState[];
  readonly nextMinionId: number;
}

/** A scene of just these balls, with nothing in flight: for applying one-off actions. */
export function sceneOf(balls: readonly BallState[]): Scene {
  return {
    balls,
    projectiles: [],
    nextProjectileId: 0,
    zones: [],
    nextZoneId: 0,
    minions: [],
    nextMinionId: 0,
  };
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
  /** What delivers any damage these actions deal, stamped on its events (output only, ADR 0036). */
  via?: DamageVia,
): ActionResult {
  const next = [...scene.balls];
  const projectiles = [...scene.projectiles];
  let { nextProjectileId } = scene;
  const zones = [...scene.zones];
  let { nextZoneId } = scene;
  const minions = [...scene.minions];
  let { nextMinionId } = scene;
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
          // A shield takes the hit first: it soaks up to SHIELD_SOAK and breaks (ADR 0043).
          let struck = target;
          let hit = amount;
          if (isShielded(target)) {
            const soaked = soakHit(target, ownerId, amount, tick);
            events.push(soaked.event);
            if (soaked.rest <= 0) return soaked.ball;
            struck = soaked.ball;
            hit = soaked.rest;
          }
          const healthAfter = struck.health - hit;
          events.push({
            type: 'damage',
            tick,
            targetId: struck.id,
            sourceId: ownerId,
            cause: 'ability',
            amount: hit,
            healthAfter,
            multiplier: 1,
            survivedLethal: false,
            ...(via === undefined ? {} : { via }),
          });
          return { ...struck, health: healthAfter };
        });
        break;
      case 'heal':
        update(action.targetId, (target) => {
          const { maxHealth } = getDefinition(definitions, target.definitionId);
          const requested = Math.max(0, action.amount);
          const amount = Math.min(maxHealth, target.health + requested) - target.health;
          if (amount <= 0) return undefined;
          const healthAfter = target.health + amount;
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
      case 'steer':
        assertSteerShare(action.share, ownerId);
        update(action.targetId, (target) => ({
          ...target,
          velocity: steerToward(
            target.position,
            target.velocity,
            assertFinite(action.toward, ownerId),
            action.share,
          ),
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
      case 'spawnMinion':
        update(ownerId, (self) => {
          const spawned = spawnMinion(
            self,
            action,
            minions,
            `minion-${nextMinionId}`,
            arenaSize,
            tick,
          );
          if (spawned === undefined) return undefined;
          nextMinionId++;
          minions.push(spawned.minion);
          events.push(spawned.event);
          return undefined;
        });
        break;
      case 'applyStatus':
        update(action.targetId, (target) => {
          assertStatusDuration(action.status, action.durationTicks, ownerId);
          // A ball that resists a kind keeps it for less time, or never gets it (ADR 0016).
          const keeps = getDefinition(definitions, target.definitionId).statusResistance;
          const durationTicks = resistedDuration(action.durationTicks, keeps?.[action.status]);
          if (durationTicks === 0) return undefined;
          const request = { kind: action.status, durationTicks };
          const applied = withStatus(target, request, ownerId, tick);
          events.push(applied.event);
          return applied.ball;
        });
        break;
      case 'rewind': {
        // The one action that acts on an owner at 0 health (onKnockedOut, ADR 0034).
        const index = indexOf(ownerId);
        const self = next[index];
        if (self === undefined) break;
        const { maxHealth } = getDefinition(definitions, self.definitionId);
        const rewound = rewindBall(self, action, maxHealth, arenaSize, tick);
        next[index] = rewound.ball;
        events.push(rewound.event);
        break;
      }
      default: {
        // Adding an action kind without handling it here is a compile error.
        const unhandled: never = action;
        throw new Error(`Unhandled ability action ${JSON.stringify(unhandled)}`);
      }
    }
  }
  return {
    balls: next,
    projectiles,
    nextProjectileId,
    zones,
    nextZoneId,
    minions,
    nextMinionId,
    events,
  };
}

/**
 * Ability damage from `ownerId` to one ball, through the same path as the `damage` action. Used
 * by projectile hits, zone strikes, minions and poison, each naming itself as `via`. `damage` is
 * the event, or undefined if nothing was removed (the target was already defeated, the amount was
 * 0, or a shield blocked it). `events` is what the hit produced: its damage event, or the
 * `shieldBroken` of a blocked hit (ADR 0043).
 */
export function dealAbilityDamage(
  balls: readonly BallState[],
  ownerId: string,
  targetId: string,
  amount: number,
  definitions: DefinitionLookup,
  tick: number,
  via: DamageVia,
): {
  readonly balls: readonly BallState[];
  readonly damage: DamageEvent | undefined;
  readonly events: readonly SimEvent[];
} {
  const result = applyActions(
    sceneOf(balls),
    ownerId,
    [{ kind: 'damage', targetId, amount }],
    definitions,
    tick,
    // A damage action never uses the arena size.
    Infinity,
    via,
  );
  const damage = result.events.find((event) => event.type === 'damage');
  return { balls: result.balls, damage, events: result.events };
}
