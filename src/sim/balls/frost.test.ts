import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { SLOW_FACTOR } from '../status.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { frost, SLOW_TICKS } from './frost.ts';

const lookup = indexDefinitions([frost, blue]);

/** Frost charging a parked, very healthy blue head-on. */
function charge(): WorldState {
  return withBalls(createWorld(1, [frost, blue]), [
    { position: { x: 380, y: 500 }, velocity: { x: frost.speed, y: 0 } },
    { position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
  ]);
}

function play(world: WorldState, ticks: number, onTick?: (world: WorldState) => void) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
    onTick?.(current);
  }
  return { world: current, events };
}

const speedOf = (world: WorldState, index: number): number => {
  const { x, y } = world.balls[index]?.velocity ?? { x: 0, y: 0 };
  return Math.sqrt(x * x + y * y);
};

describe('Frost', () => {
  it('slows a ball it touches from the contact tick, for SLOW_TICKS', () => {
    const slowedOn: number[] = [];
    const { events } = play(charge(), 30 + SLOW_TICKS + 5, (world) => {
      if (world.balls[1]?.statuses.some((status) => status.kind === 'slowed') === true) {
        slowedOn.push(world.tick);
      }
      expect(world.balls[0]?.statuses).toStrictEqual([]);
    });
    const hit = events.find((event) => event.type === 'collision');
    expect(hit).toBeDefined();
    // The first contact slows; any later contacts only refresh it.
    expect(slowedOn[0]).toBe(hit?.tick);
    const applied = events.filter((event) => event.type === 'statusApplied');
    expect(applied[0]).toMatchObject({
      ballId: 'ball-1',
      sourceId: 'ball-0',
      status: 'slowed',
      expiresTick: (hit?.tick ?? 0) + SLOW_TICKS,
      refreshed: false,
    });
  });

  it('makes the slowed ball cruise slower, and full speed again once it wears off', () => {
    // Frost may catch the slowed ball again and refresh it, so check every tick against its state.
    let slowTicks = 0;
    let fullTicks = 0;
    play(charge(), 30 + SLOW_TICKS * 3, (world) => {
      const target = world.balls[1];
      if (target === undefined || speedOf(world, 1) === 0) return;
      if (target.statuses.some((status) => status.kind === 'slowed')) {
        expect(speedOf(world, 1)).toBeCloseTo(blue.speed * (1 - SLOW_FACTOR), 6);
        slowTicks++;
      } else {
        expect(speedOf(world, 1)).toBeCloseTo(blue.speed, 6);
        fullTicks++;
      }
    });
    expect(slowTicks).toBeGreaterThanOrEqual(SLOW_TICKS);
    expect(fullTicks).toBeGreaterThan(0);
  });
});
