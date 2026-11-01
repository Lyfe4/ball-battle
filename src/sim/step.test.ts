import { describe, expect, it } from 'vitest';
import { blue } from './balls/blue.ts';
import { red } from './balls/red.ts';
import { DT } from './constants.ts';
import { step } from './step.ts';
import type { BallState, WorldState } from './types.ts';
import { createWorld } from './world.ts';

const definitions = [red, blue];

function run(world: WorldState, ticks: number, onTick?: (world: WorldState) => void): WorldState {
  let current = world;
  for (let i = 0; i < ticks; i++) {
    current = step(current);
    onTick?.(current);
  }
  return current;
}

function expectInsideArena(world: WorldState): void {
  for (const ball of world.balls) {
    const { x, y } = ball.position;
    const max = world.arena.size - ball.radius;
    if (!(x >= ball.radius && x <= max && y >= ball.radius && y <= max)) {
      throw new Error(`${ball.id} left the arena at tick ${world.tick}: (${x}, ${y})`);
    }
  }
}

function withBall(world: WorldState, overrides: Partial<BallState>): WorldState {
  const [first] = world.balls;
  if (first === undefined) throw new Error('expected a ball');
  return { ...world, balls: [{ ...first, ...overrides }] };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('step', () => {
  it('gives identical state after 1000 ticks for the same seed', () => {
    const first = run(createWorld(2026, definitions), 1000);
    const second = run(createWorld(2026, definitions), 1000);
    // toStrictEqual also distinguishes 0 from -0, so any divergence in float maths shows up.
    expect(second).toStrictEqual(first);
    expect(first.tick).toBe(1000);
  });

  it('diverges for different seeds', () => {
    expect(run(createWorld(1, definitions), 1000)).not.toStrictEqual(
      run(createWorld(2, definitions), 1000),
    );
  });

  it('never lets balls leave the arena', () => {
    for (let seed = 0; seed < 200; seed++) {
      run(createWorld(seed, definitions), 5000, expectInsideArena);
    }
  });

  it('keeps extremely fast balls inside the arena instead of tunnelling', () => {
    const base = createWorld(7, definitions);
    const perTick = (base.arena.size * 50) / DT;
    const velocities = [
      { x: perTick, y: perTick * 0.37 },
      { x: -perTick * 1.618, y: perTick * 3.3 },
      { x: 1e9, y: -1e9 },
      { x: 0, y: -perTick },
    ];
    for (const velocity of velocities) {
      run(withBall(base, { velocity }), 500, expectInsideArena);
    }
  });

  it('reflects off a wall and preserves speed', () => {
    const base = createWorld(1, definitions);
    const max = base.arena.size - red.radius;
    const world = withBall(base, {
      position: { x: max - 1, y: 500 },
      velocity: { x: 600, y: 0 },
    });
    const [ball] = step(world).balls;
    // Travels 10 units: 1 to reach the wall, 9 back.
    expect(ball?.position.x).toBeCloseTo(max - 9, 9);
    expect(ball?.velocity).toStrictEqual({ x: -600, y: 0 });
  });

  it('does not mutate the input world', () => {
    const world = deepFreeze(createWorld(5, definitions));
    const snapshot = structuredClone(world);
    expect(() => run(world, 100)).not.toThrow();
    expect(world).toStrictEqual(snapshot);
  });

  it('rejects non-finite velocities rather than producing NaN positions', () => {
    const world = withBall(createWorld(1, definitions), {
      velocity: { x: Number.POSITIVE_INFINITY, y: 0 },
    });
    expect(() => step(world)).toThrow(/non-finite/);
  });
});
