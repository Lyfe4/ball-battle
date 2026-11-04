import { describe, expect, it } from 'vitest';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, deepFreeze, red, withBalls } from '../test-support.ts';
import type { BallState, SimEvent, Vec2, WorldState, ZoneStruckEvent } from '../types.ts';
import type { StatusRequest } from '../status.ts';
import { createWorld } from '../world.ts';

interface PlannedZone {
  readonly tick: number;
  readonly position: Vec2;
  readonly radius?: number;
  readonly damage?: number;
  readonly delayTicks?: number;
  readonly status?: StatusRequest;
}

const DELAY = 30;
const DAMAGE = 20;

/** A test-only ball that spawns the planned zones on their ticks and records onDamageDealt. */
function zoner(plan: readonly PlannedZone[]) {
  return defineBall<{ lastCause: string; lastAmount: number; calls: number }>({
    id: 'zoner',
    name: 'Zoner',
    description: 'Test fixture: spawns planned zones.',
    color: '#ffffff',
    radius: 50,
    speed: 800,
    maxHealth: 100,
    contactDamage: 10,
    initialAbilityState: { lastCause: '', lastAmount: 0, calls: 0 },
    hooks: {
      onTick: ({ world }) =>
        plan
          .filter((zone) => zone.tick === world.tick)
          .map((zone) => ({
            kind: 'spawnZone',
            position: zone.position,
            radius: zone.radius ?? 150,
            damage: zone.damage ?? DAMAGE,
            delayTicks: zone.delayTicks ?? DELAY,
            ...(zone.status === undefined ? {} : { status: zone.status }),
          })),
      onDamageDealt: ({ self, cause, amount }) => [
        {
          kind: 'setAbilityState',
          state: { lastCause: cause, lastAmount: amount, calls: self.abilityState.calls + 1 },
        },
      ],
    },
  });
}

const still = { x: 0, y: 0 };

/** A world of the zoner plus `others`, every ball placed and parked unless overridden. */
function arena(plan: readonly PlannedZone[], placements: readonly Partial<BallState>[]) {
  const owner = zoner(plan);
  const others = [red, blue, red].slice(0, placements.length - 1);
  const lookup = indexDefinitions([owner, red, blue]);
  const world = withBalls(
    createWorld(1, [owner, ...others]),
    placements.map((placement) => ({ velocity: still, ...placement })),
  );
  return { world, lookup };
}

function play(
  world: WorldState,
  lookup: ReturnType<typeof indexDefinitions>,
  ticks: number,
  onTick?: (world: WorldState, events: readonly SimEvent[]) => void,
) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
    onTick?.(current, result.events);
  }
  return { world: current, events };
}

const struck = (events: readonly SimEvent[]): ZoneStruckEvent[] =>
  events.filter((event): event is ZoneStruckEvent => event.type === 'zoneStruck');

const healthOf = (world: WorldState, id: string): number | undefined =>
  world.balls.find((ball) => ball.id === id)?.health;

describe('zones', () => {
  const centre = { x: 500, y: 500 };
  const spawnTick = 5;
  const strikeTick = spawnTick + DELAY;

  it('strikes exactly on its strike tick, not before', () => {
    const { world, lookup } = arena(
      [{ tick: spawnTick, position: centre }],
      [{ position: { x: 150, y: 150 } }, { position: centre }],
    );
    play(world, lookup, strikeTick + 5, (after, events) => {
      const hit = struck(events);
      if (after.tick < strikeTick) {
        expect(hit).toStrictEqual([]);
        expect(healthOf(after, 'ball-1')).toBe(red.maxHealth);
        expect(after.zones).toHaveLength(after.tick >= spawnTick ? 1 : 0);
      } else if (after.tick === strikeTick) {
        expect(hit).toMatchObject([{ zoneId: 'zone-0', hitIds: ['ball-1'] }]);
        expect(healthOf(after, 'ball-1')).toBe(red.maxHealth - DAMAGE);
        expect(after.zones).toStrictEqual([]);
      } else {
        expect(hit).toStrictEqual([]);
      }
    });
  });

  it('hits every enemy inside it, never its owner, and nothing outside', () => {
    // Zone of radius 150 around the owner. Enemy edges: 1 unit inside, inside, 1 unit outside.
    const { world, lookup } = arena(
      [{ tick: spawnTick, position: centre }],
      [
        { position: centre },
        { position: { x: 500 + 150 + red.radius - 1, y: 500 } },
        { position: { x: 500, y: 500 - 150 - blue.radius + 30 } },
        { position: { x: 500 - 150 - red.radius - 1, y: 500 } },
      ],
    );
    const { world: after, events } = play(world, lookup, strikeTick);
    expect(struck(events)).toStrictEqual([
      {
        type: 'zoneStruck',
        tick: strikeTick,
        zoneId: 'zone-0',
        ownerId: 'ball-0',
        position: centre,
        radius: 150,
        hitIds: ['ball-1', 'ball-2'],
      },
    ]);
    const damage = events.filter((event) => event.type === 'damage');
    expect(damage).toStrictEqual([
      expect.objectContaining({ targetId: 'ball-1', sourceId: 'ball-0', cause: 'ability' }),
      expect.objectContaining({ targetId: 'ball-2', sourceId: 'ball-0', cause: 'ability' }),
    ]);
    expect(after.balls.map((ball) => ball.health)).toStrictEqual([
      100,
      red.maxHealth - DAMAGE,
      blue.maxHealth - DAMAGE,
      red.maxHealth,
    ]);
  });

  it('applies its status to every ball it hit, after the damage, and to no one else', () => {
    // As above: owner at the centre, two enemies inside, one outside, plus one inside that the
    // strike defeats, which gets no status.
    const status = { kind: 'shocked', durationTicks: 40 } as const;
    const { world, lookup } = arena(
      [{ tick: spawnTick, position: centre, status }],
      [
        { position: centre },
        { position: { x: 500 + 150 + red.radius - 1, y: 500 } },
        { position: { x: 500, y: 500 - 150 - blue.radius + 30 } },
        { position: { x: 500 - 150 - red.radius - 1, y: 500 }, health: DAMAGE },
      ],
    );
    const shiftedLast = withBalls(world, [{}, {}, {}, { position: { x: 500, y: 650 } }]);
    const { world: after, events } = play(shiftedLast, lookup, strikeTick);
    const expiresTick = strikeTick + status.durationTicks;
    expect(after.balls.map((ball) => ball.statuses)).toStrictEqual([
      [],
      [{ kind: 'shocked', sourceId: 'ball-0', expiresTick, sinceTick: strikeTick }],
      [{ kind: 'shocked', sourceId: 'ball-0', expiresTick, sinceTick: strikeTick }],
      [],
    ]);
    const order = events.flatMap((event) => {
      if (event.type === 'damage') return [`damage:${event.targetId}`];
      if (event.type === 'statusApplied') return [`status:${event.ballId}`];
      return event.type === 'zoneStruck' || event.type === 'ballDefeated' ? [event.type] : [];
    });
    // Each hit's status right after its damage; the ball the strike defeated gets none.
    expect(order).toStrictEqual([
      'zoneStruck',
      'damage:ball-1',
      'status:ball-1',
      'damage:ball-2',
      'status:ball-2',
      'damage:ball-3',
      'ballDefeated',
    ]);
  });

  it('misses a ball that leaves before the strike, and hits it if it stays', () => {
    const plan = [{ tick: spawnTick, position: centre }];
    const owner = { position: { x: 150, y: 150 } };
    // Inside at spawn; at 600 units/s it is 300 units away, well outside, by the strike.
    const leaving = arena(plan, [owner, { position: centre, velocity: { x: 600, y: 0 } }]);
    const staying = arena(plan, [owner, { position: centre }]);

    const left = play(leaving.world, leaving.lookup, strikeTick);
    expect(struck(left.events)).toMatchObject([{ hitIds: [] }]);
    expect(healthOf(left.world, 'ball-1')).toBe(red.maxHealth);

    const stayed = play(staying.world, staying.lookup, strikeTick);
    expect(struck(stayed.events)).toMatchObject([{ hitIds: ['ball-1'] }]);
  });

  it('triggers onDamageDealt for its owner in the same tick', () => {
    const { world, lookup } = arena(
      [{ tick: spawnTick, position: centre }],
      [{ position: { x: 150, y: 150 } }, { position: centre }],
    );
    const { world: after, events } = play(world, lookup, strikeTick);
    expect(events.filter((event) => event.tick === strikeTick).map((e) => e.type)).toStrictEqual([
      'zoneStruck',
      'damage',
      'abilityTriggered',
    ]);
    expect(after.balls[0]?.abilityState).toStrictEqual({
      lastCause: 'ability',
      lastAmount: DAMAGE,
      calls: 1,
    });
  });

  it('ends every zone with exactly one zoneStruck, an empty hit list for a miss', () => {
    const plan = [10, 20, 30, 40].map((tick) => ({ tick, position: { x: 850, y: 150 } }));
    const { world, lookup } = arena(plan, [
      { position: { x: 150, y: 850 } },
      { position: { x: 500, y: 850 } },
    ]);
    const { world: after, events } = play(world, lookup, 40 + DELAY);
    const spawned = events.filter((event) => event.type === 'zoneSpawned');
    expect(spawned.map((event) => event.zoneId)).toStrictEqual([
      'zone-0',
      'zone-1',
      'zone-2',
      'zone-3',
    ]);
    expect(struck(events).map(({ zoneId, hitIds }) => ({ zoneId, hitIds }))).toStrictEqual(
      spawned.map(({ zoneId }) => ({ zoneId, hitIds: [] })),
    );
    expect(after.zones).toStrictEqual([]);
  });

  it('does not hit a ball again once an earlier zone this tick defeated it', () => {
    const plan = [
      { tick: spawnTick, position: centre, damage: red.maxHealth },
      { tick: spawnTick, position: centre },
    ];
    const { world, lookup } = arena(plan, [{ position: { x: 150, y: 150 } }, { position: centre }]);
    const { events } = play(world, lookup, strikeTick);
    expect(struck(events).map((event) => event.hitIds)).toStrictEqual([['ball-1'], []]);
    expect(events).toContainEqual(expect.objectContaining({ type: 'ballDefeated' }));
  });

  it('still strikes after its owner is defeated', () => {
    const { world, lookup } = arena(
      [{ tick: spawnTick, position: centre }],
      [{ position: { x: 150, y: 150 } }, { position: centre }, { position: { x: 850, y: 850 } }],
    );
    const before = play(world, lookup, spawnTick).world;
    const ownerDown = withBalls(before, [{ health: 0 }]);
    const { events } = play(ownerDown, lookup, DELAY);
    expect(struck(events)).toMatchObject([{ ownerId: 'ball-0', hitIds: ['ball-1'] }]);
  });

  it('keeps step pure with zones pending and striking', () => {
    const { world, lookup } = arena(
      [{ tick: spawnTick, position: centre }],
      [{ position: { x: 150, y: 150 } }, { position: centre }],
    );
    const pending = deepFreeze(play(world, lookup, strikeTick - 1).world);
    const snapshot = structuredClone(pending);
    const first = step(pending, lookup);
    expect(pending).toStrictEqual(snapshot);
    expect(step(pending, lookup)).toStrictEqual(first);
  });
});
