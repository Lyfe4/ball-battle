import { describe, expect, it } from 'vitest';
import { CHARGE_TICKS, sniper } from '../sim/balls/sniper.ts';
import { red, withBalls } from '../sim/test-support.ts';
import { createWorld } from '../sim/world.ts';
import { aimLineOf, distanceToWall, laserAlpha } from './aim-line.ts';
import { theme } from './theme.ts';

describe('distanceToWall', () => {
  it('runs to the nearest wall the ray points at', () => {
    expect(distanceToWall({ x: 200, y: 500 }, { x: 1, y: 0 }, 1000)).toBe(800);
    expect(distanceToWall({ x: 200, y: 500 }, { x: -1, y: 0 }, 1000)).toBe(200);
    expect(distanceToWall({ x: 200, y: 900 }, { x: 0, y: 1 }, 1000)).toBe(100);
    // Diagonal: the top wall (500 units up) comes before the right wall (800 across).
    const diagonal = distanceToWall({ x: 200, y: 500 }, { x: 0.6, y: -0.8 }, 1000);
    expect(diagonal).toBeCloseTo(625, 9);
  });

  it('is 0 from a point on the wall it points at', () => {
    expect(distanceToWall({ x: 1000, y: 500 }, { x: 1, y: 0 }, 1000)).toBe(0);
  });
});

describe('aimLineOf', () => {
  const world = createWorld(1, [sniper, red]);
  const charging = (fireTick: number) =>
    withBalls(world, [
      {
        position: { x: 200, y: 500 },
        abilityState: { nextChargeTick: 0, charge: { fireTick, aim: { x: 1, y: 0 } } },
      },
      {},
    ]).balls[0];

  it('runs from the ball’s edge along its locked aim to the wall', () => {
    const ball = charging(100);
    expect(ball === undefined ? undefined : aimLineOf(ball, 100 - CHARGE_TICKS, 1000)).toEqual({
      from: { x: 200 + sniper.radius, y: 500 },
      to: { x: 1000, y: 500 },
      progress: 0,
    });
  });

  it('reports how far the charge has gone', () => {
    const ball = charging(100);
    expect(ball === undefined ? undefined : aimLineOf(ball, 100, 1000)?.progress).toBe(1);
  });

  it('has no line without a locked aim, or for any other ball', () => {
    const [idle, other] = world.balls;
    expect(idle === undefined ? 'missing' : aimLineOf(idle, 0, 1000)).toBeUndefined();
    expect(other === undefined ? 'missing' : aimLineOf(other, 0, 1000)).toBeUndefined();
  });
});

describe('laserAlpha', () => {
  it('brightens from faint to full over the charge', () => {
    expect(laserAlpha(0)).toBe(theme.laserMinAlpha);
    expect(laserAlpha(1)).toBe(theme.laserMaxAlpha);
  });
});
