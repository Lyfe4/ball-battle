// The `split` action (ADR 0059): puts a second ball on the owner's side (the Slime). Plain data in,
// the new ball states and their event out.
import { sideOf } from '../side.ts';
import type { AbilityState, BallState, Vec2 } from '../types.ts';

export interface SplitRequest {
  /** Health the owner keeps, and the health the new ball starts with (whole numbers, at least 1). */
  readonly keepHealth: number;
  readonly splitHealth: number;
  /** The new ball's ability state (the owner's own is set with `setAbilityState`). */
  readonly state: AbilityState;
  /** How far apart, in world units, the two centres start: each moves half of it sideways. */
  readonly spread: number;
}

/** True when `ball` has split or was split off another: it never splits again (once per ball). */
export function hasSplit(ball: BallState): boolean {
  return ball.side !== undefined;
}

/** A ball split in two: `newBallId` is on its side from now on. */
export interface SplitEvent {
  readonly type: 'split';
  readonly tick: number;
  readonly ballId: string;
  readonly newBallId: string;
  readonly position: Vec2;
  readonly newPosition: Vec2;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const inside = (position: Vec2, radius: number, arenaSize: number): Vec2 => ({
  x: clamp(position.x, radius, arenaSize - radius),
  y: clamp(position.y, radius, arenaSize - radius),
});

/**
 * `owner` split in two (no trig, ADR 0001): both halves step sideways from its heading, half the
 * spread each, and turn 45 degrees from it, one each way. The new ball is a copy (statuses too) on
 * the owner's side, appended after every other ball, with id `<side>~<n>`.
 */
export function splitBall(
  owner: BallState,
  request: SplitRequest,
  balls: readonly BallState[],
  arenaSize: number,
  tick: number,
): { readonly owner: BallState; readonly added: BallState; readonly event: SplitEvent } {
  const values = [request.keepHealth, request.splitHealth, request.spread];
  if (!values.every(Number.isFinite) || request.keepHealth < 1 || request.splitHealth < 1) {
    throw new Error(`"${owner.id}" tried an invalid split`);
  }
  const { x: vx, y: vy } = owner.velocity;
  const speed = Math.sqrt(vx * vx + vy * vy);
  const ux = speed > 0 ? vx / speed : 1;
  const uy = speed > 0 ? vy / speed : 0;
  // Sideways: a quarter turn left of the heading.
  const px = -uy;
  const py = ux;
  const half = request.spread / 2;
  const diagonal = speed / Math.sqrt(2);
  const side = sideOf(owner);
  const count = balls.filter((ball) => sideOf(ball) === side).length;
  const position = inside(
    { x: owner.position.x + px * half, y: owner.position.y + py * half },
    owner.radius,
    arenaSize,
  );
  const newPosition = inside(
    { x: owner.position.x - px * half, y: owner.position.y - py * half },
    owner.radius,
    arenaSize,
  );
  const added: BallState = {
    ...owner,
    id: `${side}~${String(count)}`,
    side,
    position: newPosition,
    velocity: { x: (ux - px) * diagonal, y: (uy - py) * diagonal },
    health: Math.round(request.splitHealth),
    abilityState: request.state,
  };
  return {
    owner: {
      ...owner,
      side,
      position,
      velocity: { x: (ux + px) * diagonal, y: (uy + py) * diagonal },
      health: Math.round(request.keepHealth),
    },
    added,
    event: { type: 'split', tick, ballId: owner.id, newBallId: added.id, position, newPosition },
  };
}
