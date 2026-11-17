import { isAlive } from './combat.ts';
import { MATCH_TIME_LIMIT_TICKS } from './constants.ts';
import { getDefinition } from './definitions.ts';
import { sideOf } from './side.ts';
import type { BallState, DefinitionLookup, MatchResult, MatchState } from './types.ts';

const RUNNING: MatchState = { status: 'running' };

/** One side's balls (a ball and any split off it, side.ts), in array order. */
interface Side {
  readonly id: string;
  readonly balls: readonly BallState[];
}

function sidesOf(balls: readonly BallState[]): Side[] {
  const sides = new Map<string, BallState[]>();
  for (const ball of balls) {
    const side = sideOf(ball);
    const members = sides.get(side);
    if (members === undefined) sides.set(side, [ball]);
    else members.push(ball);
  }
  return [...sides].map(([id, members]) => ({ id, balls: members }));
}

/**
 * The side with the highest health fraction wins (its balls' health over its first ball's full
 * health); a tie for the top is a draw.
 */
function decideOnHealth(sides: readonly Side[], definitions: DefinitionLookup): MatchResult {
  let leaders: Side[] = [];
  let best = -1;
  for (const side of sides) {
    const [first] = side.balls;
    if (first === undefined) continue;
    let health = 0;
    for (const ball of side.balls) health += ball.health;
    // Division is correctly rounded (IEEE 754), so equal fractions compare equal on every engine.
    const fraction = health / getDefinition(definitions, first.definitionId).maxHealth;
    if (fraction > best) {
      best = fraction;
      leaders = [side];
    } else if (fraction === best) {
      leaders.push(side);
    }
  }
  const [winner] = leaders;
  return leaders.length === 1 && winner !== undefined
    ? { kind: 'win', winnerId: winner.id }
    : { kind: 'draw' };
}

/**
 * Decides whether the match is over after `tick`. A side is out when every ball on it is out.
 * Knockouts take precedence over the time limit: no side left is a draw, one left wins. Otherwise,
 * at the time limit the sides still in are judged on health fraction.
 */
export function evaluateMatch(
  balls: readonly BallState[],
  tick: number,
  definitions: DefinitionLookup,
): MatchState {
  const alive = sidesOf(balls).filter((side) => side.balls.some(isAlive));
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
