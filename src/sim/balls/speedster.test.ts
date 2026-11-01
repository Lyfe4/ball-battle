import { describe, expect, it } from 'vitest';
import { DT } from '../constants.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { BallState, SimEvent, Vec2, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { DAMAGE_PER_STACK, MAX_STACKS, speedForStacks, speedster, stacksOf } from './speedster.ts';

const lookup = indexDefinitions([speedster, blue]);

function first(world: WorldState): BallState {
  const [ball] = world.balls;
  if (ball === undefined) throw new Error('expected a ball');
  return ball;
}
const right = 1000 - speedster.radius;

function speedOf(velocity: Vec2 | undefined): number {
  return velocity === undefined
    ? NaN
    : Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
}

/** Speedster at (x, y) moving (vx, vy) with `stacks`; blue parked in the far corner by default. */
function setup(
  x: number,
  y: number,
  vx: number,
  vy: number,
  stacks: number,
  other: Partial<{ x: number; y: number; vx: number; vy: number }> = {},
): WorldState {
  return withBalls(createWorld(1, [speedster, blue]), [
    { position: { x, y }, velocity: { x: vx, y: vy }, abilityState: { stacks } },
    {
      position: { x: other.x ?? 150, y: other.y ?? 850 },
      velocity: { x: other.vx ?? 0, y: other.vy ?? 0 },
    },
  ]);
}

function play(world: WorldState, ticks: number) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

describe('Speedster', () => {
  it('starts with no stacks', () => {
    expect(stacksOf(first(createWorld(1, [speedster, blue])))).toBe(0);
  });

  it('gains a stack and speed on each wall bounce', () => {
    const { world, events } = play(setup(right - 2, 500, speedster.speed, 0, 0), 1);
    const self = first(world);
    expect(stacksOf(self)).toBe(1);
    expect(speedOf(self.velocity)).toBeCloseTo(speedForStacks(speedster.speed, 1), 9);
    expect(self.velocity.x).toBeLessThan(0);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'abilityTriggered', hook: 'onWallHit' }),
    );
  });

  it('gains two stacks from a corner bounce', () => {
    const corner = setup(right - 2, right - 2, speedster.speed, speedster.speed, 1);
    expect(stacksOf(first(play(corner, 1).world))).toBe(3);
  });

  it('stops at the cap', () => {
    const nearCap = setup(right - 2, right - 2, speedster.speed, speedster.speed, MAX_STACKS - 1);
    const { world } = play(nearCap, 1);
    expect(stacksOf(first(world))).toBe(MAX_STACKS);
    expect(speedOf(world.balls[0]?.velocity)).toBeCloseTo(
      speedForStacks(speedster.speed, MAX_STACKS),
      9,
    );

    // At the cap a bounce changes nothing and triggers nothing.
    const capped = setup(right - 2, 500, speedster.speed, 0, MAX_STACKS);
    const result = play(capped, 1);
    expect(stacksOf(first(result.world))).toBe(MAX_STACKS);
    expect(result.events).toStrictEqual([]);
  });

  it('cashes stacks in as bonus damage on a hit, then resets stacks and speed', () => {
    const stacks = 3;
    const charging = setup(400, 500, speedster.speed, 0, stacks, { x: 600, y: 500 });
    const { world, events } = play(charging, 30);
    const toBlue = events.filter((event) => event.type === 'damage' && event.targetId === 'ball-1');
    expect(toBlue).toStrictEqual([
      expect.objectContaining({ cause: 'contact', amount: speedster.contactDamage }),
      expect.objectContaining({ cause: 'ability', amount: stacks * DAMAGE_PER_STACK }),
    ]);
    const self = first(world);
    expect(stacksOf(self)).toBe(0);
    // Reset to base speed straight after the hit (nothing else touched it in this run).
    expect(speedOf(self.velocity)).toBeCloseTo(speedster.speed, 9);
  });

  it('deals no bonus damage with no stacks', () => {
    const { events } = play(setup(400, 500, speedster.speed, 0, 0, { x: 600, y: 500 }), 30);
    expect(events.some((event) => event.type === 'damage' && event.cause === 'ability')).toBe(
      false,
    );
  });

  it('keeps its capped speed far below the pass-through limit', () => {
    // ADR 0002: discrete detection misses a hit when the closing distance per tick exceeds the sum
    // of radii. Even head-on against a ball as fast as itself, the capped Speedster stays under
    // half that limit against the smallest possible partner (another Speedster).
    const capped = speedForStacks(speedster.speed, MAX_STACKS);
    const limit = (speedster.radius * 2) / DT;
    expect(capped * 2).toBeLessThan(limit / 2);
  });
});
