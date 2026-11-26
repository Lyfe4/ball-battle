import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { BUILD_TICKS, boostAfter, comet, MOST_BOOST, SPEED_SHARE } from './comet.ts';
import { frost } from './frost.ts';
import { MAX_STACKS, speedForStacks, speedster } from './speedster.ts';
import { ZONE_DAMAGE as STRIKE_DAMAGE } from './storm.ts';

const lookup = indexDefinitions([comet, blue]);

function play(world: WorldState, ticks: number): { world: WorldState; events: SimEvent[] } {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

/** The Comet's first bump on a still blue it reaches after `gap` world units of flight. */
function firstBump(gap: number) {
  const world = withBalls(createWorld(1, [comet, blue]), [
    { position: { x: 100, y: 500 }, velocity: { x: comet.speed, y: 0 } },
    { position: { x: 100 + 2 * comet.radius + gap, y: 500 }, velocity: { x: 0, y: 0 } },
  ]);
  const { events } = play(world, 240);
  const hit = events.find(
    (event) => event.type === 'damage' && event.sourceId === 'ball-0' && event.cause === 'contact',
  );
  if (hit?.type !== 'damage') throw new Error('expected the Comet to bump');
  return hit.amount;
}

describe('the Comet (prototype)', () => {
  it('builds speed while it touches nothing, up to its most', () => {
    expect(boostAfter(0)).toBe(0);
    expect(boostAfter(BUILD_TICKS / 2)).toBeCloseTo(MOST_BOOST / 2);
    expect(boostAfter(BUILD_TICKS * 3)).toBe(MOST_BOOST);
  });

  it('a bump after a long run lands harder than one at once', () => {
    expect(firstBump(700)).toBeGreaterThan(firstBump(2));
  });

  it('touching a ball spends its speed', () => {
    const world = withBalls(createWorld(1, [comet, blue]), [
      { position: { x: 100, y: 500 }, velocity: { x: comet.speed, y: 0 } },
      { position: { x: 800, y: 500 }, velocity: { x: 0, y: 0 } },
    ]);
    const { world: after, events } = play(world, 240);
    const hitAt = events.find((event) => event.type === 'damage' && event.cause === 'contact');
    expect(hitAt).toBeDefined();
    expect(after.balls[0]?.abilityState['boost']).toBeLessThan(MOST_BOOST);
  });

  it('identity: slower than one Speedster stack, under its five, never a Storm-sized bump', () => {
    expect(comet.speed).toBeLessThan(speedForStacks(speedster.speed, 1));
    expect(comet.speed).toBeGreaterThan(frost.speed);
    expect(comet.topSpeed ?? comet.speed).toBeLessThan(speedForStacks(speedster.speed, MAX_STACKS));
    expect(comet.contactDamage * (1 + SPEED_SHARE * MOST_BOOST)).toBeLessThan(STRIKE_DAMAGE);
  });
});
