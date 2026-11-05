// Helpers for the roster-wide tests (determinism, pass-through, identity). Plain functions with no
// test-framework imports, so they obey the same rules as the rest of src/sim.
import { MATCH_TIME_LIMIT_TICKS } from '../constants.ts';
import { step } from '../step.ts';
import type { BallDefinition, BallState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { BALL_LOOKUP, BALLS } from './index.ts';

/** Every ordered pair of balls, mirrors included. */
export const ORDERED_PAIRS: readonly (readonly [BallDefinition, BallDefinition])[] = BALLS.flatMap(
  (a) => BALLS.map((b) => [a, b] as const),
);

/** Every pair of balls once, mirrors included: half the ordered pairs, for order-free properties. */
export const PAIRS: readonly (readonly [BallDefinition, BallDefinition])[] = BALLS.flatMap((a, i) =>
  BALLS.slice(i).map((b) => [a, b] as const),
);

/**
 * Whole-roster runs play many full matches; Vitest's default 5 s per test is too tight once several
 * test files run in parallel.
 */
export const ROSTER_TIMEOUT_MS = 120_000;

/** Plays up to `ticks` ticks (stopping when the match ends), calling `onTick` after each. */
export function play(
  world: WorldState,
  ticks: number = MATCH_TIME_LIMIT_TICKS,
  onTick?: (world: WorldState) => void,
): { world: WorldState; events: SimEvent[] } {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && current.match.status === 'running'; i++) {
    const result = step(current, BALL_LOOKUP);
    current = result.world;
    events.push(...result.events);
    onTick?.(current);
  }
  return { world: current, events };
}

/** How fast two balls approach each other along the line between them (0 if separating). */
export function closingSpeed(a: BallState, b: BallState): number {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return 0;
  const relative =
    ((a.velocity.x - b.velocity.x) * dx + (a.velocity.y - b.velocity.y) * dy) / distance;
  return Math.max(0, relative);
}

/**
 * Damage `ball` dealt against each opponent over 40 seeds in both slot orders (as `pnpm balance`
 * plays them), and how much of it came from its ability, so slot luck and sampling noise stay well
 * below the margins the identity rules leave.
 */
export function damageDealt(
  ball: BallDefinition,
  opponents: readonly BallDefinition[],
): { readonly ability: number; readonly total: number } {
  let ability = 0;
  let total = 0;
  for (const opponent of opponents) {
    for (let seed = 0; seed < 40; seed++) {
      for (const [pair, selfId] of [
        [[ball, opponent], 'ball-0'],
        [[opponent, ball], 'ball-1'],
      ] as const) {
        const { events } = play(createWorld(seed, pair));
        for (const event of events) {
          if (event.type !== 'damage' || event.sourceId !== selfId) continue;
          total += event.amount;
          if (event.cause === 'ability') ability += event.amount;
        }
      }
    }
  }
  return { ability, total };
}
