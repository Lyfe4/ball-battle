import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { DamageEvent, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { berserker, RAGE_DAMAGE, rageFor } from './berserker.ts';

const lookup = indexDefinitions([berserker, blue]);

/** The Berserker on `health` charging a parked, very healthy blue head-on: full directness. */
function charge(health: number): WorldState {
  return withBalls(createWorld(1, [berserker, blue]), [
    { position: { x: 380, y: 500 }, velocity: { x: berserker.speed, y: 0 }, health },
    { position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
  ]);
}

/** Every damage event the Berserker dealt in the first 30 ticks. */
function dealt(world: WorldState): DamageEvent[] {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < 30; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return events.filter(
    (event): event is DamageEvent => event.type === 'damage' && event.sourceId === 'ball-0',
  );
}

describe('Berserker', () => {
  it('rages in step with its missing health, from nothing to RAGE_DAMAGE', () => {
    expect(rageFor(80, 80)).toBe(0);
    expect(rageFor(40, 80)).toBe(RAGE_DAMAGE / 2);
    expect(rageFor(0, 80)).toBe(RAGE_DAMAGE);
    expect(rageFor(120, 80)).toBe(0);
  });

  it('hits for its contact damage at full health and harder the more it has lost', () => {
    const full = berserker.maxHealth;
    const half = Math.round(full / 2);
    expect(dealt(charge(full)).map((event) => event.amount)).toStrictEqual([
      berserker.contactDamage,
    ]);
    expect(dealt(charge(half)).map((event) => event.amount)).toStrictEqual([
      Math.round(berserker.contactDamage + rageFor(half, full)),
    ]);
    expect(dealt(charge(1)).map((event) => event.amount)).toStrictEqual([
      Math.round(berserker.contactDamage + rageFor(1, full)),
    ]);
  });

  it('rages through its contact hit, not a separate ability hit', () => {
    expect(dealt(charge(1)).map((event) => event.cause)).toStrictEqual(['contact']);
  });
});
