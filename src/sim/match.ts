import { isAlive } from './combat.ts';
import { MATCH_TIME_LIMIT_TICKS } from './constants.ts';
import { getDefinition } from './definitions.ts';
import type { BallState, DefinitionLookup, MatchResult, MatchState } from './types.ts';

const RUNNING: MatchState = { status: 'running' };

/** The ball with the highest health fraction wins; a tie for the top is a draw. */
function decideOnHealth(balls: readonly BallState[], definitions: DefinitionLookup): MatchResult {
  let leaders: BallState[] = [];
  let best = -1;
  for (const ball of balls) {
    // Division is correctly rounded (IEEE 754), so equal fractions compare equal on every engine.
    const fraction = ball.health / getDefinition(definitions, ball.definitionId).maxHealth;
    if (fraction > best) {
      best = fraction;
      leaders = [ball];
    } else if (fraction === best) {
      leaders.push(ball);
    }
  }
  const [winner] = leaders;
  return leaders.length === 1 && winner !== undefined
    ? { kind: 'win', winnerId: winner.id }
    : { kind: 'draw' };
}

/**
 * Decides whether the match is over after `tick`. Knockouts take precedence over the time limit:
 * no balls left is a draw, one left wins. Otherwise, at the time limit the live balls are judged
 * on health fraction.
 */
export function evaluateMatch(
  balls: readonly BallState[],
  tick: number,
  definitions: DefinitionLookup,
): MatchState {
  const alive = balls.filter(isAlive);
  const [survivor] = alive;
  if (alive.length === 0) {
    return { status: 'finished', result: { kind: 'draw' }, reason: 'knockout', endTick: tick };
  }
  if (alive.length === 1 && survivor !== undefined) {
    return {
      status: 'finished',
      result: { kind: 'win', winnerId: survivor.id },
      reason: 'knockout',
      endTick: tick,
    };
  }
  if (tick >= MATCH_TIME_LIMIT_TICKS) {
    return {
      status: 'finished',
      result: decideOnHealth(alive, definitions),
      reason: 'timeLimit',
      endTick: tick,
    };
  }
  return RUNNING;
}
