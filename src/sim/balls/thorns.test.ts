import { describe, expect, it } from 'vitest';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { BallDefinition, DamageEvent, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { REFLECT_SHARE, reflectFor, thorns } from './thorns.ts';

/** Blue charging a parked, very healthy Thorns head-on, so it hits with full contact damage. */
function charge(): WorldState {
  return withBalls(createWorld(1, [thorns, blue]), [
    { position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
    { position: { x: 380, y: 500 }, velocity: { x: blue.speed, y: 0 }, health: 1_000_000 },
  ]);
}

function play(world: WorldState, definitions: readonly BallDefinition[], ticks: number) {
  const lookup = indexDefinitions(definitions);
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

const damage = (events: readonly SimEvent[]): DamageEvent[] =>
  events.filter((event): event is DamageEvent => event.type === 'damage');

describe('Thorns', () => {
  it('rounds reflection to a whole number', () => {
    for (const amount of [1, 6, 17, 26]) {
      expect(reflectFor(amount)).toBe(Math.round(amount * REFLECT_SHARE));
    }
  });

  it('reflects its share of a contact hit back at the attacker, once, as ability damage', () => {
    const { events } = play(charge(), [thorns, blue], 30);
    const [first] = damage(events);
    const hitTick = first?.tick;
    const thisTick = damage(events).filter((event) => event.tick === hitTick);
    const taken = thisTick.find(
      (event) => event.targetId === 'ball-0' && event.cause === 'contact',
    );
    expect(taken).toBeDefined();
    const reflected = thisTick.filter(
      (event) => event.targetId === 'ball-1' && event.cause === 'ability',
    );
    expect(reflected).toStrictEqual([
      expect.objectContaining({ sourceId: 'ball-0', amount: reflectFor(taken?.amount ?? 0) }),
    ]);
  });

  it('never reflects ability damage, like arrows, lightning or poison', () => {
    // A ball that deals ability damage to Thorns every tick, from a distance.
    const sniper = defineBall({
      ...blue,
      id: 'sniper-test',
      hooks: { onTick: () => [{ kind: 'damage', targetId: 'ball-0', amount: 3 }] },
    });
    const world = withBalls(createWorld(1, [thorns, sniper]), [
      { position: { x: 150, y: 150 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
      { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
    ]);
    const { events, world: after } = play(world, [thorns, sniper], 20);
    expect(damage(events).filter((event) => event.targetId === 'ball-0')).toHaveLength(20);
    expect(damage(events).filter((event) => event.targetId === 'ball-1')).toStrictEqual([]);
    expect(after.balls[1]?.health).toBe(blue.maxHealth);
  });
});
