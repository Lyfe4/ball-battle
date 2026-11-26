import { describe, expect, it } from 'vitest';
import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { CRASH_DAMAGE, lightnessOf, nearestWallPoint, ram } from './ram.ts';
import { ZONE_DAMAGE as STRIKE_DAMAGE } from './storm.ts';
import { MAX_RADIUS } from './titan.ts';

const lookup = indexDefinitions([ram, blue]);

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

describe('the Ram (prototype)', () => {
  it('a standard ball is wholly light, a grown Titan barely', () => {
    expect(lightnessOf(STANDARD_BALL_RADIUS)).toBe(1);
    expect(lightnessOf(30)).toBe(1);
    expect(lightnessOf(MAX_RADIUS)).toBeCloseTo(STANDARD_BALL_RADIUS / MAX_RADIUS);
  });

  it('throws toward the nearest wall', () => {
    const ball = createWorld(1, [ram, blue]).balls[1];
    if (ball === undefined) throw new Error('no ball');
    expect(nearestWallPoint({ ...ball, position: { x: 120, y: 500 } }, 1000)).toEqual({
      x: 0,
      y: 500,
    });
    expect(nearestWallPoint({ ...ball, position: { x: 500, y: 900 } }, 1000)).toEqual({
      x: 500,
      y: 1000,
    });
  });

  it('a ball it bumps crashes when it hits a wall soon after, and not without a bump', () => {
    const crashes = (rammed: boolean) => {
      const world = withBalls(createWorld(1, [ram, blue]), [
        {
          position: { x: rammed ? 500 : 900, y: 500 },
          velocity: { x: rammed ? -ram.speed : ram.speed, y: 0 },
        },
        { position: { x: 300, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
      ]);
      return play(world, 60).filter(
        (event) =>
          event.type === 'damage' && event.cause === 'ability' && event.targetId === 'ball-1',
      ).length;
    };
    expect(crashes(true)).toBe(1);
    expect(crashes(false)).toBe(0);
  });

  it('identity: a crash is a middling hit, never a Storm-sized one, even at the Battery’s speed', () => {
    expect((CRASH_DAMAGE * 870) / 770).toBeLessThan(STRIKE_DAMAGE / 2);
  });
});
