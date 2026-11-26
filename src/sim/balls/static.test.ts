import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { CHARGE_TO_SPARK, SPARK_DAMAGE, SPARK_RADIUS, staticBall } from './static.ts';
import { ZONE_DAMAGE as STRIKE_DAMAGE } from './storm.ts';
import { WAIL_DAMAGE, WAIL_RADIUS } from './banshee.ts';

const lookup = indexDefinitions([staticBall, blue]);

function play(world: WorldState, ticks: number): SimEvent[] {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return events;
}

describe('the Static (prototype)', () => {
  it('sparks on every CHARGE_TO_SPARKth hit it takes, and not before', () => {
    // A blue bouncing between the Static and a wall: count its bumps and the sparks.
    const world = withBalls(createWorld(1, [staticBall, blue]), [
      { position: { x: 500, y: 500 }, velocity: { x: 0, y: 0 } },
      { position: { x: 700, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);
    const events = play(world, 600);
    const taken = events.filter(
      (event) =>
        event.type === 'damage' && event.cause === 'contact' && event.targetId === 'ball-0',
    ).length;
    const sparks = events.filter(
      (event) =>
        event.type === 'damage' && event.cause === 'ability' && event.targetId === 'ball-1',
    );
    expect(taken).toBeGreaterThanOrEqual(CHARGE_TO_SPARK);
    expect(sparks.length).toBe(Math.floor(taken / CHARGE_TO_SPARK));
    for (const spark of sparks)
      if (spark.type === 'damage') expect(spark.amount).toBe(SPARK_DAMAGE);
  });

  it('identity: a spark is smaller and nearer than the wail, far under the Storm’s strike', () => {
    expect(SPARK_DAMAGE).toBeLessThan(WAIL_DAMAGE);
    expect(SPARK_RADIUS).toBeLessThanOrEqual(WAIL_RADIUS);
    expect(SPARK_DAMAGE).toBeLessThan(STRIKE_DAMAGE / 2);
  });
});
