// Helpers shared by the sim tests. Plain functions with no test-framework imports, so they obey
// the same rules as the rest of src/sim.
import { blue } from './balls/blue.ts';
import { red } from './balls/red.ts';
import { indexDefinitions } from './definitions.ts';
import { step } from './step.ts';
import type { BallState, SimEvent, WorldState } from './types.ts';

export const testDefinitions = [red, blue] as const;
export const testLookup = indexDefinitions(testDefinitions);

export interface RunResult {
  readonly world: WorldState;
  readonly events: readonly SimEvent[];
}

/** Runs up to `ticks` steps, calling `onTick` after each, and collects every event. */
export function run(
  world: WorldState,
  ticks: number,
  onTick?: (world: WorldState) => void,
): RunResult {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, testLookup);
    current = result.world;
    events.push(...result.events);
    onTick?.(current);
  }
  return { world: current, events };
}

/** Returns a copy of the world with the given fields replaced on each ball, by index. */
export function withBalls(world: WorldState, overrides: readonly Partial<BallState>[]): WorldState {
  return {
    ...world,
    balls: world.balls.map((ball, index) => ({ ...ball, ...overrides[index] })),
  };
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
