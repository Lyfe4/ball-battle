import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { DamageEvent, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { scorpion, STING_DAMAGE, STING_REACH } from './scorpion.ts';

const lookup = indexDefinitions([scorpion, blue]);

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

const damage = (events: readonly SimEvent[]): DamageEvent[] =>
  events.filter((event): event is DamageEvent => event.type === 'damage');

/** A parked Scorpion and blue heading straight at it from `gap` away, edge to edge. */
function approach(gap: number): WorldState {
  const world = withBalls(createWorld(1, [scorpion, blue]), [
    { position: { x: 300, y: 500 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
    { position: { x: 400 + gap, y: 500 }, velocity: { x: -blue.speed, y: 0 }, health: 1_000_000 },
  ]);
  // Ready to sting from the first tick.
  return {
    ...world,
    balls: world.balls.map((ball) =>
      ball.id === 'ball-0'
        ? { ...ball, abilityState: { readyTick: 0, stungTick: -1, stungX: 0, stungY: 0 } }
        : ball,
    ),
  };
}

describe('Scorpion', () => {
  it('stings a ball that comes within reach before they touch', () => {
    const events = play(approach(STING_REACH + 60), 30);
    const firstContact = events.find(
      (event) => event.type === 'damage' && event.cause === 'contact',
    )?.tick;
    const stings = damage(events).filter(
      (event) => event.sourceId === 'ball-0' && event.cause === 'ability',
    );
    expect(firstContact).toBeDefined();
    expect(stings[0]).toMatchObject({ targetId: 'ball-1', amount: STING_DAMAGE });
    expect(stings[0]?.tick).toBeLessThan(firstContact ?? 0);
  });

  it('never stings a ball that stays out of reach', () => {
    const world = withBalls(createWorld(1, [scorpion, blue]), [
      { position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
      { position: { x: 200, y: 200 + 100 + STING_REACH + 40 }, velocity: { x: 0, y: 0 } },
    ]);
    const stings = damage(play(world, 120)).filter((event) => event.cause === 'ability');
    expect(stings).toStrictEqual([]);
  });
});
