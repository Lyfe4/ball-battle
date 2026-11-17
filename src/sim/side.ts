// Sides (ADR 0059). A ball is on its own side unless it was split
// off another (`BallState.side`, the split action): then it is on that ball's side. Allies never
// touch, aim at or hit each other; a side is out when every ball on it is out. With one ball a
// side, as in every match today, a ball's side is its id and every check below is the old one.
import type { BallState } from './types.ts';

/** The side a ball fights for: the id of the ball it was split from, or its own id. */
export function sideOf(ball: Readonly<{ id: string; side?: string }>): string {
  return ball.side ?? ball.id;
}

/** The side of the ball with this id (an owner of a shot, zone or minion), or the id itself. */
export function sideOfId(balls: readonly BallState[], id: string): string {
  const ball = balls.find((other) => other.id === id);
  return ball === undefined ? id : sideOf(ball);
}

/** True when `ball` fights for the side of the ball `ownerId`: it is that ball or its ally. */
export function isAllyOf(balls: readonly BallState[], ball: BallState, ownerId: string): boolean {
  return ball.id === ownerId || sideOf(ball) === sideOfId(balls, ownerId);
}

/** True for the ball a side is named after (the one that started the match on it). */
export function isFirstOfSide(ball: Readonly<{ id: string; side?: string }>): boolean {
  return sideOf(ball) === ball.id;
}

/** Every ball on `side`, in array order (one, or a ball and the half split off it). */
export function membersOf(balls: readonly BallState[], side: string): BallState[] {
  return balls.filter((ball) => sideOf(ball) === side);
}

/** A side's health: its balls' health added up (a ball out counts 0). */
export function sideHealth(balls: readonly BallState[], side: string): number {
  let health = 0;
  for (const ball of membersOf(balls, side)) health += Math.max(0, ball.health);
  return health;
}
