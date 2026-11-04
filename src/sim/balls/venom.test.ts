import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { POISON_DAMAGE, POISON_INTERVAL_TICKS } from '../status.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { POISON_TICKS, venom } from './venom.ts';

const lookup = indexDefinitions([venom, blue]);

/** Venom charging a parked, very healthy blue head-on. */
function charge(): WorldState {
  return withBalls(createWorld(1, [venom, blue]), [
    { position: { x: 380, y: 500 }, velocity: { x: venom.speed, y: 0 } },
    { position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
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

describe('Venom', () => {
  it('poisons a ball it touches, for POISON_TICKS from the contact', () => {
    const { events } = play(charge(), 40);
    const hit = events.find((event) => event.type === 'collision');
    expect(hit).toBeDefined();
    expect(events.find((event) => event.type === 'statusApplied')).toMatchObject({
      tick: hit?.tick,
      ballId: 'ball-1',
      sourceId: 'ball-0',
      status: 'poisoned',
      expiresTick: (hit?.tick ?? 0) + POISON_TICKS,
      refreshed: false,
    });
  });

  it('deals poison as its own ability damage on the poison rhythm', () => {
    const { events } = play(charge(), 30 + POISON_TICKS);
    const hit = events.find((event) => event.type === 'collision');
    const poison = events.filter(
      (event) =>
        event.type === 'damage' && event.cause === 'ability' && event.sourceId === 'ball-0',
    );
    expect(poison.length).toBeGreaterThan(0);
    expect(poison[0]).toMatchObject({ tick: (hit?.tick ?? 0) + POISON_INTERVAL_TICKS });
    for (const event of poison) expect(event).toMatchObject({ amount: POISON_DAMAGE });
  });

  it('never poisons itself', () => {
    const { world } = play(charge(), 30 + POISON_TICKS);
    expect(world.balls[0]?.statuses).toStrictEqual([]);
  });
});
