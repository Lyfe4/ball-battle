// A ball whose size changes during a match (`radiusOf`, ADR 0034).
import { describe, expect, it } from 'vitest';
import { resolvePair } from './collision.ts';
import { defineBall } from './define-ball.ts';
import { indexDefinitions } from './definitions.ts';
import { step } from './step.ts';
import { red, withBalls } from './test-support.ts';
import type { WorldState } from './types.ts';
import { createWorld } from './world.ts';

/** A test-only ball that grows by `perTick` from radius 50, capped at `cap`. */
function grower(perTick: number, cap: number) {
  return defineBall({
    id: 'grower',
    name: 'Grower',
    description: 'Test fixture: grows every tick.',
    color: '#ffffff',
    radius: 50,
    speed: 700,
    maxHealth: 100,
    contactDamage: 10,
    initialAbilityState: {},
    hooks: {},
    radiusOf: (_self, tick) => Math.min(cap, 50 + perTick * tick),
  });
}

function play(world: WorldState, lookup: ReturnType<typeof indexDefinitions>, ticks: number) {
  let current = world;
  for (let i = 0; i < ticks; i++) current = step(current, lookup).world;
  return current;
}

describe('a ball that grows', () => {
  it('takes its radius for the tick, up to its cap, and gets heavier with it', () => {
    const ball = grower(1, 90);
    const lookup = indexDefinitions([ball, red]);
    const world = createWorld(3, [ball, red]);
    expect(world.balls[0]?.radius).toBe(50);
    expect(play(world, lookup, 10).balls[0]?.radius).toBe(60);
    expect(play(world, lookup, 200).balls[0]?.radius).toBe(90);
    // The other ball keeps its size.
    expect(play(world, lookup, 200).balls[1]?.radius).toBe(red.radius);
  });

  it('stays inside the arena when it grows against a wall', () => {
    const ball = grower(5, 120);
    const lookup = indexDefinitions([ball, red]);
    const world = withBalls(createWorld(3, [ball, red]), [
      { position: { x: 50, y: 50 }, velocity: { x: 0, y: 0 } },
      { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
    ]);
    const grown = play(world, lookup, 20).balls[0];
    expect(grown?.radius).toBe(120);
    expect(grown?.position).toStrictEqual({ x: 120, y: 120 });
  });

  it('grows into a ball beside it, and the next collision pass separates them', () => {
    const ball = grower(5, 120);
    const lookup = indexDefinitions([ball, red]);
    // Parked side by side, just touching at radius 50.
    const world = withBalls(createWorld(3, [ball, red]), [
      { position: { x: 400, y: 500 }, velocity: { x: 0, y: 0 } },
      { position: { x: 500.5, y: 500 }, velocity: { x: 0, y: 0 } },
    ]);
    const after = play(world, lookup, 3);
    const [a, b] = after.balls;
    if (a === undefined || b === undefined) throw new Error('missing balls');
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const gap = Math.sqrt(dx * dx + dy * dy);
    // Separated to touching by the collision pass (to within the growth of the last tick).
    expect(gap).toBeGreaterThanOrEqual(a.radius - 5 + b.radius - 1e-9);
    expect(Number.isFinite(a.position.x) && Number.isFinite(b.position.x)).toBe(true);
    // The heavier ball moves less in a collision: mass is r².
    const pushed = resolvePair(
      { ...a, position: { x: 400, y: 500 }, velocity: { x: 600, y: 0 } },
      { ...b, position: { x: 500, y: 500 }, velocity: { x: -600, y: 0 } },
      1000,
    );
    const changeA = Math.abs((pushed?.a.velocity.x ?? 0) - 600);
    const changeB = Math.abs((pushed?.b.velocity.x ?? 0) + 600);
    expect(changeA).toBeLessThan(changeB);
  });

  it('throws for a radius that cannot fit the arena', () => {
    const ball = grower(100, 2000);
    const lookup = indexDefinitions([ball, red]);
    expect(() => play(createWorld(3, [ball, red]), lookup, 10)).toThrow(/invalid radius/);
  });
});
