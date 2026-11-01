import { getDefinition } from './definitions.ts';
import { moveBall } from './movement.ts';
import type { DefinitionLookup, StepResult, WorldState } from './types.ts';

/**
 * Advances the world by exactly one tick of DT seconds and reports what happened. Pure: returns a
 * new world and never mutates the input, so callers can keep earlier states for comparison or
 * replay. `definitions` must be the same lookup every tick of a match.
 */
export function step(world: WorldState, definitions: DefinitionLookup): StepResult {
  for (const ball of world.balls) {
    getDefinition(definitions, ball.definitionId);
  }

  return {
    world: {
      ...world,
      tick: world.tick + 1,
      balls: world.balls.map((ball) => moveBall(ball, world.arena.size)),
    },
    events: [],
  };
}
