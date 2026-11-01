import { describe, expect, it } from 'vitest';
import { blue } from './balls/blue.ts';
import { red } from './balls/red.ts';
import { pairKey } from './combat.ts';
import { step } from './step.ts';
import { run, testDefinitions, testLookup, withBalls } from './test-support.ts';
import type { DamageEvent, SimEvent, WorldState } from './types.ts';
import { createWorld } from './world.ts';

const base = createWorld(1, testDefinitions);

function headOn(): WorldState {
  return withBalls(base, [
    { position: { x: 400, y: 500 }, velocity: { x: 300, y: 0 } },
    { position: { x: 600, y: 500 }, velocity: { x: -300, y: 0 } },
  ]);
}

function damageTo(events: readonly SimEvent[], targetId: string): DamageEvent[] {
  return events.filter(
    (event): event is DamageEvent => event.type === 'damage' && event.targetId === targetId,
  );
}

describe('contact damage', () => {
  it('starts every ball at full health with no contacts', () => {
    expect(base.balls.map((ball) => ball.health)).toStrictEqual([red.maxHealth, blue.maxHealth]);
    expect(base.contacts).toStrictEqual([]);
  });

  it('deals each ball the other ball’s contact damage exactly once per collision', () => {
    const { world, events } = run(headOn(), 60);
    const toRed = damageTo(events, 'ball-0');
    const toBlue = damageTo(events, 'ball-1');
    expect(toRed).toHaveLength(1);
    expect(toBlue).toHaveLength(1);
    expect(toRed[0]).toMatchObject({ sourceId: 'ball-1', amount: blue.contactDamage });
    expect(toBlue[0]).toMatchObject({ sourceId: 'ball-0', amount: red.contactDamage });
    expect(world.balls.map((ball) => ball.health)).toStrictEqual([
      red.maxHealth - blue.contactDamage,
      blue.maxHealth - red.contactDamage,
    ]);
  });

  it('orders events collision, then damage', () => {
    const { events } = run(headOn(), 60);
    expect(events.map((event) => event.type)).toStrictEqual(['collision', 'damage', 'damage']);
  });

  it('counts contact that lasts several ticks as one collision', () => {
    // Overlapping and moving together: they stay touching for the whole run.
    const together = withBalls(base, [
      { position: { x: 300, y: 500 }, velocity: { x: 120, y: 0 } },
      { position: { x: 370, y: 500 }, velocity: { x: 120, y: 0 } },
    ]);
    const { world, events } = run(together, 120);
    expect(events.filter((event) => event.type === 'damage')).toHaveLength(2);
    expect(world.contacts).toStrictEqual([pairKey('ball-0', 'ball-1')]);
  });

  it('still counts a hit after a tick that ended close but not overlapping', () => {
    // Regression: balls ending a tick within CONTACT_SLOP but not overlapping were once recorded
    // as in contact, so the real hit on the next tick dealt no damage.
    const nearMiss = withBalls(base, [
      { position: { x: 454.8, y: 500 }, velocity: { x: 300, y: 0 } },
      { position: { x: 545.2, y: 500 }, velocity: { x: -300, y: 0 } },
    ]);
    const first = step(nearMiss, testLookup);
    expect(first.world.contacts).toStrictEqual([]);
    const { events } = run(first.world, 5);
    expect(events.filter((event) => event.type === 'damage')).toHaveLength(2);
  });

  it('deals no damage when the pair was already in contact last tick', () => {
    // Approaching and overlapping, but already in contact: physics resolves it, no new hit.
    const continuing = { ...headOn(), contacts: [pairKey('ball-0', 'ball-1')] };
    const overlapping = withBalls(continuing, [
      { position: { x: 470, y: 500 } },
      { position: { x: 530, y: 500 } },
    ]);
    const { world, events } = step(overlapping, testLookup);
    expect(events).toStrictEqual([]);
    expect(world.balls[0]?.velocity.x).toBeLessThan(0);
  });

  it('defeats a ball at 0 health, which then stops moving and colliding', () => {
    const lowRed = withBalls(headOn(), [{ health: blue.contactDamage }]);
    const { world, events } = run(lowRed, 60);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'ballDefeated', ballId: 'ball-0', defeatedById: 'ball-1' }),
    );
    const [defeated] = world.balls;
    expect(defeated?.health).toBe(0);

    const later = step(world, testLookup).world;
    expect(later.balls[0]?.position).toStrictEqual(defeated?.position);
  });

  it('never takes health below 0', () => {
    const lowRed = withBalls(headOn(), [{ health: 1 }]);
    const { world, events } = run(lowRed, 60);
    expect(world.balls[0]?.health).toBe(0);
    expect(damageTo(events, 'ball-0')[0]?.amount).toBe(1);
  });
});
