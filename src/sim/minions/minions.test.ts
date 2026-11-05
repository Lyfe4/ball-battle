import { describe, expect, it } from 'vitest';
import { applyActions, sceneOf } from '../abilities/apply-actions.ts';
import { DT } from '../constants.ts';
import { indexDefinitions } from '../definitions.ts';
import { moveBall } from '../movement.ts';
import { step } from '../step.ts';
import { blue, red, testLookup, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import type { MinionState } from './types.ts';

const still = { x: 0, y: 0 };

/** A minion of ball-0 (red) at `x, y`, moving `perTick` units per tick along +x unless given. */
function minion(
  index: number,
  x: number,
  y: number,
  perTick: number,
  extra: Partial<MinionState> = {},
): MinionState {
  return {
    id: `minion-${index}`,
    ownerId: 'ball-0',
    position: { x, y },
    velocity: { x: perTick / DT, y: 0 },
    radius: 20,
    damage: 9,
    ticksLeft: 100,
    ...extra,
  };
}

/** Red (the owner) parked at the top left and blue (the enemy) at `blueAt`, both still. */
function scene(minions: readonly MinionState[], blueAt = { x: 600, y: 500 }): WorldState {
  return {
    ...withBalls(createWorld(1, [red, blue]), [
      { position: { x: 120, y: 120 }, velocity: still },
      { position: blueAt, velocity: still },
    ]),
    minions,
    nextMinionId: minions.length,
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

const ofType = <T extends SimEvent['type']>(events: readonly SimEvent[], type: T) =>
  events.filter((event): event is Extract<SimEvent, { type: T }> => event.type === type);

describe('minions', () => {
  describe('summoning', () => {
    const owner = createWorld(1, [red, blue]).balls[0];
    const request = {
      kind: 'spawnMinion',
      velocity: { x: 600, y: 0 },
      radius: 20,
      damage: 9,
      lifetimeTicks: 60,
      maxAlive: 2,
    } as const;

    it('appears just outside its owner, heading along its velocity, with a new id', () => {
      if (owner === undefined) throw new Error('expected a ball');
      const placed = { ...owner, position: { x: 300, y: 300 } };
      const result = applyActions(sceneOf([placed]), placed.id, [request], testLookup, 4, 1000);
      expect(result.minions).toStrictEqual([
        {
          id: 'minion-0',
          ownerId: placed.id,
          position: { x: 300 + placed.radius + 20 + 1, y: 300 },
          velocity: { x: 600, y: 0 },
          radius: 20,
          damage: 9,
          ticksLeft: 60,
        },
      ]);
      expect(result.nextMinionId).toBe(1);
      expect(result.events).toStrictEqual([
        expect.objectContaining({ type: 'minionSpawned', minionId: 'minion-0', tick: 4 }),
      ]);
    });

    it('never has more than maxAlive at once: a summon over the cap does nothing', () => {
      if (owner === undefined) throw new Error('expected a ball');
      const placed = { ...owner, position: { x: 300, y: 300 } };
      const three = applyActions(
        sceneOf([placed]),
        placed.id,
        [request, request, request],
        testLookup,
        1,
        1000,
      );
      expect(three.minions.map(({ id }) => id)).toStrictEqual(['minion-0', 'minion-1']);
      expect(ofType(three.events, 'minionSpawned')).toHaveLength(2);
    });

    it('throws for an invalid request', () => {
      if (owner === undefined) throw new Error('expected a ball');
      for (const bad of [
        { ...request, maxAlive: 0 },
        { ...request, velocity: still },
      ]) {
        expect(() => applyActions(sceneOf([owner]), owner.id, [bad], testLookup, 1, 1000)).toThrow(
          /invalid minion/,
        );
      }
    });
  });

  it('moves straight and bounces off a wall exactly as a ball would, keeping its speed', () => {
    const near = minion(0, 960, 800, 30);
    const { world } = play(scene([near]), 1);
    const moved = world.minions[0];
    expect(moved?.position).toStrictEqual(moveBall(near, 1000).ball.position);
    // Reflected off the right wall, then given the seeded turn, as balls are (ADR 0004).
    expect(moved?.velocity.x).toBeLessThan(0);
    expect(moved?.velocity.y).not.toBe(0);
    const { x, y } = moved?.velocity ?? still;
    const speed = Math.sqrt(x * x + y * y);
    expect(speed).toBeCloseTo(30 / DT, 6);
  });

  it('pops on an enemy ball it crosses completely within one tick (swept)', () => {
    // 400 units a tick from x = 360 to 760, clean past blue (x 524-676 with the minion's reach):
    // a check at either end of the tick would miss it.
    const { world, events } = play(scene([minion(0, 360, 500, 400)]), 1);
    expect(ofType(events, 'minionHit')).toStrictEqual([
      expect.objectContaining({ minionId: 'minion-0', targetId: 'ball-1', amount: 9 }),
    ]);
    expect(ofType(events, 'damage')).toStrictEqual([
      expect.objectContaining({ targetId: 'ball-1', sourceId: 'ball-0', cause: 'ability' }),
    ]);
    expect(world.minions).toStrictEqual([]);
    expect(world.balls[1]?.health).toBe(blue.maxHealth - 9);
  });

  it('follows the bend when it bounces off a wall and hits a ball in the same tick', () => {
    // Heading into the right wall at 80 a tick; blue waits just inside it, below the bounce.
    const bent = minion(0, 930, 600, 80, { velocity: { x: 80 / DT, y: 40 / DT } });
    const { events } = play(scene([bent], { x: 880, y: 700 }), 1);
    expect(ofType(events, 'minionHit')).toHaveLength(1);
  });

  it('passes through its owner and other minions', () => {
    const throughOwner = minion(0, 40, 120, 30);
    const other = minion(1, 160, 120, -30, { ownerId: 'ball-0' });
    const { world, events } = play(scene([throughOwner, other]), 3);
    expect(ofType(events, 'minionHit')).toStrictEqual([]);
    expect(world.minions).toHaveLength(2);
  });

  it('crumbles when its lifetime runs out', () => {
    const { world, events } = play(scene([minion(0, 300, 800, 1, { ticksLeft: 2 })]), 2);
    expect(world.minions).toStrictEqual([]);
    expect(ofType(events, 'minionDestroyed')).toStrictEqual([
      expect.objectContaining({ reason: 'lifetime', tick: 2 }),
    ]);
  });

  describe('destroyed by enemy attacks', () => {
    it('is destroyed by an enemy projectile that reaches it first, which is used up', () => {
      // Blue's arrow flies left along y = 800 into red's still minion, with nothing behind it.
      const world = {
        ...scene([minion(0, 400, 800, 0.0001)]),
        projectiles: [
          {
            id: 'projectile-0',
            ownerId: 'ball-1',
            position: { x: 700, y: 800 },
            velocity: { x: -400 / DT, y: 0 },
            radius: 6,
            damage: 10,
            ticksLeft: 100,
          },
        ],
        nextProjectileId: 1,
      };
      const { world: after, events } = play(world, 1);
      expect(after.minions).toStrictEqual([]);
      expect(after.projectiles).toStrictEqual([]);
      expect(ofType(events, 'projectileExpired')).toStrictEqual([
        expect.objectContaining({ projectileId: 'projectile-0', reason: 'minion' }),
      ]);
      expect(ofType(events, 'minionDestroyed')).toStrictEqual([
        expect.objectContaining({ minionId: 'minion-0', reason: 'projectile', byId: 'ball-1' }),
      ]);
    });

    it('is not touched by its own side’s projectiles', () => {
      const world = {
        ...scene([minion(0, 400, 800, 0.0001)]),
        projectiles: [
          {
            id: 'projectile-0',
            ownerId: 'ball-0',
            position: { x: 300, y: 800 },
            velocity: { x: 300 / DT, y: 0 },
            radius: 6,
            damage: 10,
            ticksLeft: 100,
          },
        ],
        nextProjectileId: 1,
      };
      const { world: after } = play(world, 1);
      expect(after.minions).toHaveLength(1);
    });

    it('is destroyed by an enemy zone strike it is inside, with every other minion inside it', () => {
      const zone = {
        id: 'zone-0',
        ownerId: 'ball-1',
        position: { x: 300, y: 800 },
        radius: 150,
        damage: 10,
        spawnTick: 0,
        strikeTick: 1,
      };
      const minions = [
        minion(0, 260, 800, 0.0001),
        minion(1, 340, 760, 0.0001),
        minion(2, 800, 300, 0.0001),
      ];
      const { world, events } = play({ ...scene(minions), zones: [zone], nextZoneId: 1 }, 1);
      expect(world.minions.map(({ id }) => id)).toStrictEqual(['minion-2']);
      expect(ofType(events, 'minionDestroyed').map((event) => event.reason)).toStrictEqual([
        'zone',
        'zone',
      ]);
    });
  });

  it('is plain data that a world snapshot replays identically', () => {
    const lookup = indexDefinitions([red, blue]);
    const world = scene([minion(0, 500, 300, 12, { velocity: { x: 9 / DT, y: 7 / DT } })]);
    const twice = [play(world, 120, lookup).world, play(world, 120, lookup).world];
    expect(JSON.parse(JSON.stringify(twice[0]))).toStrictEqual(twice[1]);
  });
});
