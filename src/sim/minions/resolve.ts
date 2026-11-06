import { dealAbilityDamage } from '../abilities/apply-actions.ts';
import { BOUNCE_MAX_HALF_TAN, turnBounce } from '../bounce-variance.ts';
import { isAlive, isPhased } from '../combat.ts';
import { getDefinition } from '../definitions.ts';
import { DT } from '../constants.ts';
import { moveBall } from '../movement.ts';
import { sweepHitTime } from '../projectiles/sweep.ts';
import { nextRange, type RngState } from '../rng.ts';
import type { BallState, DefinitionLookup, SimEvent, Vec2 } from '../types.ts';
import type { MinionState } from './types.ts';

export interface MinionResult {
  readonly balls: readonly BallState[];
  readonly minions: readonly MinionState[];
  readonly rngState: RngState;
  readonly events: readonly SimEvent[];
}

/** One straight piece of a minion's path this tick, from fraction `s0` of the tick to `s1`. */
interface Segment {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly s0: number;
  readonly s1: number;
}

const lerp = (a: Vec2, b: Vec2, s: number): Vec2 => ({
  x: a.x + (b.x - a.x) * s,
  y: a.y + (b.y - a.y) * s,
});
const subtract = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

/** Time along `travel` (0 to 1) at which a body moving from `position` meets one axis's wall. */
function axisTime(position: number, delta: number, min: number, max: number): number {
  if (delta > 0) return (max - position) / delta;
  if (delta < 0) return (min - position) / delta;
  return Infinity;
}

/**
 * The straight pieces of a body's path over one tick, split where it bounces off a wall, so a hit
 * test can follow the bend. The same mirror reflection `moveBall` folds into its end position; a
 * corner hit splits once and flips both axes.
 */
export function pathSegments(start: Vec2, travel: Vec2, radius: number, size: number): Segment[] {
  const segments: Segment[] = [];
  const min = radius;
  const max = size - radius;
  let from = start;
  let delta = travel;
  let s0 = 0;
  // A body can't cross the arena more than a few times a tick; 4 bends is far beyond any speed.
  for (let bend = 0; bend < 4; bend++) {
    const tx = axisTime(from.x, delta.x, min, max);
    const ty = axisTime(from.y, delta.y, min, max);
    const t = Math.max(0, Math.min(tx, ty));
    if (t >= 1) break;
    const to = { x: from.x + delta.x * t, y: from.y + delta.y * t };
    const s1 = s0 + (1 - s0) * t;
    segments.push({ from, to, s0, s1 });
    const rest = 1 - t;
    delta = {
      x: (tx <= ty ? -delta.x : delta.x) * rest,
      y: (ty <= tx ? -delta.y : delta.y) * rest,
    };
    from = to;
    s0 = s1;
  }
  segments.push({ from, to: { x: from.x + delta.x, y: from.y + delta.y }, s0, s1: 1 });
  return segments;
}

/**
 * The earliest fraction of the tick at which the minion's path touches `ball`, whose centre moves
 * in a straight line from `ballStart` to its position now. Swept on relative motion per segment
 * (ADR 0005), so a small fast minion can't skip through a ball.
 */
function hitTime(
  segments: readonly Segment[],
  minionRadius: number,
  ball: BallState,
  ballStart: Vec2,
): number | undefined {
  for (const { from, to, s0, s1 } of segments) {
    const c0 = lerp(ballStart, ball.position, s0);
    const c1 = lerp(ballStart, ball.position, s1);
    const u = sweepHitTime(
      subtract(from, c0),
      subtract(subtract(to, from), subtract(c1, c0)),
      minionRadius + ball.radius,
    );
    if (u !== undefined) return s0 + (s1 - s0) * u;
  }
  return undefined;
}

/**
 * Moves every minion one tick and resolves what it reaches (ADR 0026). Each moves like a ball:
 * straight, folded off the walls by `moveBall`, and given the same seeded turn on a bounce (one
 * draw from the world RNG per bouncing minion, in minion order). Its path is swept against every
 * live enemy ball's motion this tick; the first it touches takes its damage as the owner's ability
 * damage, and the minion pops. Minions ignore each other and their owner. One whose lifetime runs
 * out crumbles.
 */
export function resolveMinions(
  minions: readonly MinionState[],
  balls: readonly BallState[],
  startPositions: ReadonlyMap<string, Vec2>,
  definitions: DefinitionLookup,
  arenaSize: number,
  rngState: RngState,
  tick: number,
): MinionResult {
  let current = balls;
  let state = rngState;
  const remaining: MinionState[] = [];
  const events: SimEvent[] = [];
  for (const minion of minions) {
    const segments = pathSegments(
      minion.position,
      { x: minion.velocity.x * DT, y: minion.velocity.y * DT },
      minion.radius,
      arenaSize,
    );
    const moved = moveBall(minion, arenaSize);
    let { velocity } = moved.ball;
    if (moved.bounces > 0) {
      const draw = nextRange(state, -BOUNCE_MAX_HALF_TAN, BOUNCE_MAX_HALF_TAN);
      state = draw.state;
      velocity = turnBounce(velocity, draw.value, moved.bouncesX > 0, moved.bouncesY > 0);
    }
    let nearest: { readonly s: number; readonly ball: BallState } | undefined;
    for (const ball of current) {
      // A phased ball passes through minions as it passes through balls: a pop is a touch
      // (ADR 0026, 0028).
      if (
        ball.id === minion.ownerId ||
        !isAlive(ball) ||
        isPhased(ball, getDefinition(definitions, ball.definitionId))
      ) {
        continue;
      }
      const s = hitTime(
        segments,
        minion.radius,
        ball,
        startPositions.get(ball.id) ?? ball.position,
      );
      if (s !== undefined && (nearest === undefined || s < nearest.s)) nearest = { s, ball };
    }
    const base = { tick, minionId: minion.id, ownerId: minion.ownerId };
    if (nearest !== undefined) {
      const { s, ball } = nearest;
      const segment = segments.find(({ s1 }) => s <= s1) ?? segments[segments.length - 1];
      const point =
        segment === undefined
          ? minion.position
          : lerp(
              segment.from,
              segment.to,
              segment.s1 === segment.s0 ? 0 : (s - segment.s0) / (segment.s1 - segment.s0),
            );
      const hit = dealAbilityDamage(
        current,
        minion.ownerId,
        ball.id,
        minion.damage,
        definitions,
        tick,
        'minion',
      );
      current = hit.balls;
      events.push({
        type: 'minionHit',
        ...base,
        targetId: ball.id,
        point,
        amount: hit.damage?.amount ?? 0,
      });
      if (hit.damage !== undefined) events.push(hit.damage);
    } else if (minion.ticksLeft <= 1) {
      events.push({
        type: 'minionDestroyed',
        ...base,
        position: moved.ball.position,
        reason: 'lifetime',
      });
    } else {
      remaining.push({
        ...minion,
        position: moved.ball.position,
        velocity,
        ticksLeft: minion.ticksLeft - 1,
      });
    }
  }
  return { balls: current, minions: remaining, rngState: state, events };
}
