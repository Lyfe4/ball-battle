import type { BallState, Vec2 } from './types.ts';
import { addScaled, vec2 } from './vec2.ts';

/** Used when two centres coincide exactly and there is no direction to separate along. */
const FALLBACK_NORMAL: Vec2 = { x: 1, y: 0 };

/**
 * Extra distance added when separating, in world units. Far below anything visible, but enough
 * that rounding can never leave two balls overlapping by a hair and colliding again next tick.
 */
const SEPARATION_MARGIN = 1e-9;

/** Wall-blocked separations try again from the new positions, at most this many times. */
const MAX_SEPARATION_PASSES = 4;

export interface Contact {
  /** Contact point on the line between the centres, after separation. */
  readonly point: Vec2;
  /** Unit vector from `a` towards `b`. */
  readonly normal: Vec2;
  /** Impulse exchanged; 0 if the balls were already moving apart. */
  readonly impulse: number;
}

export interface PairResolution {
  readonly a: BallState;
  readonly b: BallState;
  readonly contact: Contact;
}

/** Mass is proportional to area, so bigger balls shove smaller ones around. */
export function massOf(ball: BallState): number {
  return ball.radius * ball.radius;
}

function clampToArena(position: Vec2, radius: number, arenaSize: number): Vec2 {
  const max = arenaSize - radius;
  return vec2(
    Math.min(max, Math.max(radius, position.x)),
    Math.min(max, Math.max(radius, position.y)),
  );
}

function overlaps(a: Vec2, b: Vec2, minDistance: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy < minDistance * minDistance;
}

/** Unit vector from `from` to `to`, or the fallback if they coincide. */
function directionBetween(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  return length === 0 ? FALLBACK_NORMAL : vec2(dx / length, dy / length);
}

/**
 * Pushes two overlapping balls apart along the normal, each moving in proportion to the other's
 * mass. A ball against a wall cannot take its share, so if they still overlap after clamping to
 * the arena, the free ball is moved to just touch the blocked one.
 */
function separate(
  a: BallState,
  b: BallState,
  normal: Vec2,
  penetration: number,
  arenaSize: number,
): readonly [Vec2, Vec2] {
  const inverseA = 1 / massOf(a);
  const inverseB = 1 / massOf(b);
  const shareA = inverseA / (inverseA + inverseB);
  const minDistance = a.radius + b.radius;
  const push = penetration + SEPARATION_MARGIN;

  let positionA = clampToArena(addScaled(a.position, normal, -push * shareA), a.radius, arenaSize);
  let positionB = clampToArena(
    addScaled(b.position, normal, push * (1 - shareA)),
    b.radius,
    arenaSize,
  );

  const touching = minDistance + SEPARATION_MARGIN;
  for (let pass = 0; pass < MAX_SEPARATION_PASSES; pass++) {
    if (!overlaps(positionA, positionB, minDistance)) break;
    const direction = directionBetween(positionA, positionB);
    positionB = clampToArena(addScaled(positionA, direction, touching), b.radius, arenaSize);
    if (!overlaps(positionA, positionB, minDistance)) break;
    // B is pinned by a wall too; move A away from B's new position instead.
    positionA = clampToArena(addScaled(positionB, direction, -touching), a.radius, arenaSize);
  }
  return [positionA, positionB];
}

/**
 * Detects and resolves a collision between two balls. Returns undefined if they do not overlap.
 * Otherwise separates them and, if they are approaching, applies an elastic impulse that
 * conserves momentum and kinetic energy. Uses only + - * / and Math.sqrt (ADR 0001).
 */
export function resolvePair(
  a: BallState,
  b: BallState,
  arenaSize: number,
): PairResolution | undefined {
  const minDistance = a.radius + b.radius;
  if (!overlaps(a.position, b.position, minDistance)) {
    return undefined;
  }

  const normal = directionBetween(a.position, b.position);
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const penetration = minDistance - Math.sqrt(dx * dx + dy * dy);
  const [positionA, positionB] = separate(a, b, normal, penetration, arenaSize);

  const inverseA = 1 / massOf(a);
  const inverseB = 1 / massOf(b);
  const closingSpeed =
    (b.velocity.x - a.velocity.x) * normal.x + (b.velocity.y - a.velocity.y) * normal.y;
  // Only push apart balls that are moving towards each other; separating balls keep going.
  const impulse = closingSpeed < 0 ? (-2 * closingSpeed) / (inverseA + inverseB) : 0;

  return {
    a: { ...a, position: positionA, velocity: addScaled(a.velocity, normal, -impulse * inverseA) },
    b: { ...b, position: positionB, velocity: addScaled(b.velocity, normal, impulse * inverseB) },
    contact: { point: addScaled(positionA, normal, a.radius), normal, impulse },
  };
}

export interface PairContact extends Contact {
  readonly ballIds: readonly [string, string];
}

export interface CollisionPass {
  readonly balls: readonly BallState[];
  /** Pairs that overlapped this tick, in resolution order. */
  readonly contacts: readonly PairContact[];
}

/**
 * Resolves every overlapping pair once, in array order (i < j) so the result is deterministic.
 * Balls for which `isActive` is false are skipped entirely.
 */
export function resolveCollisions(
  balls: readonly BallState[],
  arenaSize: number,
  isActive: (ball: BallState) => boolean,
): CollisionPass {
  const next = [...balls];
  const contacts: PairContact[] = [];
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i];
      const b = next[j];
      if (a === undefined || b === undefined || !isActive(a) || !isActive(b)) continue;
      const resolution = resolvePair(a, b, arenaSize);
      if (resolution === undefined) continue;
      next[i] = resolution.a;
      next[j] = resolution.b;
      contacts.push({ ballIds: [a.id, b.id], ...resolution.contact });
    }
  }
  return { balls: next, contacts };
}
