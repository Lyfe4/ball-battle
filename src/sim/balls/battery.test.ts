// The Battery (ADR 0056): it stores part of every big strike, blast or burst and lets it all out on
// its next bump. Fixed scenes with test-only strikers, so the numbers are the Battery's own.
import { describe, expect, it } from 'vitest';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { battery, BIG_HIT, CAPACITY, STORE_SHARE, storesHit } from './battery.ts';

/** A ball that hits the other ball once, from afar, with an ability hit of `amount` on tick 1. */
function strikerOf(amount: number) {
  return defineBall({
    id: 'striker',
    name: 'Striker',
    description: 'Test only: one ability hit on tick 1.',
    color: '#ef4444',
    radius: 50,
    speed: 600,
    maxHealth: 100,
    contactDamage: 10,
    initialAbilityState: {},
    hooks: {
      onTick: ({ world }) =>
        world.tick === 1 ? [{ kind: 'damage', targetId: 'ball-0', amount }] : [],
    },
  });
}

const still = { x: 0, y: 0 };

function play(world: WorldState, ticks: number, definitions = [battery, blue]) {
  const lookup = indexDefinitions(definitions);
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && current.match.status === 'running'; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

/** The Battery parked in a corner and a striker parked far away: only the strike acts. */
function struck(amount: number) {
  const striker = strikerOf(amount);
  const world = withBalls(createWorld(1, [battery, striker]), [
    { position: { x: 150, y: 150 }, velocity: still },
    { position: { x: 850, y: 850 }, velocity: still },
  ]);
  return play(world, 5, [battery, striker]);
}

const storedOf = (world: WorldState) => world.balls[0]?.abilityState['stored'];

describe('Battery', () => {
  it('stores a share of a big strike and takes the rest, and shows it', () => {
    const { world, events } = struck(30);
    const taken = Math.ceil(30 * (1 - STORE_SHARE));
    expect(world.balls[0]?.health).toBe(battery.maxHealth - taken);
    expect(storedOf(world)).toBe(30 - taken);
    expect(events.filter((event) => event.type === 'hitReduced')).toStrictEqual([
      expect.objectContaining({ ballId: 'ball-0', reduced: 30 - taken, rest: taken }),
    ]);
  });

  it('takes a small ability hit whole', () => {
    const { world, events } = struck(BIG_HIT - 1);
    expect(world.balls[0]?.health).toBe(battery.maxHealth - (BIG_HIT - 1));
    expect(storedOf(world)).toBe(0);
    expect(events.some((event) => event.type === 'hitReduced')).toBe(false);
  });

  it('stores only big ability hits from strikes, blasts and bursts, never bumps or shots', () => {
    expect(storesHit('zone', BIG_HIT)).toBe(true);
    expect(storesHit('onTick', BIG_HIT)).toBe(true);
    expect(storesHit('zone', BIG_HIT - 1)).toBe(false);
    expect(storesHit('contact', 100)).toBe(false);
    expect(storesHit('projectile', 100)).toBe(false);
    expect(storesHit('poison', 100)).toBe(false);
  });

  it('never stores more than its capacity', () => {
    const [first] = createWorld(1, [battery, blue]).balls;
    if (first === undefined) throw new Error('no ball');
    const full = { ...first, abilityState: { stored: CAPACITY } };
    const definition = battery.hooks.onDamageTaken;
    expect(definition).toBeDefined();
    const actions = definition?.({
      self: full,
      reduced: 20,
    } as unknown as Parameters<NonNullable<typeof definition>>[0]);
    expect(actions).toStrictEqual([{ kind: 'setAbilityState', state: { stored: CAPACITY } }]);
  });

  it('lets everything stored out on its next bump, then starts empty', () => {
    const charged = withBalls(createWorld(1, [battery, blue]), [
      { position: { x: 400, y: 500 }, velocity: still, abilityState: { stored: 12 } },
      { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);
    const plain = withBalls(charged, [{ abilityState: { stored: 0 } }, {}]);
    const hitOf = (world: WorldState) =>
      play(world, 20).events.find(
        (event) => event.type === 'damage' && event.sourceId === 'ball-0',
      );
    const withCharge = hitOf(charged);
    const without = hitOf(plain);
    expect(withCharge?.type === 'damage' && without?.type === 'damage').toBe(true);
    if (withCharge?.type !== 'damage' || without?.type !== 'damage') return;
    expect(withCharge.amount).toBeGreaterThan(without.amount);
    expect(storedOf(play(charged, 20).world)).toBe(0);
  });

  it('stores nothing from a bump', () => {
    const { world, events } = play(
      withBalls(createWorld(1, [battery, blue]), [
        { position: { x: 400, y: 500 }, velocity: still },
        { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
      ]),
      20,
    );
    expect(world.balls[0]?.health).toBeLessThan(battery.maxHealth);
    expect(storedOf(world)).toBe(0);
    expect(events.some((event) => event.type === 'hitReduced')).toBe(false);
  });
});
