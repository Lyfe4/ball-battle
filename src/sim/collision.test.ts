import { describe, expect, it } from 'vitest';
import { massOf, resolvePair } from './collision.ts';
import { nextRange, seedRng, type RngState } from './rng.ts';
import { step } from './step.ts';
import { run, testDefinitions, testLookup, withBalls } from './test-support.ts';
import type { BallState, Vec2, WorldState } from './types.ts';
import { createWorld } from './world.ts';

const base = createWorld(1, testDefinitions);

function headOn(speed: number): WorldState {
  return withBalls(base, [
    { position: { x: 400, y: 500 }, velocity: { x: speed, y: 0 } },
    { position: { x: 600, y: 500 }, velocity: { x: -speed, y: 0 } },
  ]);
}

function distance(a: BallState, b: BallState): number {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function momentum(balls: readonly BallState[]): Vec2 {
  return balls.reduce(
    (sum, ball) => ({
      x: sum.x + massOf(ball) * ball.velocity.x,
      y: sum.y + massOf(ball) * ball.velocity.y,
    }),
    { x: 0, y: 0 },
  );
}

function kineticEnergy(balls: readonly BallState[]): number {
  return balls.reduce(
    (sum, ball) =>
      sum + massOf(ball) * (ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y),
    0,
  );
}

/** Draws `count` values in [min, max) from the seeded PRNG. */
function draws(state: RngState, count: number, min: number, max: number): [number[], RngState] {
  const values: number[] = [];
  let current = state;
  for (let i = 0; i < count; i++) {
    const result = nextRange(current, min, max);
    values.push(result.value);
    current = result.state;
  }
  return [values, current];
}

describe('ball collisions', () => {
  it('makes balls moving towards each other collide once and separate', () => {
    // 20 ticks: enough to collide and move apart, too few to reach a wall and come back.
    const { world, events } = run(headOn(300), 20);
    const collisions = events.filter((event) => event.type === 'collision');
    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.ballIds).toStrictEqual(['ball-0', 'ball-1']);

    const [a, b] = world.balls;
    if (a === undefined || b === undefined) throw new Error('expected two balls');
    expect(a.velocity.x).toBeLessThan(0);
    expect(b.velocity.x).toBeGreaterThan(0);
    expect(distance(a, b)).toBeGreaterThan(a.radius + b.radius);
  });

  it('conserves momentum and kinetic energy', () => {
    let state = seedRng(11);
    for (let i = 0; i < 500; i++) {
      let values: number[];
      [values, state] = draws(state, 6, -1, 1);
      const [angle1 = 0, angle2 = 0, va = 0, vb = 0, vc = 0, vd = 0] = values;
      const [a, b] = base.balls;
      if (a === undefined || b === undefined) throw new Error('expected two balls');
      // Overlapping pair in the middle of the arena, away from walls.
      const gap = (a.radius + b.radius) * 0.9;
      const before = [
        { ...a, position: { x: 500, y: 500 }, velocity: { x: va * 600, y: vb * 600 } },
        {
          ...b,
          position: { x: 500 + angle1 * gap * 0.7, y: 500 + angle2 * gap * 0.7 },
          velocity: { x: vc * 600, y: vd * 600 },
        },
      ] as const;
      const resolution = resolvePair(before[0], before[1], base.arena.size);
      if (resolution === undefined) continue;
      const after = [resolution.a, resolution.b];

      const p0 = momentum(before);
      const p1 = momentum(after);
      const scale = massOf(b) * 1200;
      expect(Math.abs(p1.x - p0.x) / scale).toBeLessThan(1e-9);
      expect(Math.abs(p1.y - p0.y) / scale).toBeLessThan(1e-9);
      expect(kineticEnergy(after) / kineticEnergy(before)).toBeCloseTo(1, 9);
    }
  });

  it('never leaves balls overlapping after a step, even against walls and in corners', () => {
    let state = seedRng(23);
    const [a, b] = base.balls;
    if (a === undefined || b === undefined) throw new Error('expected two balls');
    const size = base.arena.size;
    for (let i = 0; i < 2000; i++) {
      let values: number[];
      [values, state] = draws(state, 8, 0, 1);
      const [ax = 0, ay = 0, ox = 0, oy = 0, v1 = 0, v2 = 0, v3 = 0, v4 = 0] = values;
      // Bias a quarter of the cases into corners, where walls block separation on two axes.
      const corner = i % 4 === 0;
      const positionA = {
        x: corner ? a.radius : a.radius + ax * (size - 2 * a.radius),
        y: corner ? a.radius : a.radius + ay * (size - 2 * a.radius),
      };
      const reach = a.radius + b.radius;
      const positionB = {
        x: Math.min(size - b.radius, Math.max(b.radius, positionA.x + (ox * 2 - 1) * reach)),
        y: Math.min(size - b.radius, Math.max(b.radius, positionA.y + (oy * 2 - 1) * reach)),
      };
      const world = withBalls(base, [
        { position: positionA, velocity: { x: (v1 - 0.5) * 1200, y: (v2 - 0.5) * 1200 } },
        { position: positionB, velocity: { x: (v3 - 0.5) * 1200, y: (v4 - 0.5) * 1200 } },
      ]);

      const [nextA, nextB] = step(world, testLookup).world.balls;
      if (nextA === undefined || nextB === undefined) throw new Error('expected two balls');
      if (distance(nextA, nextB) < nextA.radius + nextB.radius) {
        throw new Error(
          `case ${i}: balls still overlap by ${nextA.radius + nextB.radius - distance(nextA, nextB)}`,
        );
      }
      for (const ball of [nextA, nextB]) {
        const { x, y } = ball.position;
        expect(x >= ball.radius && x <= size - ball.radius).toBe(true);
        expect(y >= ball.radius && y <= size - ball.radius).toBe(true);
      }
    }
  });

  it('separates balls whose centres coincide exactly', () => {
    const world = withBalls(base, [
      { position: { x: 500, y: 500 }, velocity: { x: 0, y: 0 } },
      { position: { x: 500, y: 500 }, velocity: { x: 0, y: 0 } },
    ]);
    const [a, b] = step(world, testLookup).world.balls;
    if (a === undefined || b === undefined) throw new Error('expected two balls');
    expect(distance(a, b)).toBeGreaterThanOrEqual(a.radius + b.radius);
  });

  it('does not push apart balls that already move apart', () => {
    const [a, b] = base.balls;
    if (a === undefined || b === undefined) throw new Error('expected two balls');
    const resolution = resolvePair(
      { ...a, position: { x: 500, y: 500 }, velocity: { x: -100, y: 0 } },
      { ...b, position: { x: 550, y: 500 }, velocity: { x: 100, y: 0 } },
      base.arena.size,
    );
    expect(resolution?.contact.impulse).toBe(0);
    expect(resolution?.a.velocity).toStrictEqual({ x: -100, y: 0 });
  });

  it('still catches fast head-on hits below the discrete-detection limit', () => {
    // Detection is discrete (ADR 0002): balls can pass through each other once their relative
    // movement per tick exceeds the sum of their radii. 2000 units/s each way is well inside it.
    const { events } = run(headOn(2000), 10);
    expect(events.some((event) => event.type === 'collision')).toBe(true);
  });
});
