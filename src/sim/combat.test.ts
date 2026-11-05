import { describe, expect, it } from 'vitest';
import type { PairContact } from './collision.ts';
import {
  applyContactDamage,
  contactDamageOf,
  directnessMultiplier,
  impactDamage,
  pairKey,
} from './combat.ts';
import { MIN_IMPACT_MULTIPLIER } from './constants.ts';
import { defineBall } from './define-ball.ts';
import { indexDefinitions } from './definitions.ts';
import { step } from './step.ts';
import { blue, red, run, testDefinitions, testLookup, withBalls } from './test-support.ts';
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
      survivedLethal: false,
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
    // Two equally fast balls, overlapping and moving together: once separated they stay touching
    // (within the contact slop) for the whole run, which ends before the front one reaches a wall.
    const pair = withBalls(createWorld(1, [red, red]), [
      { position: { x: 200, y: 500 }, velocity: { x: red.speed, y: 0 } },
      { position: { x: 270, y: 500 }, velocity: { x: red.speed, y: 0 } },
    ]);
    const { world, events } = run(pair, 30);
    expect(events.filter((event) => event.type === 'damage')).toHaveLength(2);
    expect(world.contacts).toStrictEqual([pairKey('ball-0', 'ball-1')]);
  });

  it('still counts a hit after a tick that ended close but not overlapping', () => {
    // Regression: balls ending a tick within CONTACT_SLOP but not overlapping were once recorded
    // as in contact, so the real hit on the next tick dealt no damage.
    // After one tick at 300 units/s (5 units each), they end 0.4 units apart: inside the slop.
    const halfGap = (red.radius + blue.radius) / 2 + 0.2 + 5;
    const nearMiss = withBalls(base, [
      { position: { x: 500 - halfGap, y: 500 }, velocity: { x: 300, y: 0 } },
      { position: { x: 500 + halfGap, y: 500 }, velocity: { x: -300, y: 0 } },
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

  describe('directness scaling', () => {
    /** A contact between ball-0 and ball-1 with the given directness for each. */
    const contact = (directness: readonly [number, number]): PairContact => ({
      ballIds: ['ball-0', 'ball-1'],
      point: { x: 500, y: 500 },
      normal: { x: 1, y: 0 },
      impulse: 0,
      phased: false,
      approachSpeeds: [0, 0],
      directness,
    });

    it('scales by directness, clamped to the minimum and to 1', () => {
      expect(directnessMultiplier(1)).toBe(1);
      expect(directnessMultiplier(0.5)).toBe(0.5);
      expect(directnessMultiplier(0)).toBe(MIN_IMPACT_MULTIPLIER);
      expect(directnessMultiplier(-1)).toBe(MIN_IMPACT_MULTIPLIER);
      expect(directnessMultiplier(1 + 1e-12)).toBe(1);
    });

    it('deals the same head-on damage at any speed', () => {
      for (const speed of [red.speed / 4, red.speed, red.speed * 2]) {
        const charge = withBalls(base, [
          { position: { x: 400, y: 500 }, velocity: { x: speed, y: 0 } },
          { position: { x: 600, y: 500 }, velocity: { x: 0, y: 0 } },
        ]);
        const { events } = run(charge, 120);
        expect(damageTo(events, 'ball-1')[0]).toMatchObject({
          amount: red.contactDamage,
          multiplier: 1,
        });
      }
    });

    it('deals half damage for a hit at 60°', () => {
      const { damage } = applyContactDamage(base.balls, [contact([0.5, 1])], testLookup, 1);
      expect(damage.find((event) => event.targetId === 'ball-1')).toMatchObject({
        amount: impactDamage(red.contactDamage, 0.5),
        multiplier: 0.5,
      });
    });

    it('keeps the lethal tiebreak: the more direct hitter survives a mutual knockout', () => {
      // Both on 1 health. Red hits head-on (raw = full damage), blue glances (raw = minimum).
      const low = withBalls(base, [{ health: 1 }, { health: 1 }]).balls;
      const { balls, damage } = applyContactDamage(low, [contact([1, 0.3])], testLookup, 1);
      expect(balls.map((ball) => ball.health)).toStrictEqual([1, 0]);
      expect(damage.find((event) => event.targetId === 'ball-0')).toMatchObject({
        survivedLethal: true,
      });
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

describe('contactDamageOf (ADR 0015)', () => {
  // Red, but its hits grow by every point of health it is missing.
  const rager = defineBall({
    ...red,
    id: 'rager',
    contactDamageOf: (self, stats) => stats.contactDamage + (stats.maxHealth - self.health),
  });
  const lookup = indexDefinitions([rager, blue]);

  function exchange(ragerHealth: number) {
    const world = withBalls(createWorld(1, [rager, blue]), [
      { position: { x: 400, y: 500 }, velocity: { x: red.speed, y: 0 }, health: ragerHealth },
      { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);
    const events: SimEvent[] = [];
    let current = world;
    for (let i = 0; i < 60; i++) {
      const result = step(current, lookup);
      current = result.world;
      events.push(...result.events);
    }
    return events;
  }

  it('replaces contactDamage with what the ball deals in its current state', () => {
    expect(damageTo(exchange(red.maxHealth), 'ball-1')[0]?.amount).toBe(red.contactDamage);
    // 10 health missing before the exchange: 10 more damage. Blue's hit in the same exchange
    // does not count, because both hits are worked out from health before it.
    expect(damageTo(exchange(red.maxHealth - 10), 'ball-1')[0]?.amount).toBe(
      red.contactDamage + 10,
    );
  });

  it('decides the lethal-exchange tiebreak by the damage it returns', () => {
    // Rager on 2 health hits for 15 + 73 = 88: the larger raw hit, so it survives on 1 and blue,
    // whose 85 health the hit is lethal to, is knocked out.
    const events = exchange(2);
    expect(damageTo(events, 'ball-0')[0]).toMatchObject({ survivedLethal: true, healthAfter: 1 });
    expect(damageTo(events, 'ball-1')[0]).toMatchObject({ healthAfter: 0 });
  });

  it('throws for a value that is not a finite, non-negative number', () => {
    const broken = { ...rager, contactDamageOf: () => Number.NaN };
    const [ball] = createWorld(1, [broken, blue]).balls;
    if (ball === undefined) throw new Error('expected a ball');
    expect(() => contactDamageOf(ball, broken)).toThrow(/invalid contact damage/);
  });
});
