import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { POISON_INTERVAL_TICKS } from '../status.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { DamageEvent, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { berserker, MAX_RAGE, RAGE_DAMAGE, RAGE_PER_HIT, rageOf } from './berserker.ts';

const lookup = indexDefinitions([berserker, blue]);

/** The Berserker with `rage` stored charging a parked, very healthy blue head-on: full directness. */
function charge(rage: number): WorldState {
  return withBalls(createWorld(1, [berserker, blue]), [
    {
      position: { x: 380, y: 500 },
      velocity: { x: berserker.speed, y: 0 },
      abilityState: { rage },
    },
    { position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
  ]);
}

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

/** Every damage event the Berserker dealt in the first 30 ticks. */
function dealt(world: WorldState): DamageEvent[] {
  return play(world, 30).events.filter(
    (event): event is DamageEvent => event.type === 'damage' && event.sourceId === 'ball-0',
  );
}

/** A calm Berserker parked far from blue, poisoned by it until `expiresTick`. */
function poisoned(rage: number, expiresTick: number): WorldState {
  return withBalls(createWorld(1, [berserker, blue]), [
    {
      position: { x: 200, y: 200 },
      velocity: { x: 0, y: 0 },
      abilityState: { rage },
      statuses: [{ kind: 'poisoned', sourceId: 'ball-1', expiresTick, sinceTick: 0 }],
    },
    { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
  ]);
}

describe('Berserker', () => {
  it('stores at most MAX_RAGE hits, each worth RAGE_PER_HIT on its next bump', () => {
    expect(RAGE_DAMAGE).toBe(RAGE_PER_HIT * MAX_RAGE);
    expect(rageOf({ rage: 2 })).toBe(2);
    expect(rageOf({})).toBe(0);
  });

  it('bumps for its contact damage when calm, and RAGE_PER_HIT more for every stored hit', () => {
    for (const rage of [0, 1, MAX_RAGE]) {
      expect(dealt(charge(rage)).map((event) => event.amount)).toStrictEqual([
        Math.round(berserker.contactDamage + RAGE_PER_HIT * rage),
      ]);
    }
  });

  it('lets all its rage out through a contact hit, not a separate ability hit', () => {
    expect(dealt(charge(MAX_RAGE)).map((event) => event.cause)).toStrictEqual(['contact']);
  });

  it('spends its rage on the bump: only the hit it takes back is stored again', () => {
    // The bump spends all three; blue's own contact hit in the same bump stores one again.
    const { world } = play(charge(MAX_RAGE), 30);
    expect(rageOf(world.balls[0]?.abilityState ?? {})).toBe(1);
  });

  it('stores a hit of rage for every hit it takes, of any kind (here poison ticks)', () => {
    const start = poisoned(0, 10 * POISON_INTERVAL_TICKS);
    const rageAfter = (ticks: number) =>
      rageOf(play(start, ticks).world.balls[0]?.abilityState ?? {});
    expect(rageAfter(POISON_INTERVAL_TICKS - 1)).toBe(0);
    expect(rageAfter(POISON_INTERVAL_TICKS)).toBe(1);
    expect(rageAfter(2 * POISON_INTERVAL_TICKS)).toBe(2);
    expect(rageAfter(5 * POISON_INTERVAL_TICKS)).toBe(MAX_RAGE);
  });
});
