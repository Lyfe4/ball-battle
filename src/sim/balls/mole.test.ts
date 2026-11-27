import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { red, withBalls } from '../test-support.ts';
import type { SimEvent, Vec2, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { BURST_DAMAGE, mole, RUMBLE_TICKS } from './mole.ts';

const lookup = indexDefinitions([mole, red]);

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

/** The Mole digging at (300, 500), its prey just beside it at (330, 500) heading along `velocity`. */
function digBeside(velocity: Vec2): WorldState {
  return withBalls(createWorld(1, [mole, red]), [
    {
      position: { x: 300, y: 500 },
      velocity: { x: 0, y: mole.speed },
      abilityState: { phase: 'dig', nextTick: 1000 },
    },
    { position: { x: 330, y: 500 }, velocity },
  ]);
}

function burstOf(events: readonly SimEvent[]) {
  const burst = events.find((event) => event.type === 'zoneStruck' && event.ownerId === 'ball-0');
  if (burst?.type !== 'zoneStruck') throw new Error('expected a burst');
  return burst;
}

describe('the Mole (prototype)', () => {
  it('bursts up under a ball that stays put, and misses one that keeps moving', () => {
    // Red is still (a zero velocity keeps no direction, so it stays put).
    const still = burstOf(play(digBeside({ x: 0, y: 0 }), RUMBLE_TICKS + 2).events);
    expect(still.hitIds).toEqual(['ball-1']);
    // The same catch, but red runs on at its speed during the rumble and is gone when it bursts.
    const moving = burstOf(play(digBeside({ x: red.speed, y: 0 }), RUMBLE_TICKS + 2).events);
    expect(moving.hitIds).toEqual([]);
  });

  it('is untouchable underground: it tunnels at its prey and passes under it', () => {
    const world = withBalls(createWorld(1, [mole, red]), [
      {
        position: { x: 200, y: 500 },
        velocity: { x: 0, y: mole.speed },
        abilityState: { phase: 'dig', nextTick: 1000 },
      },
      { position: { x: 700, y: 500 }, velocity: { x: 0, y: 0 } },
    ]);
    const { world: after, events } = play(world, 20);
    const [digger] = after.balls;
    // It turned from heading up to heading at red.
    expect(digger?.velocity.x).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'damage')).toBe(false);
    const struck = play(after, 60).events.filter(
      (event) => event.type === 'damage' && event.targetId === 'ball-1',
    );
    // Nothing reaches red from below before the burst: no bump while it tunnels under.
    const first = struck[0];
    expect(first?.type === 'damage' ? [first.cause, first.amount] : []).toEqual([
      'ability',
      BURST_DAMAGE,
    ]);
  });
});
