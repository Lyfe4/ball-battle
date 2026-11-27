import { describe, expect, it } from 'vitest';
import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { CRASH_DAMAGE, FIRST_WAVE_TICK, lightnessOf, poseidon } from './poseidon.ts';
import { ZONE_DAMAGE as STRIKE_DAMAGE } from './storm.ts';
import { MAX_RADIUS } from './titan.ts';

const lookup = indexDefinitions([poseidon, blue]);

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

describe('Poseidon (prototype)', () => {
  it('a standard ball is wholly light, a grown Titan barely', () => {
    expect(lightnessOf(STANDARD_BALL_RADIUS)).toBe(1);
    expect(lightnessOf(MAX_RADIUS)).toBeCloseTo(STANDARD_BALL_RADIUS / MAX_RADIUS);
  });

  it('its wave throws an enemy at the far wall, where it crashes', () => {
    // Poseidon near the left wall; the enemy right of it, moving straight down.
    const start = createWorld(1, [poseidon, blue]);
    const before = withBalls({ ...start, tick: FIRST_WAVE_TICK - 1 }, [
      { position: { x: 100, y: 500 }, velocity: { x: 0, y: poseidon.speed } },
      { position: { x: 600, y: 400 }, velocity: { x: 0, y: blue.speed } },
    ]);
    // A wave thrown right: the enemy heads for the right wall, and crashes there within 2 s.
    const after = play(before, 30);
    const thrown = after.world.balls[1];
    if (thrown === undefined) throw new Error('no ball');
    expect(thrown.velocity.x).toBeGreaterThan(blue.speed * 0.9);
    const crashes = play(after.world, 100).events.filter(
      (event) =>
        event.type === 'damage' && event.cause === 'ability' && event.targetId === 'ball-1',
    );
    expect(crashes.length).toBe(1);
  });

  it('identity: a crash is a middling hit, never a Storm-sized one, half a Storm strike at most', () => {
    expect(CRASH_DAMAGE).toBeLessThan(STRIKE_DAMAGE / 2);
  });
});
