// Helpers shared by the sim tests. Plain functions with no test-framework imports, so they obey
// the same rules as the rest of src/sim.
import { botPick, randomBot } from './bot.ts';
import { defineBall } from './define-ball.ts';
import { indexDefinitions } from './definitions.ts';
import {
  awaitingPick,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  remainingOf,
  startSeries,
  type SeriesSetup,
  type SeriesState,
} from './series.ts';
import { matchWorld, playToEnd } from './series-verify.ts';
import { step } from './step.ts';
import type { BallState, DefinitionLookup, SimEvent, WorldState } from './types.ts';

/**
 * Fixture balls for core sim tests: no abilities, fixed stats, so collision, damage and match
 * tests don't change whenever the real balls are rebalanced.
 */
export const red = defineBall({
  id: 'red',
  name: 'Red',
  description: 'Test fixture: small and fast, no ability.',
  color: '#ef4444',
  radius: 50,
  speed: 800,
  maxHealth: 75,
  contactDamage: 15,
  initialAbilityState: {},
  hooks: {},
});

export const blue = defineBall({
  id: 'blue',
  name: 'Blue',
  description: 'Test fixture: big and slow, no ability.',
  color: '#3b82f6',
  radius: 76,
  speed: 560,
  maxHealth: 85,
  contactDamage: 17,
  initialAbilityState: {},
  hooks: {},
});

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

/**
 * Plays a series the way the game does, one match at a time: the random bot makes side B's picks,
 * and side A picks its first ball left whenever it is due. `setupWithPicks` of the result is a link
 * the game could have written.
 */
export function playLikeTheGame(setup: SeriesSetup, definitions: DefinitionLookup): SeriesState {
  let state = startSeries(setup);
  for (;;) {
    const due = awaitingPick(state);
    if (due !== undefined) {
      const ball = due === 'b' ? botPick(randomBot, state) : remainingOf(state, 'a')[0];
      if (ball === undefined) throw new Error(`Side ${due} has no pick`);
      state = recordPick(state, ball);
      continue;
    }
    const next = nextMatch(state);
    if (next === undefined) return state;
    const end = playToEnd(matchWorld(next, definitions), definitions);
    if (end.match.status !== 'finished') throw new Error('Unfinished match');
    state = recordOutcome(state, outcomeOf(end.match.result, end));
  }
}
