import { describe, expect, it } from 'vitest';
import { DT } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, testLookup, withBalls } from '../test-support.ts';
import type {
  BallDefinition,
  ProjectileHitEvent,
  ProjectileState,
  SimEvent,
  WorldState,
} from '../types.ts';
import { createWorld } from '../world.ts';

const still = { x: 0, y: 0 };

/** An arrow owned by ball-0 at (x, 500), heading +x at `perTick` units per tick. */
function arrow(id: number, x: number, perTick: number, extra: Partial<ProjectileState> = {}) {
  return {
    id: `projectile-${id}`,
    ownerId: 'ball-0',
    position: { x, y: 500 },
    velocity: { x: perTick / DT, y: 0 },
    radius: 6,
    damage: 10,
    ticksLeft: 100,
    ...extra,
  };
}

/** Red owner parked at the top; blues placed along y = 500 at the given x positions. */
function scene(blueXs: readonly number[], projectiles: readonly ProjectileState[]): WorldState {
  const base = createWorld(1, [red, ...blueXs.map(() => blue)]);
  return {
    ...withBalls(base, [
      { position: { x: 150, y: 120 }, velocity: still },
      ...blueXs.map((x) => ({ position: { x, y: 500 }, velocity: still })),
    ]),
    projectiles,
    nextProjectileId: projectiles.length,
  };
}

function play(world: WorldState, ticks: number, lookup = testLookup) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

const hits = (events: readonly SimEvent[]): ProjectileHitEvent[] =>
  events.filter((event): event is ProjectileHitEvent => event.type === 'projectileHit');

describe('projectiles', () => {
  it('hits a ball it crosses completely within one tick (swept collision)', () => {
    // 1000 units per tick, far more than the 152-unit-wide ball in its way.
    const { world, events } = play(scene([600], [arrow(0, 200, 1000)]), 1);
    expect(hits(events)).toStrictEqual([
      expect.objectContaining({ projectileId: 'projectile-0', targetId: 'ball-1', amount: 10 }),
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'damage',
        targetId: 'ball-1',
        sourceId: 'ball-0',
        cause: 'ability',
      }),
    );
    expect(world.balls[1]?.health).toBe(blue.maxHealth - 10);
    expect(world.projectiles).toStrictEqual([]);
  });

  it('hits the nearest ball when several are on its path', () => {
    // The nearer ball is second in the array, so array order alone would pick the wrong one.
    const { events } = play(scene([750, 430], [arrow(0, 200, 800)]), 1);
    expect(hits(events).map((event) => event.targetId)).toStrictEqual(['ball-2']);
  });

  it('never hits its owner', () => {
    // The owner sits right on the arrow's path.
    const world = withBalls(scene([820], [arrow(0, 250, 700)]), [{ position: { x: 500, y: 500 } }]);
    const { events } = play(world, 1);
    expect(hits(events)).toStrictEqual([expect.objectContaining({ targetId: 'ball-1' })]);
  });

  it('is removed when it reaches a wall', () => {
    const { world, events } = play(scene([600], [arrow(0, 980, 30)]), 1);
    expect(world.projectiles).toStrictEqual([]);
    expect(events).toContainEqual({
      type: 'projectileExpired',
      tick: 1,
      projectileId: 'projectile-0',
      ownerId: 'ball-0',
      reason: 'wall',
    });
  });

  it('flies straight and expires when its lifetime runs out', () => {
    const slow = arrow(0, 300, 1, { ticksLeft: 3 });
    const one = play(scene([850], [slow]), 1);
    expect(one.world.projectiles).toStrictEqual([
      { ...slow, position: { x: 301, y: 500 }, ticksLeft: 2 },
    ]);
    const three = play(scene([850], [slow]), 3);
    expect(three.world.projectiles).toStrictEqual([]);
    expect(three.events.at(-1)).toMatchObject({
      type: 'projectileExpired',
      reason: 'lifetime',
      tick: 3,
    });
  });

  it('lets later arrows pass through a ball killed earlier in the same tick', () => {
    // Two arrows reach a ball on 5 health this tick. The first kills it; the second passes through
    // and hits the ball behind.
    const world = withBalls(scene([480, 820], [arrow(0, 260, 650), arrow(1, 240, 650)]), [
      {},
      { health: 5 },
    ]);
    const { events } = play(world, 1);
    expect(hits(events).map((event) => [event.projectileId, event.targetId])).toStrictEqual([
      ['projectile-0', 'ball-1'],
      ['projectile-1', 'ball-2'],
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'ballDefeated', ballId: 'ball-1' }),
    );
  });

  describe('fired by an ability', () => {
    type ShooterState = Readonly<{ log: readonly string[] }>;
    const shooter: BallDefinition = defineBall<ShooterState>({
      ...red,
      id: 'shooter',
      initialAbilityState: { log: [] },
      hooks: {
        onTick: ({ world }) =>
          world.tick === 1
            ? [
                {
                  kind: 'spawnProjectile',
                  velocity: { x: 300 / DT, y: 0 },
                  radius: 6,
                  damage: 12,
                  lifetimeTicks: 60,
                },
              ]
            : [],
        onDamageDealt: ({ self, amount, cause, target }) => [
          {
            kind: 'setAbilityState',
            state: { log: [...self.abilityState.log, `${cause} ${amount} to ${target.id}`] },
          },
        ],
      },
    });
    const lookup = indexDefinitions([shooter, blue]);
    const world = withBalls(createWorld(1, [shooter, blue]), [
      { position: { x: 200, y: 500 }, velocity: still },
      { position: { x: 500, y: 500 }, velocity: still },
    ]);

    it('fires, hits and deals damage in that order, in the tick it was fired', () => {
      const { events } = play(world, 1, lookup);
      expect(events.map((event) => event.type)).toStrictEqual([
        'abilityTriggered',
        'projectileFired',
        'projectileHit',
        'damage',
        'abilityTriggered',
      ]);
      expect(events.at(-1)).toMatchObject({ hook: 'onDamageDealt' });
    });

    it('fires onDamageDealt for the owner with ability damage', () => {
      const { world: after } = play(world, 2, lookup);
      expect(after.balls[0]?.abilityState).toStrictEqual({ log: ['ability 12 to ball-1'] });
    });
  });
});
