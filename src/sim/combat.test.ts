import { describe, expect, it } from 'vitest';
import { blue } from './balls/blue.ts';
import { red } from './balls/red.ts';
import { impactDamage, impactMultiplier, pairKey } from './combat.ts';
import { MAX_IMPACT_MULTIPLIER, MIN_IMPACT_MULTIPLIER } from './constants.ts';
import { step } from './step.ts';
import { run, testDefinitions, testLookup, withBalls } from './test-support.ts';
import type { DamageEvent, SimEvent, WorldState } from './types.ts';
import { createWorld } from './world.ts';

const base = createWorld(1, testDefinitions);

/** Each ball charges straight at the other at its own definition speed: multiplier 1. */
function headOn(): WorldState {
  return withBalls(base, [
    { position: { x: 400, y: 500 }, velocity: { x: red.speed, y: 0 } },
    { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
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

  it('deals each ball the other ball’s contact damage once per collision at full speed', () => {
    const { world, events } = run(headOn(), 60);
    const toRed = damageTo(events, 'ball-0');
    const toBlue = damageTo(events, 'ball-1');
    expect(toRed).toHaveLength(1);
    expect(toBlue).toHaveLength(1);
    expect(toRed[0]).toMatchObject({
      sourceId: 'ball-1',
      amount: blue.contactDamage,
      multiplier: 1,
    });
    expect(toBlue[0]).toMatchObject({
      sourceId: 'ball-0',
      amount: red.contactDamage,
      multiplier: 1,
    });
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
    // Three balls, so the match keeps running after the first defeat.
    const three = createWorld(1, [red, blue, red]);
    const lowRed = withBalls(three, [
      {
        position: { x: 400, y: 500 },
        velocity: { x: red.speed, y: 0 },
        health: blue.contactDamage,
      },
      { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
      { position: { x: 850, y: 150 }, velocity: { x: 0, y: 0 } },
    ]);
    const { world, events } = run(lowRed, 30);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'ballDefeated', ballId: 'ball-0', defeatedById: 'ball-1' }),
    );
    expect(world.match.status).toBe('running');
    const [defeated] = world.balls;
    expect(defeated?.health).toBe(0);

    // A live ball driven straight through the defeated one's position passes without a hit.
    const later = run(
      withBalls(world, [{}, { position: { x: 300, y: 500 }, velocity: { x: -blue.speed, y: 0 } }]),
      30,
    );
    expect(later.world.balls[0]?.position).toStrictEqual(defeated?.position);
    expect(later.events.filter((event) => event.type === 'collision')).toStrictEqual([]);
  });

  it('never takes health below 0', () => {
    const lowRed = withBalls(headOn(), [{ health: 1 }]);
    const { world, events } = run(lowRed, 60);
    expect(world.balls[0]?.health).toBe(0);
    expect(damageTo(events, 'ball-0')[0]?.amount).toBe(1);
  });

  describe('impact scaling', () => {
    it('scales by approach speed over definition speed, clamped', () => {
      expect(impactMultiplier(red.speed, red.speed)).toBe(1);
      expect(impactMultiplier(red.speed / 2, red.speed)).toBe(0.5);
      expect(impactMultiplier(0, red.speed)).toBe(MIN_IMPACT_MULTIPLIER);
      expect(impactMultiplier(-100, red.speed)).toBe(MIN_IMPACT_MULTIPLIER);
      expect(impactMultiplier(red.speed * 10, red.speed)).toBe(MAX_IMPACT_MULTIPLIER);
    });

    it('rounds damage to whole numbers with a minimum of 1', () => {
      expect(impactDamage(10, 0.25)).toBe(3);
      expect(impactDamage(2, 0.25)).toBe(1);
      expect(impactDamage(0, 2)).toBe(0);
    });

    it('lets the ball that drove into the other hit harder', () => {
      // Red charges a stationary blue: red hits at full strength, blue only at the minimum.
      const charge = withBalls(base, [
        { position: { x: 400, y: 500 }, velocity: { x: red.speed, y: 0 } },
        { position: { x: 600, y: 500 }, velocity: { x: 0, y: 0 } },
      ]);
      const { events } = run(charge, 60);
      expect(damageTo(events, 'ball-1')[0]).toMatchObject({
        amount: red.contactDamage,
        multiplier: 1,
      });
      expect(damageTo(events, 'ball-0')[0]).toMatchObject({
        amount: impactDamage(blue.contactDamage, MIN_IMPACT_MULTIPLIER),
        multiplier: MIN_IMPACT_MULTIPLIER,
      });
    });

    it('measures speed before the bounce, so the impulse does not change the damage', () => {
      // After the impulse the stationary blue moves away from red at speed; if damage used
      // post-bounce velocities, red's multiplier would drop and blue's would change.
      const charge = withBalls(base, [
        { position: { x: 400, y: 500 }, velocity: { x: red.speed, y: 0 } },
        { position: { x: 600, y: 500 }, velocity: { x: 0, y: 0 } },
      ]);
      const { events } = run(charge, 60);
      const multipliers = events.flatMap((event) =>
        event.type === 'damage' ? [event.multiplier] : [],
      );
      expect(multipliers).toStrictEqual([MIN_IMPACT_MULTIPLIER, 1]);
    });

    it('scales a glancing hit down', () => {
      // Red moves mostly sideways past blue, clipping it: only a fraction of its speed is along
      // the normal.
      const glance = withBalls(base, [
        { position: { x: 400, y: 500 }, velocity: { x: red.speed * 0.3, y: red.speed * 0.95 } },
        { position: { x: 460, y: 560 + red.radius + blue.radius }, velocity: { x: 0, y: 0 } },
      ]);
      const { events } = run(glance, 60);
      const toBlue = damageTo(events, 'ball-1')[0];
      expect(toBlue?.multiplier).toBeGreaterThan(MIN_IMPACT_MULTIPLIER);
      expect(toBlue?.multiplier).toBeLessThan(1);
    });
  });
});
