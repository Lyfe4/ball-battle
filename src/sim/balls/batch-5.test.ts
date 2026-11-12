// The Boomerang, Bomber, Spartan and Bloom (ADR 0043, 0045, 0047): each ball's own mechanic, on fixed
// scenes.
import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import { POISON_DAMAGE, POISON_INTERVAL_TICKS } from '../status.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { bloom, FIRST_HEAL_TICK, HEAL_AMOUNT, HEAL_EVERY_TICKS, PAUSE_TICKS } from './bloom.ts';
import { BLAST_DAMAGE, bomber, DROP_TICKS, FIRST_DROP_TICK, FUSE_TICKS } from './bomber.ts';
import { boomerang, COOLDOWN_TICKS, FIRST_THROW_TICK } from './boomerang.ts';
import {
  CYCLE_TICKS,
  rhythmAt,
  SHIELD_TICKS,
  SHIELDED_SPEED,
  shieldedHit,
  spartan,
  SPEAR_DAMAGE,
} from './spartan.ts';

const lookup = indexDefinitions([boomerang, bomber, spartan, bloom, red, blue]);

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

describe('Spartan', () => {
  it('lets half of a hit through its planted shield, rounded down', () => {
    expect(shieldedHit(26)).toBe(13);
    expect(shieldedHit(7)).toBe(3);
    expect(shieldedHit(3)).toBe(1);
    expect(shieldedHit(1)).toBe(0);
  });

  /** A Spartan whose rhythm started at `phase`, parked in the middle, and blue charging it head-on. */
  function charge(phase: number): WorldState {
    return withBalls(createWorld(1, [spartan, blue]), [
      {
        position: { x: 400, y: 500 },
        velocity: still,
        abilityState: { phase, raised: rhythmAt(0, phase) < SHIELD_TICKS },
      },
      { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);
  }

  it('takes half of a bump while its shield is planted, and shows it', () => {
    const { world, events } = play(charge(0), 20);
    const lost = spartan.maxHealth - (world.balls[0]?.health ?? 0);
    const [reduced] = ofType(events, 'hitReduced');
    expect(reduced).toStrictEqual(
      expect.objectContaining({ ballId: 'ball-0', sourceId: 'ball-1', rest: lost }),
    );
    expect(lost).toBe(shieldedHit(lost + (reduced?.reduced ?? 0)));
    expect(lost).toBeGreaterThan(0);
  });

  it('takes a bump whole in the open', () => {
    // Started just past its shield: open for the whole charge.
    const { world, events } = play(charge(SHIELD_TICKS + 1), 20);
    expect(ofType(events, 'hitReduced')).toStrictEqual([]);
    expect(world.balls[0]?.health).toBeLessThan(spartan.maxHealth);
  });

  it('takes half of ability damage too while planted: a poison tick does less', () => {
    const poisoned = withBalls(parked(spartan), [
      {
        abilityState: { phase: 0, raised: true },
        statuses: [{ kind: 'poisoned', sourceId: 'ball-1', expiresTick: 500, sinceTick: 0 }],
      },
    ]);
    const { events } = play(poisoned, POISON_INTERVAL_TICKS);
    const tick = ofType(events, 'damage').find((event) => event.targetId === 'ball-0');
    expect(tick?.amount).toBe(shieldedHit(POISON_DAMAGE));
  });

  it('starts its rhythm at a seeded point and throws its spear as the shield comes down', () => {
    const { world, events } = play(parked(spartan), CYCLE_TICKS * 2 + 1);
    const phase = world.balls[0]?.abilityState['phase'];
    expect(typeof phase).toBe('number');
    const throws = ofType(events, 'projectileFired');
    expect(throws).toHaveLength(2);
    for (const thrown of throws) expect(rhythmAt(thrown.tick, Number(phase))).toBe(SHIELD_TICKS);
    expect(world.projectiles.every((spear) => spear.damage === SPEAR_DAMAGE)).toBe(true);
    // The same seed starts it at the same point; another seed (almost always) elsewhere.
    const again = play(parked(spartan), 2).world.balls[0]?.abilityState['phase'];
    expect(again).toBe(phase);
    const phases = new Set(
      [2, 3, 4, 5, 6].map(
        (seed) =>
          play(withBalls(createWorld(seed, [spartan, blue]), []), 2).world.balls[0]?.abilityState[
            'phase'
          ],
      ),
    );
    expect(phases.size).toBeGreaterThan(1);
  });

  it('moves at a share of its speed while its shield is planted', () => {
    const moving = withBalls(parked(spartan), [
      { velocity: { x: spartan.speed, y: 0 }, abilityState: { phase: 0, raised: true } },
    ]);
    const { world } = play(moving, 2);
    const velocity = world.balls[0]?.velocity ?? still;
    expect(Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)).toBeCloseTo(
      spartan.speed * SHIELDED_SPEED,
      6,
    );
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

  it('pauses its regrowth for PAUSE_TICKS after every hit, then regrows again', () => {
    const bumped = withBalls(parked(bloom), [
      { position: { x: 400, y: 500 }, velocity: still },
      { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);
    const { world, events } = play(bumped, 240);
    expect(world.match.status).toBe('running');
    const hits = ofType(events, 'damage')
      .filter((event) => event.targetId === 'ball-0')
      .map((event) => event.tick);
    const heals = ofType(events, 'healed').map((heal) => heal.tick);
    expect(hits.length).toBeGreaterThan(0);
    // No regrowth within PAUSE_TICKS of any hit, and the first after a hit comes as the pause ends.
    for (const heal of heals) {
      expect(hits.filter((hit) => hit < heal && heal < hit + PAUSE_TICKS)).toStrictEqual([]);
    }
    const resumed = hits.filter(
      (hit) => !hits.some((other) => other > hit && other <= hit + PAUSE_TICKS),
    );
    expect(resumed.length).toBeGreaterThan(0);
    for (const hit of resumed) {
      if (hit + PAUSE_TICKS < 240) expect(heals).toContain(hit + PAUSE_TICKS);
    }
  });
});
