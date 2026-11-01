import { resolveCollisions } from './collision.ts';
import { getDefinition } from './definitions.ts';
import { moveBall } from './movement.ts';
import type { DefinitionLookup, SimEvent, StepResult, WorldState } from './types.ts';

/**
 * Advances the world by exactly one tick of DT seconds and reports what happened. Pure: returns a
 * new world and never mutates the input, so callers can keep earlier states for comparison or
 * replay. `definitions` must be the same lookup every tick of a match.
 */
export function step(world: WorldState, definitions: DefinitionLookup): StepResult {
  for (const ball of world.balls) {
    getDefinition(definitions, ball.definitionId);
  }

  const tick = world.tick + 1;
  const moved = world.balls.map((ball) => moveBall(ball, world.arena.size));
  const collisions = resolveCollisions(moved, world.arena.size, () => true);

  const events: SimEvent[] = collisions.contacts.map((contact) => ({
    type: 'collision',
    tick,
    ...contact,
  }));

  return { world: { ...world, tick, balls: collisions.balls }, events };
}
