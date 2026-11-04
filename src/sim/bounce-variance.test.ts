import { describe, expect, it } from 'vitest';
import {
  applyBounceVariance,
  BOUNCE_MAX_ANGLE_DEGREES,
  BOUNCE_MAX_HALF_TAN,
  rotateByHalfTan,
  turnBounce,
} from './bounce-variance.ts';
import { moveBall } from './movement.ts';
import { nextRange, seedRng } from './rng.ts';
import { step } from './step.ts';
import { red, testDefinitions, testLookup, withBalls } from './test-support.ts';
import type { BallState, Vec2 } from './types.ts';
import { createWorld } from './world.ts';

/** cos(8°), precomputed: the smallest dot product a turn may leave between unit vectors. */
const COS_MAX_ANGLE = 0.9902680687415704;

const speed = (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y);
const cosBetween = (a: Vec2, b: Vec2): number => (a.x * b.x + a.y * b.y) / (speed(a) * speed(b));

describe('bounce variance', () => {
  it('uses the right precomputed constants', () => {
    // Test-only check of constants the sim can't compute itself (ADR 0001).
    /* eslint-disable no-restricted-properties */
    const halfAngle = ((BOUNCE_MAX_ANGLE_DEGREES / 2) * Math.PI) / 180;
    expect(BOUNCE_MAX_HALF_TAN).toBeCloseTo(Math.tan(halfAngle), 15);
    expect(COS_MAX_ANGLE).toBeCloseTo(Math.cos(halfAngle * 2), 15);
    /* eslint-enable no-restricted-properties */
  });

  it('keeps speed and stays within the angle limit', () => {
    let state = seedRng(3);
    for (let i = 0; i < 10_000; i++) {
      const vx = nextRange(state, -900, 900);
      const vy = nextRange(vx.state, -900, 900);
      const t = nextRange(vy.state, -BOUNCE_MAX_HALF_TAN, BOUNCE_MAX_HALF_TAN);
      state = t.state;
      const v = { x: vx.value, y: vy.value };
      const turned = rotateByHalfTan(v, t.value);
      expect(Math.abs(speed(turned) - speed(v)) / speed(v)).toBeLessThan(1e-12);
      expect(cosBetween(v, turned)).toBeGreaterThanOrEqual(COS_MAX_ANGLE - 1e-12);
    }
  });

  it('turns by exactly the maximum angle at the extremes', () => {
    const v = { x: 600, y: 0 };
    expect(cosBetween(v, rotateByHalfTan(v, BOUNCE_MAX_HALF_TAN))).toBeCloseTo(COS_MAX_ANGLE, 12);
    expect(rotateByHalfTan(v, BOUNCE_MAX_HALF_TAN).y).toBeGreaterThan(0);
    expect(rotateByHalfTan(v, -BOUNCE_MAX_HALF_TAN).y).toBeLessThan(0);
  });

  it('never turns a ball back into a wall it just bounced off', () => {
    // Bounced off the right wall, now moving left almost parallel to it: turning by +t would point
    // back right, so the turn is mirrored.
    const grazing = { x: -10, y: -600 };
    expect(rotateByHalfTan(grazing, BOUNCE_MAX_HALF_TAN).x).toBeGreaterThan(0);
    const turned = turnBounce(grazing, BOUNCE_MAX_HALF_TAN, true, false);
    expect(turned.x).toBeLessThan(0);
    expect(cosBetween(grazing, turned)).toBeCloseTo(COS_MAX_ANGLE, 9);

    // A turn can only flip an axis whose component is under |v|·sin 8°, and both can't be that
    // small at once, so one of ±t always works. The fallback only matters for a still ball.
    const corner = { x: -1e-9, y: -600 };
    const cornerTurn = turnBounce(corner, BOUNCE_MAX_HALF_TAN, true, true);
    expect(cornerTurn.x).toBeLessThan(0);
    expect(cornerTurn.y).toBeLessThan(0);
    expect(turnBounce({ x: 0, y: 0 }, BOUNCE_MAX_HALF_TAN, true, true)).toStrictEqual({
      x: 0,
      y: 0,
    });
  });

  it('draws from the world RNG only for balls that bounced', () => {
    const world = createWorld(1, testDefinitions);
    const [first, second] = world.balls;
    if (first === undefined || second === undefined) throw new Error('expected two balls');
    const none = applyBounceVariance(
      [
        { ball: first, bounces: 0, bouncesX: 0, bouncesY: 0 },
        { ball: second, bounces: 0, bouncesX: 0, bouncesY: 0 },
      ],
      world.rngState,
    );
    expect(none.rngState).toBe(world.rngState);
    expect(none.balls).toStrictEqual(world.balls);

    const one = applyBounceVariance(
      [
        { ball: first, bounces: 2, bouncesX: 1, bouncesY: 1 },
        { ball: second, bounces: 0, bouncesX: 0, bouncesY: 0 },
      ],
      world.rngState,
    );
    // One draw for the corner bounce, whatever the bounce count.
    expect(one.rngState).toBe(nextRange(world.rngState, 0, 1).state);
    expect(one.balls[0]?.position).toStrictEqual(first.position);
    expect(one.balls[1]).toBe(second);
  });

  it('keeps balls inside the arena even when every bounce turns by the maximum', () => {
    const [start] = createWorld(1, testDefinitions).balls;
    if (start === undefined) throw new Error('expected a ball');
    let ball: BallState = { ...start, velocity: { x: 4000, y: 1300 } };
    const max = 1000 - red.radius;
    for (let i = 0; i < 20_000; i++) {
      const movement = moveBall(ball, 1000);
      const t = i % 2 === 0 ? BOUNCE_MAX_HALF_TAN : -BOUNCE_MAX_HALF_TAN;
      ball =
        movement.bounces > 0
          ? {
              ...movement.ball,
              velocity: turnBounce(
                movement.ball.velocity,
                t,
                movement.bouncesX > 0,
                movement.bouncesY > 0,
              ),
            }
          : movement.ball;
      const { x, y } = ball.position;
      if (!(x >= red.radius && x <= max && y >= red.radius && y <= max)) {
        throw new Error(`left the arena at step ${i}: (${x}, ${y})`);
      }
    }
  });

  it('makes trajectories depend on the seed after a bounce', () => {
    // Same start, different world RNG: the first bounce already sends them different ways.
    const start = createWorld(1, testDefinitions);
    const placed = withBalls(start, [
      { position: { x: 945, y: 500 }, velocity: { x: 600, y: 0 } },
      { position: { x: 150, y: 850 }, velocity: { x: 0, y: 0 } },
    ]);
    const a = step(placed, testLookup).world;
    const b = step({ ...placed, rngState: placed.rngState + 1 }, testLookup).world;
    expect(a.balls[0]?.velocity).not.toStrictEqual(b.balls[0]?.velocity);
  });
});
