import { describe, expect, it } from 'vitest';
import { DT } from './constants.ts';
import { indexDefinitions } from './definitions.ts';
import { step } from './step.ts';
import { deepFreeze, red, run, testDefinitions, testLookup, withBalls } from './test-support.ts';
import type { WorldState } from './types.ts';
import { createWorld } from './world.ts';

function expectInsideArena(world: WorldState): void {
  for (const ball of world.balls) {
    const { x, y } = ball.position;
    const max = world.arena.size - ball.radius;
    if (!(x >= ball.radius && x <= max && y >= ball.radius && y <= max)) {
      throw new Error(`${ball.id} left the arena at tick ${world.tick}: (${x}, ${y})`);
    }
  }
}

describe('step', () => {
  it('gives identical state and events after 1000 ticks for the same seed', () => {
    const first = run(createWorld(2026, testDefinitions), 1000);
    const second = run(createWorld(2026, testDefinitions), 1000);
    // toStrictEqual also distinguishes 0 from -0, so any divergence in float maths shows up.
    expect(second.world).toStrictEqual(first.world);
    expect(second.events).toStrictEqual(first.events);
  });

  it('diverges for different seeds', () => {
    expect(run(createWorld(1, testDefinitions), 1000).world).not.toStrictEqual(
      run(createWorld(2, testDefinitions), 1000).world,
    );
  });

  it('never lets balls leave the arena', () => {
    for (let seed = 0; seed < 200; seed++) {
      run(createWorld(seed, testDefinitions), 5000, expectInsideArena);
    }
  });

  it('keeps extremely fast balls inside the arena instead of tunnelling', () => {
    const base = createWorld(7, testDefinitions);
    const perTick = (base.arena.size * 50) / DT;
    const velocities = [
      { x: perTick, y: perTick * 0.37 },
      { x: -perTick * 1.618, y: perTick * 3.3 },
      { x: 1e9, y: -1e9 },
      { x: 0, y: -perTick },
    ];
    for (const velocity of velocities) {
      run(withBalls(base, [{ velocity }]), 500, expectInsideArena);
    }
  });

  it('reflects off a wall and preserves speed', () => {
    const base = createWorld(1, testDefinitions);
    const max = base.arena.size - red.radius;
    const world = withBalls(base, [
      { position: { x: max - 1, y: 500 }, velocity: { x: 600, y: 0 } },
      { position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
    ]);
    const next = step(world, testLookup).world;
    const [ball] = next.balls;
    // Travels 10 units: 1 to reach the wall, 9 back. The bounce turn (ADR 0004) changes only the
    // velocity's direction, never the position or the speed.
    expect(ball?.position.x).toBeCloseTo(max - 9, 9);
    expect(ball?.velocity.x).toBeLessThan(0);
    const vx = ball?.velocity.x ?? 0;
    const vy = ball?.velocity.y ?? 0;
    expect(Math.sqrt(vx * vx + vy * vy)).toBeCloseTo(600, 9);
    expect(next.rngState).not.toBe(world.rngState);
  });

  it('does not mutate the input world', () => {
    const world = deepFreeze(createWorld(5, testDefinitions));
    const snapshot = structuredClone(world);
    expect(() => run(world, 100)).not.toThrow();
    expect(world).toStrictEqual(snapshot);
  });

  it('rejects non-finite velocities rather than producing NaN positions', () => {
    const world = withBalls(createWorld(1, testDefinitions), [
      { velocity: { x: Number.POSITIVE_INFINITY, y: 0 } },
    ]);
    expect(() => step(world, testLookup)).toThrow(/non-finite/);
  });

  it('rejects a world whose balls have no matching definition', () => {
    const world = createWorld(1, testDefinitions);
    expect(() => step(world, indexDefinitions([red]))).toThrow(/No ball definition/);
  });
});
