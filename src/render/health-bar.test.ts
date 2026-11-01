import { describe, expect, it } from 'vitest';
import type { BallState } from '../sim/types.ts';
import { healthBarRect, healthColor } from './health-bar.ts';
import { theme } from './theme.ts';

function ballAt(x: number, y: number, radius = 50): BallState {
  return {
    id: 'ball-0',
    definitionId: 'red',
    position: { x, y },
    velocity: { x: 0, y: 0 },
    radius,
    health: 50,
    abilityState: {},
  };
}

describe('healthBarRect', () => {
  it('sits centred above the ball', () => {
    const rect = healthBarRect(ballAt(500, 500), 1000);
    expect(rect.y + rect.height).toBe(500 - 50 - theme.healthBarGap);
    expect(rect.x + rect.width / 2).toBe(500);
  });

  it('moves below the ball near the top wall', () => {
    const rect = healthBarRect(ballAt(500, 55), 1000);
    expect(rect.y).toBe(55 + 50 + theme.healthBarGap);
  });

  it('stays inside the arena at the side walls', () => {
    // A small ball against the wall: the minimum bar width is wider than the ball.
    expect(healthBarRect(ballAt(30, 500, 30), 1000).x).toBe(0);
    const right = healthBarRect(ballAt(970, 500, 30), 1000);
    expect(right.x + right.width).toBe(1000);
  });
});

describe('healthColor', () => {
  it('goes from high to mid to low', () => {
    expect(healthColor(1)).toBe(theme.healthHigh);
    expect(healthColor(0.5)).toBe(theme.healthMid);
    expect(healthColor(0.25)).toBe(theme.healthLow);
  });
});
