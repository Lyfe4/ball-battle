// The Boomerang, Bomber, Guardian and Bloom (ADR 0043, 0045): each ball's own mechanic, on fixed
// scenes.
import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import { POISON_DAMAGE, POISON_INTERVAL_TICKS } from '../status.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { bloom, FIRST_HEAL_TICK, HEAL_AMOUNT, HEAL_EVERY_TICKS } from './bloom.ts';
import { BLAST_DAMAGE, bomber, DROP_TICKS, FIRST_DROP_TICK, FUSE_TICKS } from './bomber.ts';
import { boomerang, COOLDOWN_TICKS, FIRST_THROW_TICK } from './boomerang.ts';
import { ARMOR, armoredHit, guardian } from './guardian.ts';

const lookup = indexDefinitions([boomerang, bomber, guardian, bloom, red, blue]);

function play(world: WorldState, ticks: number) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && current.match.status === 'running'; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

const still = { x: 0, y: 0 };
const ofType = <T extends SimEvent['type']>(events: readonly SimEvent[], type: T) =>
  events.filter((event): event is Extract<SimEvent, { type: T }> => event.type === type);

/** `definition` parked at (200, 200) and a parked blue far off, so nothing touches. */
function parked(definition: typeof red): WorldState {
  return withBalls(createWorld(1, [definition, blue]), [
    { position: { x: 200, y: 200 }, velocity: still },
    { position: { x: 800, y: 800 }, velocity: still },
  ]);
}

describe('Boomerang', () => {
  it('throws a returning boomerang, and only once the last one is home', () => {
    const { events } = play(parked(boomerang), FIRST_THROW_TICK + COOLDOWN_TICKS * 2);
    const thrown = ofType(events, 'projectileFired');
    expect(thrown[0]?.tick).toBe(FIRST_THROW_TICK);
    // Every throw ends in a catch before the next one is thrown.
    const ends = ofType(events, 'projectileExpired');
    expect(thrown.length).toBeGreaterThanOrEqual(2);
    for (const [index, next] of thrown.slice(1).entries()) {
      const end = ends[index];
      expect(end?.reason).toBe('caught');
      expect(end?.tick ?? Infinity).toBeLessThan(next.tick);
      expect(next.tick - (thrown[index]?.tick ?? 0)).toBeGreaterThanOrEqual(COOLDOWN_TICKS);
    }
  });

  it('waits to throw again while its boomerang is still out', () => {
    // Just after the first throw, the boomerang is sent far off on a long way out: when the next
    // throw comes due it is still in the air, so the Boomerang holds it until the catch.
    const thrown = play(parked(boomerang), FIRST_THROW_TICK).world;
    const [flying] = thrown.projectiles;
    if (flying?.returning === undefined) throw new Error('no boomerang');
    const away = {
      ...thrown,
      projectiles: [
        {
          ...flying,
          position: { x: 900, y: 900 },
          velocity: { x: 1, y: 1 },
          returning: { ...flying.returning, turnTick: FIRST_THROW_TICK + COOLDOWN_TICKS + 20 },
        },
      ],
    };
    const { events } = play(away, COOLDOWN_TICKS + 10);
    expect(ofType(events, 'projectileFired')).toStrictEqual([]);
  });
});

describe('Bomber', () => {
  it('drops a bomb on a fixed rhythm that goes off by itself after its fuse', () => {
    const { events } = play(parked(bomber), FIRST_DROP_TICK + Math.max(FUSE_TICKS, DROP_TICKS) + 1);
    const dropped = ofType(events, 'zoneSpawned');
    expect(dropped.map((zone) => zone.tick).slice(0, 2)).toStrictEqual([
      FIRST_DROP_TICK,
      FIRST_DROP_TICK + DROP_TICKS,
    ]);
    expect(ofType(events, 'zoneStruck')[0]).toMatchObject({ tick: FIRST_DROP_TICK + FUSE_TICKS });
  });

  it('blows a bomb at once when an enemy ball runs into it', () => {
    // Once the first bomb is down at (200, 200), the Bomber moves off and blue is put on the bomb:
    // it goes off as soon as it arms.
    const dropped = play(parked(bomber), FIRST_DROP_TICK).world;
    const scene = withBalls(dropped, [
      { position: { x: 800, y: 200 }, velocity: still },
      { position: { x: 200, y: 240 }, velocity: still },
    ]);
    const { world, events } = play(scene, FUSE_TICKS);
    const strike = ofType(events, 'zoneStruck')[0];
    expect(strike).toMatchObject({ triggeredBy: 'ball-1', hitIds: ['ball-1'] });
    expect(strike?.tick).toBeLessThan(FIRST_DROP_TICK + FUSE_TICKS);
    expect(world.balls[1]?.health).toBe(blue.maxHealth - BLAST_DAMAGE);
  });
});

describe('Guardian', () => {
  it('takes ARMOR off every hit, but never more than half of a small one', () => {
    expect(armoredHit(26)).toBe(26 - ARMOR);
    expect(armoredHit(10)).toBe(10 - ARMOR);
    expect(armoredHit(5)).toBe(Math.ceil(5 / 2));
    expect(armoredHit(2)).toBe(1);
    expect(armoredHit(1)).toBe(1);
  });

  /** `target` parked in the middle and blue charging into it head-on. */
  function charge(target: typeof red): WorldState {
    return withBalls(createWorld(1, [target, blue]), [
      { position: { x: 400, y: 500 }, velocity: still },
      { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);
  }

  it('takes ARMOR less of a contact hit than the same ball without armor, and shows it', () => {
    const { incomingDamageOf, ...bare } = guardian;
    expect(incomingDamageOf).toBeDefined();
    const plain = { ...bare, id: 'plain' };
    const plainLookup = indexDefinitions([plain, blue]);
    let unarmored = charge(plain);
    for (let i = 0; i < 20; i++) unarmored = step(unarmored, plainLookup).world;
    const { world, events } = play(charge(guardian), 20);
    const lost = guardian.maxHealth - (world.balls[0]?.health ?? 0);
    expect(plain.maxHealth - (unarmored.balls[0]?.health ?? 0) - lost).toBe(ARMOR);
    expect(ofType(events, 'hitReduced')).toStrictEqual([
      expect.objectContaining({ ballId: 'ball-0', sourceId: 'ball-1', reduced: ARMOR, rest: lost }),
    ]);
  });

  it('takes a share off ability damage too: a poison tick does less', () => {
    const poisoned = withBalls(parked(guardian), [
      { statuses: [{ kind: 'poisoned', sourceId: 'ball-1', expiresTick: 500, sinceTick: 0 }] },
    ]);
    const { events } = play(poisoned, POISON_INTERVAL_TICKS);
    const tick = ofType(events, 'damage').find((event) => event.targetId === 'ball-0');
    expect(tick?.amount).toBe(armoredHit(POISON_DAMAGE));
  });
});

describe('Bloom', () => {
  it('regrows a little on a fixed rhythm, all match long', () => {
    const hurt = withBalls(parked(bloom), [{ health: bloom.maxHealth - 20 }]);
    const { events } = play(hurt, FIRST_HEAL_TICK + HEAL_EVERY_TICKS * 3);
    const heals = ofType(events, 'healed');
    expect(heals.map((heal) => heal.tick)).toStrictEqual(
      [0, 1, 2, 3].map((n) => FIRST_HEAL_TICK + HEAL_EVERY_TICKS * n),
    );
    expect(heals.every((heal) => heal.amount === HEAL_AMOUNT)).toBe(true);
  });

  it('keeps regrowing right after a hit', () => {
    const bumped = withBalls(parked(bloom), [
      { position: { x: 400, y: 500 }, velocity: still, health: bloom.maxHealth - 20 },
      { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);
    const { events } = play(bumped, FIRST_HEAL_TICK + HEAL_EVERY_TICKS);
    const hitTick = ofType(events, 'damage').find((event) => event.targetId === 'ball-0')?.tick;
    expect(hitTick).toBeDefined();
    const healsAfterHit = ofType(events, 'healed').filter((heal) => heal.tick > (hitTick ?? 0));
    expect(healsAfterHit.length).toBeGreaterThan(0);
  });
});
