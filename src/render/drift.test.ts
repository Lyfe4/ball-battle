import { describe, expect, it } from 'vitest';
import { balloon } from '../sim/balls/balloon.ts';
import { createWorld } from '../sim/world.ts';
import { red, withBalls } from '../sim/test-support.ts';
import { createDrift, followDrift, shadowOffset, STILL } from './drift.ts';
import { theme } from './theme.ts';

const moving = (vx: number, vy: number) =>
  withBalls(createWorld(1, [balloon, red]), [{ velocity: { x: vx, y: vy } }]);

describe('a floating ball’s drift (ADR 0075)', () => {
  it('follows its velocity smoothly, more of the way the longer the frame', () => {
    const short = followDrift({ x: 0, y: 0 }, { x: 100, y: 0 }, 16);
    const long = followDrift({ x: 0, y: 0 }, { x: 100, y: 0 }, 160);
    expect(short.x).toBeGreaterThan(0);
    expect(long.x).toBeGreaterThan(short.x);
    expect(long.x).toBeLessThan(100);
    expect(followDrift({ x: 40, y: 0 }, { x: 100, y: 0 }, -50)).toStrictEqual({ x: 40, y: 0 });
  });

  it('swings round after a bounce rather than snapping', () => {
    const drift = createDrift();
    drift.update(moving(700, 0), 0, false);
    const [ball] = moving(700, 0).balls;
    if (ball === undefined) throw new Error('No ball');
    expect(drift.of(ball.id)).toStrictEqual({ x: 700, y: 0 });
    drift.update(moving(-700, 0), 16, false);
    const after = drift.of(ball.id);
    expect(after.x).toBeGreaterThan(-700);
    expect(after.x).toBeLessThan(700);
  });

  it('is still with reduced motion, and for a ball that doesn’t float', () => {
    const drift = createDrift();
    const world = moving(700, 0);
    drift.update(world, 0, true);
    const [floating, other] = world.balls;
    if (floating === undefined || other === undefined) throw new Error('No balls');
    expect(drift.of(floating.id)).toBe(STILL);
    drift.update(world, 16, false);
    expect(drift.of(other.id)).toBe(STILL);
  });

  it('puts the shadow behind the way it drifts, never further than its limit', () => {
    const still = shadowOffset(50, STILL);
    expect(still).toStrictEqual({
      x: theme.shadowOffsetX * 50,
      y: theme.shadowOffsetY * 50,
      stretch: 0,
    });
    const right = shadowOffset(50, { x: 300, y: 0 });
    expect(right.x).toBeLessThan(still.x);
    const fast = shadowOffset(50, { x: 100_000, y: 0 });
    expect(still.x - fast.x).toBeCloseTo(theme.shadowLagMost * 50);
    expect(fast.stretch).toBe(1);
  });
});
