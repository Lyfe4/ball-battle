// The Boomerang, Bomber, Guardian and Bloom (ADR 0043): each ball's own mechanic, on fixed scenes.
import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { isShielded, SHIELD_SOAK } from '../shield.ts';
import { SHOCK_HEAL_REDUCTION } from '../status.ts';
import type { StatusState } from '../status.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { bloom, CALM_TICKS, HEAL_AMOUNT, HEAL_EVERY_TICKS, REGROW_PER_REST } from './bloom.ts';
import { BLAST_DAMAGE, bomber, DROP_TICKS, FIRST_DROP_TICK, FUSE_TICKS } from './bomber.ts';
import { boomerang, COOLDOWN_TICKS, FIRST_THROW_TICK } from './boomerang.ts';
import { guardian, REGROW_TICKS } from './guardian.ts';

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

  it('holds its throw while staggered, and says so once', () => {
    const stagger: StatusState = {
      kind: 'staggered',
      sourceId: 'ball-1',
      expiresTick: FIRST_THROW_TICK + 30,
      sinceTick: 0,
    };
    const dazed = withBalls(parked(boomerang), [{ statuses: [stagger] }]);
    const { events } = play(dazed, FIRST_THROW_TICK + 40);
    expect(ofType(events, 'ruleApplied')).toStrictEqual([
      expect.objectContaining({ tick: FIRST_THROW_TICK, rule: 'aimHeld' }),
    ]);
    expect(ofType(events, 'projectileFired')[0]?.tick).toBe(FIRST_THROW_TICK + 30);
  });
});

describe('Bomber', () => {
  it('drops a bomb on a fixed rhythm that goes off by itself after its fuse', () => {
    const { events } = play(parked(bomber), FIRST_DROP_TICK + FUSE_TICKS + 1);
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
  it('starts behind a shield', () => {
    const self = play(parked(guardian), 1).world.balls[0];
    expect(self === undefined ? false : isShielded(self)).toBe(true);
  });

  it('grows a new shield REGROW_TICKS after one breaks', () => {
    const shielded = play(parked(guardian), 2).world;
    // As if a hit broke it on tick 2: the next one grows REGROW_TICKS after the following tick.
    const struck = withBalls(shielded, [{ statuses: [] }]);
    const later = play(struck, REGROW_TICKS + 2).world.balls[0];
    expect(later === undefined ? false : isShielded(later)).toBe(true);
    const early = play(struck, REGROW_TICKS - 1).world.balls[0];
    expect(early === undefined ? true : isShielded(early)).toBe(false);
  });

  it('soaks part of a heavy contact hit, so it takes less than an unshielded ball', () => {
    const charge = (shielded: boolean) => {
      const world = play(parked(guardian), 1).world;
      return withBalls(world, [
        {
          position: { x: 400, y: 500 },
          velocity: { x: guardian.speed, y: 0 },
          ...(shielded ? {} : { statuses: [] }),
        },
        { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
      ]);
    };
    const withShield = play(charge(true), 20).world.balls[0]?.health ?? 0;
    const without = play(charge(false), 20).world.balls[0]?.health ?? 0;
    expect(withShield - without).toBe(SHIELD_SOAK);
  });
});

describe('Bloom', () => {
  /** A Bloom down 20 health with nothing near it. */
  function hurt(statuses: readonly StatusState[] = []): WorldState {
    return withBalls(parked(bloom), [{ health: bloom.maxHealth - 20, statuses }]);
  }

  it('regrows once it has rested, a little at a time, up to its cap for the rest', () => {
    const { events } = play(hurt(), CALM_TICKS + HEAL_EVERY_TICKS * 10);
    const heals = ofType(events, 'healed');
    expect(heals[0]?.tick).toBe(CALM_TICKS);
    expect(heals.every((heal) => heal.amount === HEAL_AMOUNT)).toBe(true);
    expect(heals.reduce((sum, heal) => sum + heal.amount, 0)).toBe(REGROW_PER_REST);
  });

  it('starts a new rest with every hit it takes', () => {
    const rested = play(hurt(), CALM_TICKS + 1).world;
    // Blue runs into it: the rest starts over, and the regrowth with it.
    const bumped = withBalls(rested, [
      { position: { x: 400, y: 500 }, velocity: still },
      { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);
    const { events } = play(bumped, CALM_TICKS);
    const hitTick = ofType(events, 'damage').find((event) => event.targetId === 'ball-0')?.tick;
    expect(hitTick).toBeDefined();
    const healsAfterHit = ofType(events, 'healed').filter((heal) => heal.tick > (hitTick ?? 0));
    expect(healsAfterHit).toStrictEqual([]);
  });

  it('regrows half as much while shocked', () => {
    const shock: StatusState = {
      kind: 'shocked',
      sourceId: 'ball-1',
      expiresTick: 10_000,
      sinceTick: 0,
    };
    const heals = ofType(play(hurt([shock]), CALM_TICKS + 1).events, 'healed');
    expect(heals[0]?.amount).toBe(HEAL_AMOUNT * (1 - SHOCK_HEAL_REDUCTION));
  });
});
