import { moveBall } from './movement.ts';
import type { WorldState } from './types.ts';

/**
 * Advances the world by exactly one tick of DT seconds. Pure: returns a new world and never
 * mutates the input, so callers can keep earlier states for comparison or replay.
 */
export function step(world: WorldState): WorldState {
  return {
    ...world,
    tick: world.tick + 1,
    balls: world.balls.map((ball) => moveBall(ball, world.arena.size)),
  };
}
