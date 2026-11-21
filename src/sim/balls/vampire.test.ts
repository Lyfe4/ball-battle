import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { BallState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { defineBall } from '../define-ball.ts';
import {
  LIFESTEAL,
  lifestealFor,
  THIRST_SPEED,
  THIRST_TICKS,
  thirstyUntilOf,
  vampire,
} from './vampire.ts';

/** The `index`th ball of `world`, which a test expects to be there. */
function ballAt(world: WorldState, index: number): BallState {
  const ball = world.balls[index];
  if (ball === undefined) throw new Error(`expected ball ${String(index)}`);
  return ball;
}

const lookup = indexDefinitions([vampire, blue]);

/** Vampire charging blue head-on at its own speed, so it deals exactly its contact damage. */
function headOn(vampireHealth: number, blueHealth = blue.maxHealth): WorldState {
  return withBalls(createWorld(1, [vampire, blue]), [
    { position: { x: 380, y: 500 }, velocity: { x: vampire.speed, y: 0 }, health: vampireHealth },
    { position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 }, health: blueHealth },
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

describe('Vampire', () => {
  it('rounds lifesteal to a whole number', () => {
    for (const amount of [1, 5, 14, 23]) {
      expect(lifestealFor(amount)).toBe(Math.round(amount * LIFESTEAL));
      expect(Number.isInteger(lifestealFor(amount))).toBe(true);
    }
    expect(lifestealFor(0)).toBe(0);
  });

  it('heals by its lifesteal share of the damage it deals', () => {
    // Low enough that the heal never reaches max health.
    const start = 10;
    const { world, events } = play(headOn(start), 30);
    const dealt = events.find((event) => event.type === 'damage' && event.sourceId === 'ball-0');
    const taken = events.find((event) => event.type === 'damage' && event.targetId === 'ball-0');
    expect(dealt).toMatchObject({ amount: vampire.contactDamage });
    const heal = lifestealFor(vampire.contactDamage);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'healed',
        ballId: 'ball-0',
        sourceId: 'ball-0',
        amount: heal,
      }),
    );
    const takenAmount = taken?.type === 'damage' ? taken.amount : 0;
    expect(world.balls[0]?.health).toBe(start - takenAmount + heal);
  });

  it('heals after taking the contact hit, in the onDamageDealt phase', () => {
    const { events } = play(headOn(10), 30);
    const hitTick = events.find((event) => event.type === 'collision')?.tick;
    expect(
      events.filter((event) => event.tick === hitTick).map((event) => event.type),
    ).toStrictEqual(['collision', 'damage', 'damage', 'abilityTriggered', 'healed']);
  });

  it('never heals above max health', () => {
    // Blue's hit is tiny (standing still: minimum multiplier), so the heal would overshoot.
    const nearlyFull = vampire.maxHealth - 1;
    const { world, events } = play(headOn(nearlyFull), 30);
    const healed = events.find((event) => event.type === 'healed');
    expect(world.balls[0]?.health).toBeLessThanOrEqual(vampire.maxHealth);
    expect(healed).toMatchObject({ healthAfter: world.balls[0]?.health });
  });

  it('heals on the killing blow, for the damage actually dealt', () => {
    const { events } = play(headOn(10, 5), 30);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'healed', ballId: 'ball-0', amount: lifestealFor(5) }),
    );
  });

  it('drinks only from bumps, never from ability damage (ADR 0045)', () => {
    const drink = vampire.hooks.onDamageDealt;
    if (drink === undefined) throw new Error('the Vampire drinks in onDamageDealt');
    const self = headOn(40).balls[0];
    const context = (cause: 'contact' | 'ability') =>
      ({ self, amount: 20, cause }) as unknown as Parameters<typeof drink>[0];
    expect(drink(context('contact'))).toStrictEqual([
      { kind: 'heal', targetId: 'ball-0', amount: lifestealFor(20) },
    ]);
    expect(drink(context('ability'))).toStrictEqual([]);
  });

  it('does not heal when it deals no damage', () => {
    // Nobody touches anybody.
    const apart = withBalls(createWorld(1, [vampire, blue]), [
      { position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 }, health: 10 },
      { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
    ]);
    const { events } = play(apart, 30);
    expect(events).toStrictEqual([]);
  });
});

describe('Vampire Thirst (ADR 0077)', () => {
  /** Hits its enemy for 5 from afar on tick 10, and nothing else. */
  const sniperish = defineBall({
    ...blue,
    id: 'from-afar',
    initialAbilityState: {},
    hooks: {
      onTick: ({ world, self }) => {
        const enemy = world.balls.find((ball) => ball.id !== self.id);
        return world.tick === 10 && enemy !== undefined
          ? [{ kind: 'damage', targetId: enemy.id, amount: 5 }]
          : [];
      },
    },
  });
  const thirstLookup = indexDefinitions([vampire, sniperish, blue]);
  const apart = (other: typeof blue) =>
    withBalls(createWorld(4, [vampire, other]), [
      { position: { x: 150, y: 500 }, velocity: { x: 0, y: vampire.speed } },
      { position: { x: 850, y: 500 }, velocity: { x: 0, y: other.speed } },
    ]);
  const speedOf = (world: WorldState) => {
    const { x, y } = ballAt(world, 0).velocity;
    return Math.sqrt(x * x + y * y);
  };
  const advance = (world: WorldState, ticks: number) => {
    let current = world;
    for (let i = 0; i < ticks; i++) current = step(current, thirstLookup).world;
    return current;
  };

  it('a hit that isn’t a bump makes it THIRST_SPEED as fast for THIRST_TICKS', () => {
    const hit = advance(apart(sniperish), 11);
    expect(hit.balls[0]?.health).toBe(vampire.maxHealth - 5);
    expect(thirstyUntilOf(ballAt(hit, 0))).toBe(10 + THIRST_TICKS);
    expect(speedOf(hit)).toBeCloseTo(vampire.speed * THIRST_SPEED, 6);
    const over = advance(hit, THIRST_TICKS);
    expect(thirstyUntilOf(ballAt(over, 0))).toBe(0);
    expect(speedOf(over)).toBeCloseTo(vampire.speed, 6);
  });

  it('a bump never makes it thirsty', () => {
    const { events, world } = play(headOn(vampire.maxHealth), 30);
    expect(events.some((event) => event.type === 'damage' && event.targetId === 'ball-0')).toBe(
      true,
    );
    expect(thirstyUntilOf(ballAt(world, 0))).toBe(0);
  });
});
