import { describe, expect, it } from 'vitest';
import { cruiseSpeedOf } from './cruise.ts';
import { defineBall } from './define-ball.ts';
import { indexDefinitions } from './definitions.ts';
import {
  isPoisonTick,
  POISON_DAMAGE,
  POISON_INTERVAL_TICKS,
  SLOW_FACTOR,
  type StatusKind,
  type StatusState,
} from './status.ts';
import { step } from './step.ts';
import { blue, red, withBalls } from './test-support.ts';
import type { BallState, DamageEvent, SimEvent, WorldState } from './types.ts';
import { createWorld } from './world.ts';

type ApplierState = Readonly<{ applyOn: readonly number[]; dealt: number }>;

/**
 * A test-only ball that applies `kind` to ball-1 for `duration` ticks on each tick listed in its
 * state, and counts the damage its onDamageDealt sees.
 */
function applier(kind: StatusKind, duration: number, applyOn: readonly number[]) {
  return defineBall<ApplierState>({
    ...red,
    id: 'applier',
    name: 'Applier',
    initialAbilityState: { applyOn, dealt: 0 },
    hooks: {
      onTick: ({ world, self }) =>
        self.abilityState.applyOn.includes(world.tick)
          ? [{ kind: 'applyStatus', targetId: 'ball-1', status: kind, durationTicks: duration }]
          : [],
      onDamageDealt: ({ self, amount }) => [
        {
          kind: 'setAbilityState',
          state: { ...self.abilityState, dealt: self.abilityState.dealt + amount },
        },
      ],
    },
  });
}

/** The applier and a very healthy blue, parked far apart so only the status acts. */
function parked(definition: ReturnType<typeof applier>, blueVelocity = { x: 0, y: 0 }) {
  return withBalls(createWorld(1, [definition, blue]), [
    { position: { x: 150, y: 150 }, velocity: { x: 0, y: 0 } },
    { position: { x: 700, y: 700 }, velocity: blueVelocity, health: 1_000_000 },
  ]);
}

function play(world: WorldState, definition: ReturnType<typeof applier>, ticks: number) {
  const lookup = indexDefinitions([definition, blue]);
  let current = world;
  const events: SimEvent[] = [];
  const speeds: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
    const { x, y } = current.balls[1]?.velocity ?? { x: 0, y: 0 };
    speeds.push(Math.sqrt(x * x + y * y));
  }
  return { world: current, events, speeds };
}

const poisonTicks = (events: readonly SimEvent[]): number[] =>
  events
    .filter((event): event is DamageEvent => event.type === 'damage' && event.cause === 'ability')
    .map((event) => event.tick);

function ball(statuses: readonly StatusState[]): BallState {
  const [first] = createWorld(1, [red, blue]).balls;
  if (first === undefined) throw new Error('expected a ball');
  return { ...first, statuses };
}

describe('slowed', () => {
  it('lowers cruise speed by SLOW_FACTOR, from any cruise speed', () => {
    const slowed = ball([{ kind: 'slowed', sourceId: 'x', expiresTick: 9, sinceTick: 1 }]);
    expect(cruiseSpeedOf(slowed, red)).toBeCloseTo(red.speed * (1 - SLOW_FACTOR), 10);
    const fast = defineBall({ ...red, cruiseSpeed: () => 1000 });
    expect(cruiseSpeedOf(slowed, fast)).toBeCloseTo(1000 * (1 - SLOW_FACTOR), 10);
    expect(cruiseSpeedOf(ball([]), red)).toBe(red.speed);
  });

  it('slows a moving ball while active and returns it to full speed on expiry', () => {
    const definition = applier('slowed', 20, [5]);
    const { speeds } = play(parked(definition, { x: blue.speed, y: 0 }), definition, 40);
    const slow = blue.speed * (1 - SLOW_FACTOR);
    // Tick n is speeds[n - 1]. Applied on tick 5, so active through tick 24, gone on tick 25.
    expect(speeds[3]).toBeCloseTo(blue.speed, 6);
    for (let tick = 5; tick <= 24; tick++) expect(speeds[tick - 1]).toBeCloseTo(slow, 6);
    expect(speeds[24]).toBeCloseTo(blue.speed, 6);
    expect(speeds[39]).toBeCloseTo(blue.speed, 6);
  });
});

describe('poisoned', () => {
  it('ticks only on whole intervals after it was first applied', () => {
    expect(isPoisonTick(10, 10)).toBe(false);
    expect(isPoisonTick(10, 10 + POISON_INTERVAL_TICKS - 1)).toBe(false);
    expect(isPoisonTick(10, 10 + POISON_INTERVAL_TICKS)).toBe(true);
    expect(isPoisonTick(10, 10 + POISON_INTERVAL_TICKS * 3)).toBe(true);
    expect(isPoisonTick(10, 5)).toBe(false);
  });

  it('deals its source’s ability damage on its interval and stops at expiry', () => {
    const duration = POISON_INTERVAL_TICKS * 3 + 5;
    const definition = applier('poisoned', duration, [2]);
    const { events, world } = play(parked(definition), definition, duration + 60);
    expect(poisonTicks(events)).toStrictEqual([
      2 + POISON_INTERVAL_TICKS,
      2 + POISON_INTERVAL_TICKS * 2,
      2 + POISON_INTERVAL_TICKS * 3,
    ]);
    const damage = events.filter((event) => event.type === 'damage');
    for (const event of damage) {
      expect(event).toMatchObject({
        sourceId: 'ball-0',
        targetId: 'ball-1',
        amount: POISON_DAMAGE,
      });
    }
    expect(world.balls[1]?.statuses).toStrictEqual([]);
  });

  it('expiring on a due tick deals nothing that tick', () => {
    const definition = applier('poisoned', POISON_INTERVAL_TICKS, [2]);
    const { events } = play(parked(definition), definition, POISON_INTERVAL_TICKS * 3);
    expect(poisonTicks(events)).toStrictEqual([]);
  });

  it('refreshes rather than stacks: one entry, one damage per interval, the same rhythm', () => {
    const every = POISON_INTERVAL_TICKS;
    const refreshes = [2, every - 10, every - 5, every + 6, 2 * every - 1];
    const definition = applier('poisoned', every + 10, refreshes);
    const { events } = play(parked(definition), definition, 6 * every);
    // First applied on tick 2; every refresh keeps that rhythm and extends it to the last
    // refresh + every + 10, so it ticks three times.
    expect(poisonTicks(events)).toStrictEqual([2 + every, 2 + 2 * every, 2 + 3 * every]);
    const applied = events.filter((event) => event.type === 'statusApplied');
    expect(applied.map((event) => event.refreshed)).toStrictEqual([false, true, true, true, true]);
  });

  it('fires its source’s onDamageDealt with the poison damage', () => {
    const definition = applier('poisoned', POISON_INTERVAL_TICKS * 3 + 5, [1]);
    const { world, events } = play(parked(definition), definition, POISON_INTERVAL_TICKS * 4);
    expect(world.balls[0]?.abilityState['dealt']).toBe(3 * POISON_DAMAGE);
    expect(events.filter((event) => event.type === 'abilityTriggered')).toContainEqual({
      type: 'abilityTriggered',
      tick: 1 + POISON_INTERVAL_TICKS,
      ballId: 'ball-0',
      hook: 'onDamageDealt',
    });
  });

  it('never takes a defeated ball below 0 or keeps ticking on it', () => {
    const definition = applier('poisoned', POISON_INTERVAL_TICKS * 6, [1]);
    const world = withBalls(parked(definition), [{}, { health: POISON_DAMAGE + 1 }]);
    const { events, world: after } = play(world, definition, POISON_INTERVAL_TICKS * 6);
    expect(poisonTicks(events)).toStrictEqual([
      1 + POISON_INTERVAL_TICKS,
      1 + 2 * POISON_INTERVAL_TICKS,
    ]);
    expect(after.balls[1]?.health).toBe(0);
  });
});
