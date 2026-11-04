import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { blue, red, withBalls } from '../test-support.ts';
import { createWorld } from '../world.ts';
import type { AbilityAction, BallState, DefinitionLookup } from '../types.ts';
import { applyActions } from './apply-actions.ts';

const definitions = indexDefinitions([red, blue]);
const world = createWorld(1, [red, blue]);

/** applyActions on a scene with these balls and no projectiles, in a 1000-unit arena. */
function apply(
  balls: readonly BallState[],
  ownerId: string,
  actions: readonly AbilityAction[],
  lookup: DefinitionLookup,
  tick: number,
) {
  return applyActions(
    { balls, projectiles: [], nextProjectileId: 0, zones: [], nextZoneId: 0 },
    ownerId,
    actions,
    lookup,
    tick,
    1000,
  );
}

describe('applyActions', () => {
  it('damages a target and reports ability damage', () => {
    const { balls, events } = apply(
      world.balls,
      'ball-0',
      [{ kind: 'damage', targetId: 'ball-1', amount: 10 }],
      definitions,
      5,
    );
    expect(balls[1]?.health).toBe(blue.maxHealth - 10);
    expect(events).toStrictEqual([
      {
        type: 'damage',
        tick: 5,
        targetId: 'ball-1',
        sourceId: 'ball-0',
        cause: 'ability',
        amount: 10,
        healthAfter: blue.maxHealth - 10,
        multiplier: 1,
        survivedLethal: false,
      },
    ]);
  });

  it('heals up to max health and reports only what was restored', () => {
    const hurt = withBalls(world, [{ health: red.maxHealth - 5 }]);
    const { balls, events } = apply(
      hurt.balls,
      'ball-1',
      [{ kind: 'heal', targetId: 'ball-0', amount: 50 }],
      definitions,
      1,
    );
    expect(balls[0]?.health).toBe(red.maxHealth);
    expect(events).toStrictEqual([
      {
        type: 'healed',
        tick: 1,
        ballId: 'ball-0',
        sourceId: 'ball-1',
        amount: 5,
        healthAfter: red.maxHealth,
      },
    ]);
    // Already full: nothing to report.
    expect(
      apply(
        world.balls,
        'ball-0',
        [{ kind: 'heal', targetId: 'ball-0', amount: 5 }],
        definitions,
        1,
      ).events,
    ).toStrictEqual([]);
  });

  it('never revives or damages a defeated ball', () => {
    const dead = withBalls(world, [{ health: 0 }]);
    const { balls, events } = apply(
      dead.balls,
      'ball-1',
      [
        { kind: 'heal', targetId: 'ball-0', amount: 50 },
        { kind: 'damage', targetId: 'ball-0', amount: 50 },
      ],
      definitions,
      1,
    );
    expect(balls[0]?.health).toBe(0);
    expect(events).toStrictEqual([]);
  });

  it('changes only the owner’s velocity and ability state', () => {
    const { balls } = apply(
      world.balls,
      'ball-1',
      [
        { kind: 'setVelocity', velocity: { x: 6, y: 8 } },
        { kind: 'setAbilityState', state: { charged: true } },
      ],
      definitions,
      1,
    );
    expect(balls[0]).toBe(world.balls[0]);
    expect(balls[1]?.velocity).toStrictEqual({ x: 6, y: 8 });
    expect(balls[1]?.abilityState).toStrictEqual({ charged: true });
  });

  it('rejects unknown targets and non-finite velocities as bugs', () => {
    expect(() =>
      apply(
        world.balls,
        'ball-0',
        [{ kind: 'damage', targetId: 'nope', amount: 1 }],
        definitions,
        1,
      ),
    ).toThrow(/unknown ball/);
    expect(() =>
      apply(
        world.balls,
        'ball-0',
        [{ kind: 'setVelocity', velocity: { x: Infinity, y: 0 } }],
        definitions,
        1,
      ),
    ).toThrow(/non-finite/);
  });

  it('does not mutate its input', () => {
    const before = structuredClone(world.balls);
    apply(
      world.balls,
      'ball-0',
      [{ kind: 'damage', targetId: 'ball-1', amount: 5 }],
      definitions,
      1,
    );
    expect(world.balls).toStrictEqual(before);
  });

  describe('spawnProjectile', () => {
    const [shooter] = world.balls;
    if (shooter === undefined) throw new Error('expected a ball');
    const placed = { ...shooter, position: { x: 500, y: 500 } };
    const arrow = {
      kind: 'spawnProjectile',
      velocity: { x: 1200, y: 0 },
      radius: 6,
      damage: 9,
      lifetimeTicks: 120,
    } as const;

    it('spawns just outside the owner, heading along its velocity, with the next id', () => {
      const result = applyActions(
        { balls: [placed], projectiles: [], nextProjectileId: 4, zones: [], nextZoneId: 0 },
        placed.id,
        [arrow],
        definitions,
        7,
        1000,
      );
      expect(result.nextProjectileId).toBe(5);
      const [projectile] = result.projectiles;
      expect(projectile).toMatchObject({
        id: 'projectile-4',
        ownerId: placed.id,
        velocity: arrow.velocity,
        radius: 6,
        damage: 9,
        ticksLeft: 120,
      });
      // Owner edge + projectile radius + a 1-unit gap.
      expect(projectile?.position.x).toBeCloseTo(500 + red.radius + 6 + 1, 9);
      expect(projectile?.position.y).toBe(500);
      expect(result.events).toStrictEqual([
        {
          type: 'projectileFired',
          tick: 7,
          projectileId: 'projectile-4',
          ownerId: placed.id,
          position: projectile?.position,
          velocity: arrow.velocity,
        },
      ]);
    });

    it('fires into an adjacent wall as fired then expired, without adding a projectile', () => {
      const againstWall = { ...shooter, position: { x: 1000 - red.radius, y: 500 } };
      const result = applyActions(
        { balls: [againstWall], projectiles: [], nextProjectileId: 0, zones: [], nextZoneId: 0 },
        againstWall.id,
        [arrow],
        definitions,
        3,
        1000,
      );
      expect(result.projectiles).toStrictEqual([]);
      expect(result.nextProjectileId).toBe(1);
      expect(result.events.map((event) => event.type)).toStrictEqual([
        'projectileFired',
        'projectileExpired',
      ]);
      expect(result.events[1]).toMatchObject({ projectileId: 'projectile-0', reason: 'wall' });
    });

    it('does nothing for a defeated owner and rejects invalid projectiles', () => {
      const dead = { ...placed, health: 0 };
      const none = applyActions(
        { balls: [dead], projectiles: [], nextProjectileId: 0, zones: [], nextZoneId: 0 },
        dead.id,
        [arrow],
        definitions,
        1,
        1000,
      );
      expect(none.projectiles).toStrictEqual([]);
      expect(none.events).toStrictEqual([]);
      for (const bad of [
        { ...arrow, velocity: { x: 0, y: 0 } },
        { ...arrow, radius: 0 },
        { ...arrow, damage: Number.NaN },
        { ...arrow, lifetimeTicks: 1.5 },
      ]) {
        expect(() =>
          applyActions(
            { balls: [placed], projectiles: [], nextProjectileId: 0, zones: [], nextZoneId: 0 },
            placed.id,
            [bad],
            definitions,
            1,
            1000,
          ),
        ).toThrow(/invalid projectile/);
      }
    });
  });
});
