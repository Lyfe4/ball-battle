import { describe, expect, it } from 'vitest';
import { DT } from '../constants.ts';
import { indexDefinitions } from '../definitions.ts';
import type { MinionState } from '../minions/types.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer, FIRST_SHOT_DELAY_TICKS } from './archer.ts';
import { nearestTarget } from './targeting.ts';

const minion = (id: string, ownerId: string, x: number, y: number): MinionState => ({
  id,
  ownerId,
  position: { x, y },
  velocity: { x: 300, y: 0 },
  radius: 20,
  damage: 5,
  ticksLeft: 100,
});

describe('nearestTarget (ADR 0026)', () => {
  const world = withBalls(createWorld(1, [blue, blue]), [
    { position: { x: 100, y: 500 } },
    { position: { x: 800, y: 500 } },
  ]);
  const [self] = world.balls;
  if (self === undefined) throw new Error('expected a ball');

  it('is the enemy ball when no minion is nearer', () => {
    expect(
      nearestTarget(self, world.balls, [minion('minion-0', 'ball-1', 900, 900)]),
    ).toMatchObject({
      kind: 'ball',
      id: 'ball-1',
    });
  });

  it('is an enemy minion nearer than any enemy ball', () => {
    expect(
      nearestTarget(self, world.balls, [minion('minion-0', 'ball-1', 300, 500)]),
    ).toMatchObject({
      kind: 'minion',
      id: 'minion-0',
      position: { x: 300, y: 500 },
    });
  });

  it('never picks its own minions', () => {
    expect(
      nearestTarget(self, world.balls, [minion('minion-0', 'ball-0', 300, 500)]),
    ).toMatchObject({
      kind: 'ball',
      id: 'ball-1',
    });
  });

  it('gives a tie to the ball', () => {
    expect(
      nearestTarget(self, world.balls, [minion('minion-0', 'ball-1', 800, 500)]),
    ).toMatchObject({
      kind: 'ball',
    });
  });

  it('applies to every aimed attack: an Archer shoots at a nearer minion', () => {
    const lookup = indexDefinitions([archer, blue]);
    // The Archer at the left, its enemy far right, and the enemy's minion straight below it.
    const scene: WorldState = {
      ...withBalls(createWorld(1, [archer, blue]), [
        { position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
        { position: { x: 850, y: 200 }, velocity: { x: 0, y: 0 } },
      ]),
      tick: FIRST_SHOT_DELAY_TICKS - 1,
      minions: [{ ...minion('minion-0', 'ball-1', 200, 500), velocity: { x: 0, y: 0.001 / DT } }],
      nextMinionId: 1,
    };
    const fired = step(scene, lookup).events.find((event) => event.type === 'projectileFired');
    // Straight down at the minion, give or take the Archer's few degrees of spread.
    expect(fired?.velocity.y).toBeGreaterThan(0);
    expect(Math.abs(fired?.velocity.x ?? Infinity)).toBeLessThan((fired?.velocity.y ?? 0) / 10);
  });
});
