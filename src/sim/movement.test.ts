import { describe, expect, it } from 'vitest';
import { DT } from './constants.ts';
import { moveBall } from './movement.ts';
import type { BallState } from './types.ts';

const SIZE = 1000;
const RADIUS = 50;

function ballMoving(x: number, y: number, vx: number, vy: number): BallState {
  return {
    id: 'ball-0',
    definitionId: 'test',
    position: { x, y },
    velocity: { x: vx, y: vy },
    radius: RADIUS,
    health: 1,
    abilityState: {},
    statuses: [],
  };
}

/** Velocity that moves `distance` world units in one tick. */
const perTick = (distance: number): number => distance / DT;

describe('moveBall bounces', () => {
  it('reports no bounce for a move inside the arena', () => {
    expect(moveBall(ballMoving(500, 500, perTick(10), 0), SIZE).bounces).toBe(0);
  });

  it('reports one bounce per wall hit', () => {
    expect(moveBall(ballMoving(940, 500, perTick(20), 0), SIZE).bounces).toBe(1);
    expect(moveBall(ballMoving(60, 500, perTick(-20), 0), SIZE).bounces).toBe(1);
  });

  it('counts a corner hit as two bounces, one per axis', () => {
    const corner = moveBall(ballMoving(940, 940, perTick(20), perTick(20)), SIZE);
    expect(corner.bounces).toBe(2);
    expect([corner.bouncesX, corner.bouncesY]).toStrictEqual([1, 1]);
    const side = moveBall(ballMoving(940, 500, perTick(20), perTick(5)), SIZE);
    expect([side.bouncesX, side.bouncesY]).toStrictEqual([1, 0]);
  });

  it('counts every wall crossed by a very fast ball', () => {
    // Range is 900. From x=500, walls are hit after travelling 450, 1350, 2250, ...
    expect(moveBall(ballMoving(500, 500, perTick(2000), 0), SIZE).bounces).toBe(2);
    expect(moveBall(ballMoving(500, 500, perTick(-2000), 0), SIZE).bounces).toBe(2);
    expect(moveBall(ballMoving(500, 500, perTick(2500), 0), SIZE).bounces).toBe(3);
  });

  it('matches the velocity flip parity', () => {
    for (const distance of [5, 450, 451, 1300, 1351, 2000, 2700, -451, -1351, -2000]) {
      const { ball, bounces } = moveBall(ballMoving(500, 500, perTick(distance), 0), SIZE);
      const flipped = Math.sign(ball.velocity.x) !== Math.sign(distance);
      expect(flipped).toBe(bounces % 2 === 1);
    }
  });
});
