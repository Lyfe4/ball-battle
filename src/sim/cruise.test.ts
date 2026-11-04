import { describe, expect, it } from 'vitest';
import { applyCruiseSpeed, cruiseSpeedOf } from './cruise.ts';
import { defineBall } from './define-ball.ts';
import { indexDefinitions } from './definitions.ts';
import { step } from './step.ts';
import { blue, red, run, testDefinitions, testLookup, withBalls } from './test-support.ts';
import type { BallState, Vec2 } from './types.ts';
import { createWorld } from './world.ts';

const speedOf = (velocity: Vec2 | undefined): number =>
  velocity === undefined ? NaN : Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

/** A test ball whose cruise speed is 100 per gear, set by its own ability state. */
const geared = defineBall<Readonly<{ gear: number }>>({
  id: 'geared',
  name: 'Geared',
  description: 'Test fixture: cruise speed from ability state.',
  color: '#ffffff',
  radius: 50,
  speed: 500,
  maxHealth: 100,
  contactDamage: 10,
  initialAbilityState: { gear: 3 },
  cruiseSpeed: (state) => state.gear * 100,
  hooks: {},
});

describe('cruise speed', () => {
  it('returns both balls to their own speed after a collision', () => {
    // Red (800) charges a slow-moving blue (cruise 560). The impulse trades speed between them;
    // at the end of the tick each is back at its own speed, heading where the bounce sent it.
    const world = withBalls(createWorld(1, testDefinitions), [
      { position: { x: 400, y: 500 }, velocity: { x: red.speed, y: 0 } },
      { position: { x: 540, y: 500 }, velocity: { x: 0, y: 30 } },
    ]);
    const { world: after, events } = run(world, 5);
    expect(events.some((event) => event.type === 'collision')).toBe(true);
    expect(speedOf(after.balls[0]?.velocity)).toBeCloseTo(red.speed, 9);
    expect(speedOf(after.balls[1]?.velocity)).toBeCloseTo(blue.speed, 9);
    // Red bounced back: the collision still decides the direction.
    expect(after.balls[0]?.velocity.x).toBeLessThan(0);
  });

  it('uses a definition’s own cruise speed from its ability state', () => {
    const lookup = indexDefinitions([geared, red]);
    const world = withBalls(createWorld(1, [geared, red]), [
      { position: { x: 300, y: 300 }, velocity: { x: 1, y: 0 } },
      { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
    ]);
    expect(speedOf(step(world, lookup).world.balls[0]?.velocity)).toBeCloseTo(300, 9);
    const fifth = withBalls(world, [{ abilityState: { gear: 5 } }]);
    expect(speedOf(step(fifth, lookup).world.balls[0]?.velocity)).toBeCloseTo(500, 9);
  });

  it('leaves defeated balls and balls with no direction alone', () => {
    const [a, b] = createWorld(1, testDefinitions).balls;
    if (a === undefined || b === undefined) throw new Error('expected two balls');
    const defeated: BallState = { ...a, health: 0, velocity: { x: 3, y: 4 } };
    const still: BallState = { ...b, velocity: { x: 0, y: 0 } };
    const [first, second] = applyCruiseSpeed([defeated, still], testLookup);
    expect(first).toBe(defeated);
    expect(second).toBe(still);
  });

  it('rejects a cruise speed only a bug could produce', () => {
    const [ball] = createWorld(1, [geared, red]).balls;
    if (ball === undefined) throw new Error('expected a ball');
    for (const gear of [0, -1, Number.NaN, Infinity]) {
      expect(() => cruiseSpeedOf({ ...ball, abilityState: { gear } }, geared)).toThrow(
        /invalid cruise speed/,
      );
    }
  });
});
