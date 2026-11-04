import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { LIFESTEAL, lifestealFor, vampire } from './vampire.ts';

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
    const start = 40;
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
    const { events } = play(headOn(40), 30);
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
    const { events } = play(headOn(40, 5), 30);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'healed', ballId: 'ball-0', amount: lifestealFor(5) }),
    );
  });

  it('heals nothing while shocked, reporting the blocked lifesteal instead', () => {
    const start = 40;
    const shocked = withBalls(headOn(start), [
      { statuses: [{ kind: 'shocked', sourceId: 'ball-1', expiresTick: 1000 }] },
    ]);
    const { world, events } = play(shocked, 30);
    const taken = events.find((event) => event.type === 'damage' && event.targetId === 'ball-0');
    expect(events.some((event) => event.type === 'healed')).toBe(false);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'healBlocked',
        ballId: 'ball-0',
        sourceId: 'ball-0',
        amount: lifestealFor(vampire.contactDamage),
        status: 'shocked',
      }),
    );
    expect(world.balls[0]?.health).toBe(start - (taken?.type === 'damage' ? taken.amount : 0));
  });

  it('heals again once the shock has expired', () => {
    // Expires on tick 5, well before the hit.
    const shocked = withBalls(headOn(40), [
      { statuses: [{ kind: 'shocked', sourceId: 'ball-1', expiresTick: 5 }] },
    ]);
    const { events } = play(shocked, 30);
    expect(events.some((event) => event.type === 'healBlocked')).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: 'healed', ballId: 'ball-0' }));
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
