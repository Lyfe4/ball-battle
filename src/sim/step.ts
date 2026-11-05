import {
  damageDealtInvocations,
  damageTakenInvocations,
  hitBallInvocations,
  runPhase,
  tickInvocations,
  wallHitInvocations,
  type Invocation,
} from './abilities/run-hooks.ts';
import { applyBounceVariance } from './bounce-variance.ts';
import { resolveCollisions } from './collision.ts';
import { applyCruiseSpeed } from './cruise.ts';
import {
  applyContactDamage,
  defeatsThisTick,
  isAlive,
  isPhased,
  nextContacts,
  pairKey,
} from './combat.ts';
import { getDefinition } from './definitions.ts';
import { evaluateMatch } from './match.ts';
import { moveBall } from './movement.ts';
import { resolveMinions } from './minions/resolve.ts';
import { resolveProjectiles } from './projectiles/resolve.ts';
import { expireStatuses } from './status.ts';
import { resolvePoison } from './status-effects.ts';
import { resolveZones } from './zones/resolve.ts';
import type {
  BallState,
  CollisionEvent,
  DamageEvent,
  DefinitionLookup,
  SimEvent,
  StepResult,
  WorldState,
} from './types.ts';

/**
 * Advances the world by exactly one tick of DT seconds and reports what happened. Pure: returns a
 * new world and never mutates the input, so callers can keep earlier states for comparison or
 * replay. `definitions` must be the same lookup every tick of a match.
 *
 * Order within a tick (ADR 0003, 0004, 0005, 0006, 0008, 0009, 0012); events come out in the
 * same order:
 *  1. A finished match is returned as is, with no events.
 *  2. Statuses whose expiry tick is this tick are removed (ADR 0009), so every hook below already
 *     sees them gone.
 *  3. onTick hooks, then their actions.
 *  4. Live balls move and bounce off walls; each ball that bounced gets a small seeded turn
 *     (ADR 0004), which advances the world RNG.
 *  5. onWallHit hooks for balls that bounced, then their actions.
 *  6. Ball collisions: separation and elastic impulse (momentum-conserving physics). A pair with a
 *     phased ball overlaps and passes through instead (ADR 0026).
 *  7. Contact damage for new contacts (scaled by directness, lethal tiebreak); none for a pass
 *     through a phased ball.
 *  8. onHitBall hooks for both balls of each new contact, then their actions; for a pass through a
 *     phased ball, only the phased ball's own hook (ADR 0026).
 *  9. Minions move like balls (wall fold and seeded turn) and pop on the first enemy ball their
 *     swept path touches, for ability damage (ADR 0026). Minions summoned in steps 3-8 already
 *     move this tick.
 * 9b. Projectiles move and resolve: swept against each ball's (and minion's) motion this tick,
 *     the nearest hit before a wall deals ability damage (ADR 0005), or destroys an enemy minion
 *     that comes first. Projectiles spawned in steps 3-8 already move this tick.
 * 10. Zones whose strike tick is this tick strike: each deals ability damage to every live ball
 *     other than its owner that overlaps it now, then applies its status (if any) to the balls it
 *     hit, destroys every enemy minion inside it, then is removed (ADR 0006, 0009, 0026). A zone
 *     always strikes at least one tick after it was spawned.
 * 11. Poison ticks: every poisoned ball whose poison is due takes its source's ability damage
 *     (ADR 0012).
 * 12. onDamageDealt hooks for every damage event so far this tick (contact, projectile, zone and
 *     poison), then their actions. Damage from these actions does not fire onDamageDealt again;
 *     projectiles they spawn start moving next tick.
 * 13. onDamageTaken hooks for every damage event so far this tick, including damage from step 12's
 *     actions, then their actions (ADR 0012). Damage from these actions fires neither
 *     onDamageDealt nor onDamageTaken, so nothing can chain or loop.
 * 14. ballDefeated for balls that went from alive to 0 health this tick.
 * 15. Cruise speed: every live ball's velocity is rescaled to its cruise speed, keeping its
 *     direction (ADR 0008); slowed balls go slower (ADR 0012). Last, so it reads ability state
 *     and statuses after every hook of the tick; it emits no events.
 * 16. Contacts are updated and the match end is decided.
 */
export function step(world: WorldState, definitions: DefinitionLookup): StepResult {
  if (world.match.status === 'finished') {
    return { world, events: [] };
  }

  for (const ball of world.balls) {
    getDefinition(definitions, ball.definitionId);
  }

  const tick = world.tick + 1;
  const { size } = world.arena;
  const events: SimEvent[] = [];
  const expiry = expireStatuses(world.balls, tick);
  let balls: readonly BallState[] = expiry.balls;
  events.push(...expiry.events);
  let { rngState, projectiles, nextProjectileId, zones, nextZoneId, minions, nextMinionId } = world;

  const phase = (invocations: readonly Invocation[]): void => {
    if (invocations.length === 0) return;
    const result = runPhase(
      {
        ...world,
        tick,
        balls,
        rngState,
        projectiles,
        nextProjectileId,
        zones,
        nextZoneId,
        minions,
        nextMinionId,
      },
      invocations,
      definitions,
    );
    balls = result.balls;
    projectiles = result.projectiles;
    nextProjectileId = result.nextProjectileId;
    zones = result.zones;
    nextZoneId = result.nextZoneId;
    minions = result.minions;
    nextMinionId = result.nextMinionId;
    events.push(...result.events);
  };

  phase(tickInvocations(balls));

  // Where each ball starts its movement, for sweeping projectiles against its path (step 8).
  const startPositions = new Map(balls.map((ball) => [ball.id, ball.position]));
  const movements = balls.map((ball) =>
    isAlive(ball) ? moveBall(ball, size) : { ball, bounces: 0, bouncesX: 0, bouncesY: 0 },
  );
  const variance = applyBounceVariance(movements, rngState);
  balls = variance.balls;
  rngState = variance.rngState;
  phase(wallHitInvocations(new Map(movements.map(({ ball, bounces }) => [ball.id, bounces]))));

  const isPhasedBall = (ball: BallState): boolean =>
    isPhased(ball, getDefinition(definitions, ball.definitionId));
  const collisions = resolveCollisions(
    balls,
    size,
    isAlive,
    (a, b) => isPhasedBall(a) || isPhasedBall(b),
  );
  balls = collisions.balls;

  // Pairs already in contact last tick are the same collision continuing: no new hit.
  const previousContacts = new Set(world.contacts);
  const collidedKeys = collisions.contacts.map(({ ballIds }) => pairKey(ballIds[0], ballIds[1]));
  const newContacts = collisions.contacts.filter(
    (_contact, index) => !previousContacts.has(collidedKeys[index] ?? ''),
  );
  events.push(
    ...newContacts.map(({ ballIds, point, normal, impulse, phased }): CollisionEvent => ({
      type: 'collision',
      tick,
      ballIds,
      point,
      normal,
      impulse,
      ...(phased ? { phased } : {}),
    })),
  );

  const combat = applyContactDamage(balls, newContacts, definitions, tick);
  balls = combat.balls;
  events.push(...combat.damage);

  const phasedIds = new Set(balls.filter(isPhasedBall).map((ball) => ball.id));
  phase(hitBallInvocations(newContacts, (id) => phasedIds.has(id)));

  const minionStarts = new Map(minions.map((minion) => [minion.id, minion.position]));
  const summoned = resolveMinions(
    minions,
    balls,
    startPositions,
    definitions,
    size,
    rngState,
    tick,
  );
  balls = summoned.balls;
  minions = summoned.minions;
  rngState = summoned.rngState;
  events.push(...summoned.events);

  const flight = resolveProjectiles(
    projectiles,
    balls,
    startPositions,
    definitions,
    size,
    tick,
    minions,
    minionStarts,
  );
  balls = flight.balls;
  projectiles = flight.projectiles;
  minions = flight.minions;
  events.push(...flight.events);

  const strikes = resolveZones(zones, balls, definitions, tick, minions);
  balls = strikes.balls;
  zones = strikes.zones;
  minions = strikes.minions;
  events.push(...strikes.events);

  const poison = resolvePoison(balls, definitions, tick);
  balls = poison.balls;
  events.push(...poison.damage);

  const damageSoFar = (): DamageEvent[] =>
    events.filter((event): event is DamageEvent => event.type === 'damage');
  phase(damageDealtInvocations(damageSoFar()));
  // Collected once, before the phase runs: damage its own actions deal is never fed back.
  phase(damageTakenInvocations(damageSoFar()));

  events.push(...defeatsThisTick(world.balls, balls, events, tick));

  balls = applyCruiseSpeed(balls, definitions);

  const match = evaluateMatch(balls, tick, definitions);
  if (match.status === 'finished') {
    events.push({ type: 'matchEnded', tick, result: match.result, reason: match.reason });
  }

  return {
    world: {
      ...world,
      tick,
      balls,
      rngState,
      projectiles,
      nextProjectileId,
      zones,
      nextZoneId,
      minions,
      nextMinionId,
      contacts: nextContacts(balls, world.contacts, collidedKeys),
      match,
    },
    events,
  };
}
