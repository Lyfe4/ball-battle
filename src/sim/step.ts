import {
  damageDealtInvocations,
  hitBallInvocations,
  runPhase,
  tickInvocations,
  wallHitInvocations,
  type Invocation,
} from './abilities/run-hooks.ts';
import { resolveCollisions } from './collision.ts';
import { applyContactDamage, defeatsThisTick, isAlive, nextContacts, pairKey } from './combat.ts';
import { getDefinition } from './definitions.ts';
import { evaluateMatch } from './match.ts';
import { moveBall } from './movement.ts';
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
 * Order within a tick (ADR 0003); events come out in the same order:
 *  1. A finished match is returned as is, with no events.
 *  2. onTick hooks, then their actions.
 *  3. Live balls move and bounce off walls.
 *  4. onWallHit hooks for balls that bounced, then their actions.
 *  5. Ball collisions: separation and impulse.
 *  6. Contact damage for new contacts (impact scaling, lethal tiebreak).
 *  7. onHitBall hooks for both balls of each new contact, then their actions.
 *  8. onDamageDealt hooks for every damage event so far this tick, then their actions. Damage
 *     from these actions does not fire onDamageDealt again.
 *  9. ballDefeated for balls that went from alive to 0 health this tick.
 * 10. Contacts are updated and the match end is decided.
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
  let balls: readonly BallState[] = world.balls;

  const phase = (invocations: readonly Invocation[]): void => {
    if (invocations.length === 0) return;
    const result = runPhase({ ...world, tick, balls }, invocations, definitions);
    balls = result.balls;
    events.push(...result.events);
  };

  phase(tickInvocations(balls));

  const movements = balls.map((ball) =>
    isAlive(ball) ? moveBall(ball, size) : { ball, bounces: 0, bouncesX: 0, bouncesY: 0 },
  );
  balls = movements.map((movement) => movement.ball);
  phase(wallHitInvocations(new Map(movements.map(({ ball, bounces }) => [ball.id, bounces]))));

  const collisions = resolveCollisions(balls, size, isAlive);
  balls = collisions.balls;

  // Pairs already in contact last tick are the same collision continuing: no new hit.
  const previousContacts = new Set(world.contacts);
  const collidedKeys = collisions.contacts.map(({ ballIds }) => pairKey(ballIds[0], ballIds[1]));
  const newContacts = collisions.contacts.filter(
    (_contact, index) => !previousContacts.has(collidedKeys[index] ?? ''),
  );
  events.push(
    ...newContacts.map(({ ballIds, point, normal, impulse }): CollisionEvent => ({
      type: 'collision',
      tick,
      ballIds,
      point,
      normal,
      impulse,
    })),
  );

  const combat = applyContactDamage(balls, newContacts, definitions, tick);
  balls = combat.balls;
  events.push(...combat.damage);

  phase(hitBallInvocations(newContacts));
  phase(
    damageDealtInvocations(events.filter((event): event is DamageEvent => event.type === 'damage')),
  );

  events.push(...defeatsThisTick(world.balls, balls, events, tick));

  const match = evaluateMatch(balls, tick, definitions);
  if (match.status === 'finished') {
    events.push({ type: 'matchEnded', tick, result: match.result, reason: match.reason });
  }

  return {
    world: {
      ...world,
      tick,
      balls,
      contacts: nextContacts(balls, world.contacts, collidedKeys),
      match,
    },
    events,
  };
}
