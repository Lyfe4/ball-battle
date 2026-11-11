// No interaction rules (ADR 0045): every ball's ability works the same on any ball. Poison leaves
// rage whole, a shockwave only hurts, and a ball that was hit still aims on time. Rage can't shrug
// off the cold, nor the cold shorten poison (ADR 0028).
import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { StatusAppliedEvent, StatusKind } from '../status.ts';
import type { BallDefinition, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer } from './archer.ts';
import { berserker } from './berserker.ts';
import { frost } from './frost.ts';
import { quake, ZONE_DAMAGE } from './quake.ts';
import { sniper } from './sniper.ts';
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

const applied = (events: readonly SimEvent[], kind: StatusKind): StatusAppliedEvent[] =>
  events.filter(
    (event): event is StatusAppliedEvent => event.type === 'statusApplied' && event.status === kind,
  );

describe('no status resistance left (ADR 0028)', () => {
  it('slows the Berserker like any ball the Frost touches', () => {
    const { world } = play(headOn(frost, berserker), [frost, berserker], 30);
    expect(world.balls[1]?.statuses.map(({ kind }) => kind)).toStrictEqual(['slowed']);
  });

  it('poisons the Frost for Venom’s full duration', () => {
    const { events } = play(headOn(venom, frost), [venom, frost], 30);
    const [poisoned] = applied(events, 'poisoned');
    expect(poisoned?.ballId).toBe('ball-1');
    expect((poisoned?.expiresTick ?? 0) - (poisoned?.tick ?? 0)).toBe(POISON_TICKS);
  });
});

describe('a shockwave only hurts', () => {
  it('deals its damage to a ball it hits and puts no status on it', () => {
    const start = withBalls(createWorld(1, [quake, blue]), [
      { position: { x: 80, y: 500 }, velocity: { x: -quake.speed, y: 0 } },
      { position: { x: 250, y: 620 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
    ]);
    const { events } = play(start, [quake, blue], 30);
    const struck = events.find((event) => event.type === 'zoneStruck');
    expect(struck).toBeDefined();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'damage', targetId: 'ball-1', amount: ZONE_DAMAGE }),
    );
    expect(events.some((event) => event.type === 'statusApplied')).toBe(false);
  });

  /** A parked aimer, with `other` running into the wall beside it (a Quake sets off a shockwave). */
  function beside(definition: BallDefinition, other: BallDefinition): WorldState {
    return withBalls(createWorld(1, [definition, other]), [
      { position: { x: 200, y: 500 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
      { position: { x: 80, y: 520 }, velocity: { x: -other.speed, y: 0 }, health: 1_000_000 },
    ]);
  }

  it.each([
    ['Archer', archer, 'projectileFired'],
    ['Storm', storm, 'zoneSpawned'],
    ['Sniper', sniper, 'projectileFired'],
  ] as const)('the %s attacks on time after a shockwave hits it', (_name, definition, type) => {
    const firstAttack = (other: BallDefinition) => {
      const { events } = play(beside(definition, other), [definition, other], 150);
      const shaken = events.some(
        (event) =>
          event.type === 'damage' && event.targetId === 'ball-0' && event.cause === 'ability',
      );
      return {
        shaken,
        tick: events.find((event) => event.type === type && event.ownerId === 'ball-0')?.tick,
      };
    };
    const calm = firstAttack(blue);
    const shaken = firstAttack(quake);
    expect(calm.shaken).toBe(false);
    expect(shaken.shaken).toBe(true);
    expect(calm.tick).toBeLessThan(100);
    expect(shaken.tick).toBe(calm.tick);
  });
});
