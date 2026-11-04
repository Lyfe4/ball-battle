// The pair-specific interactions of ADR 0016: poison numbs rage, rage can't be slowed, the cold
// shortens poison, and shockwaves stagger the balls that aim.
import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { StatusAppliedEvent, StatusKind, StatusState } from '../status.ts';
import type { BallDefinition, DamageEvent, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer } from './archer.ts';
import { berserker, POISON_NUMB, rageFor } from './berserker.ts';
import { frost, POISON_KEPT } from './frost.ts';
import { quake, STAGGER_TICKS } from './quake.ts';
import { chargeOf, FIRST_CHARGE_TICK, sniper } from './sniper.ts';
import { storm } from './storm.ts';
import { POISON_TICKS, venom } from './venom.ts';

function play(
  world: WorldState,
  definitions: readonly BallDefinition[],
  ticks: number,
): { world: WorldState; events: SimEvent[] } {
  const lookup = indexDefinitions(definitions);
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

/** `attacker` charging a parked, very healthy `target` head-on, so they touch within 30 ticks. */
function headOn(attacker: BallDefinition, target: BallDefinition, health?: number): WorldState {
  return withBalls(createWorld(1, [attacker, target]), [
    {
      position: { x: 380, y: 500 },
      velocity: { x: attacker.speed, y: 0 },
      ...(health === undefined ? {} : { health }),
    },
    { position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
  ]);
}

const status = (kind: StatusKind, expiresTick: number): StatusState => ({
  kind,
  sourceId: 'ball-1',
  expiresTick,
  sinceTick: 0,
});

const applied = (events: readonly SimEvent[], kind: StatusKind): StatusAppliedEvent[] =>
  events.filter(
    (event): event is StatusAppliedEvent => event.type === 'statusApplied' && event.status === kind,
  );

describe('poison numbs rage', () => {
  it('cuts a poisoned Berserker’s rage bonus by POISON_NUMB, and only the bonus', () => {
    const health = Math.round(berserker.maxHealth / 2);
    const hit = (statuses: readonly StatusState[]): number[] => {
      const start = withBalls(headOn(berserker, blue, health), [{ statuses }]);
      return play(start, [berserker, blue], 25)
        .events.filter(
          (event): event is DamageEvent =>
            event.type === 'damage' && event.sourceId === 'ball-0' && event.cause === 'contact',
        )
        .map((event) => event.amount);
    };
    const rage = rageFor(health, berserker.maxHealth);
    expect(hit([])).toStrictEqual([Math.round(berserker.contactDamage + rage)]);
    expect(hit([status('poisoned', 1000)])).toStrictEqual([
      Math.round(berserker.contactDamage + rage * (1 - POISON_NUMB)),
    ]);
  });
});

describe('status resistance', () => {
  it('never slows the Berserker: the Frost’s touch lands nothing', () => {
    const { world, events } = play(headOn(frost, berserker), [frost, berserker], 30);
    expect(events.some((event) => event.type === 'collision')).toBe(true);
    expect(applied(events, 'slowed')).toStrictEqual([]);
    expect(world.balls[1]?.statuses).toStrictEqual([]);
  });

  it('still slows any other ball the Frost touches', () => {
    expect(applied(play(headOn(frost, blue), [frost, blue], 30).events, 'slowed')).toHaveLength(1);
  });

  it('wears poison off the Frost sooner: it keeps POISON_KEPT of the duration', () => {
    const { events } = play(headOn(venom, frost), [venom, frost], 30);
    const [poisoned] = applied(events, 'poisoned');
    expect(poisoned?.ballId).toBe('ball-1');
    expect((poisoned?.expiresTick ?? 0) - (poisoned?.tick ?? 0)).toBe(
      Math.round(POISON_TICKS * POISON_KEPT),
    );
  });
});

describe('shockwaves stagger', () => {
  it('staggers every ball a shockwave hits for STAGGER_TICKS', () => {
    const start = withBalls(createWorld(1, [quake, blue]), [
      { position: { x: 80, y: 500 }, velocity: { x: -quake.speed, y: 0 } },
      { position: { x: 250, y: 620 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
    ]);
    const { events } = play(start, [quake, blue], 30);
    const struck = events.find((event) => event.type === 'zoneStruck');
    const [staggered] = applied(events, 'staggered');
    expect(staggered).toMatchObject({ ballId: 'ball-1', sourceId: 'ball-0' });
    expect(staggered?.tick).toBe(struck?.tick);
    expect((staggered?.expiresTick ?? 0) - (staggered?.tick ?? 0)).toBe(STAGGER_TICKS);
  });

  /** A parked aimer with a parked target far away, staggered until `until`. */
  function aimer(definition: BallDefinition, until: number): WorldState {
    return withBalls(createWorld(1, [definition, blue]), [
      {
        position: { x: 200, y: 500 },
        velocity: { x: 0, y: 0 },
        statuses: until > 0 ? [status('staggered', until)] : [],
      },
      { position: { x: 800, y: 500 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
    ]);
  }
  const firstTick = (events: readonly SimEvent[], type: SimEvent['type']): number | undefined =>
    events.find((event) => event.type === type)?.tick;

  it.each([
    ['Archer', archer, 'projectileFired'],
    ['Storm', storm, 'zoneSpawned'],
    ['Sniper', sniper, 'projectileFired'],
  ] as const)('holds the %s’s attack until the stagger ends', (_name, definition, type) => {
    const free = firstTick(play(aimer(definition, 0), [definition, blue], 150).events, type);
    expect(free).toBeLessThan(100);
    const held = firstTick(play(aimer(definition, 200), [definition, blue], 300).events, type);
    expect(held).toBeGreaterThanOrEqual(200);
  });

  it('breaks a Sniper’s lock in progress without a shot', () => {
    // The lock starts on FIRST_CHARGE_TICK; stagger it a few ticks into the charge.
    const locked = play(aimer(sniper, 0), [sniper, blue], FIRST_CHARGE_TICK + 3).world;
    const sniperBall = locked.balls[0];
    if (sniperBall === undefined || chargeOf(sniperBall) === undefined) {
      throw new Error('expected a lock in progress');
    }
    const staggered = withBalls(locked, [{ statuses: [status('staggered', locked.tick + 60)] }]);
    const { world, events } = play(staggered, [sniper, blue], 50);
    expect(events.some((event) => event.type === 'projectileFired')).toBe(false);
    expect(world.balls[0] && chargeOf(world.balls[0])).toBeUndefined();
  });
});
