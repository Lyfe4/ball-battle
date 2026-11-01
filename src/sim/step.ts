import { resolveCollisions } from './collision.ts';
import { applyContactDamage, isAlive, nextContacts, pairKey } from './combat.ts';
import { getDefinition } from './definitions.ts';
import { evaluateMatch } from './match.ts';
import { moveBall } from './movement.ts';
import type {
  CollisionEvent,
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
 * Order within a tick: move live balls, resolve collisions, apply damage for new contacts, record
 * defeats, decide whether the match is over. Events come out in that same order. A finished
 * match is returned as is, with no events.
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
  const moved = world.balls.map((ball) => (isAlive(ball) ? moveBall(ball, size) : ball));
  const collisions = resolveCollisions(moved, size, isAlive);

  // Pairs already in contact last tick are the same collision continuing: no new hit.
  const previousContacts = new Set(world.contacts);
  const collidedKeys = collisions.contacts.map(({ ballIds }) => pairKey(ballIds[0], ballIds[1]));
  const newContacts = collisions.contacts.filter(
    (_contact, index) => !previousContacts.has(collidedKeys[index] ?? ''),
  );
  const collisionEvents = newContacts.map(
    ({ ballIds, point, normal, impulse }): CollisionEvent => ({
      type: 'collision',
      tick,
      ballIds,
      point,
      normal,
      impulse,
    }),
  );

  const combat = applyContactDamage(collisions.balls, newContacts, definitions, tick);
  const match = evaluateMatch(combat.balls, tick, definitions);

  const events: SimEvent[] = [...collisionEvents, ...combat.damage, ...combat.defeated];
  if (match.status === 'finished') {
    events.push({ type: 'matchEnded', tick, result: match.result, reason: match.reason });
  }

  return {
    world: {
      ...world,
      tick,
      balls: combat.balls,
      contacts: nextContacts(combat.balls, world.contacts, collidedKeys),
      match,
    },
    events,
  };
}
