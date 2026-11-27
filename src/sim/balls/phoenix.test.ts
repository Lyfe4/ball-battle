import { describe, expect, it } from 'vitest';
import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import { createWorld } from '../world.ts';
import {
  BASE_REACH,
  BURN_DAMAGE,
  BURN_EVERY_TICKS,
  FULL_REACH,
  heatOf,
  phoenix,
  reachOf,
} from './phoenix.ts';

const lookup = indexDefinitions([phoenix, blue]);
const R = STANDARD_BALL_RADIUS;

/** The burn the Phoenix deals on its first beat to a ball `gap` past its edge, at `health`. */
function burnAt(health: number, gap: number): number {
  const start = createWorld(1, [phoenix, blue]);
  const otherRadius = start.balls[1]?.radius ?? 0;
  const world = withBalls({ ...start, tick: BURN_EVERY_TICKS - 1 }, [
    { position: { x: 300, y: 300 }, velocity: { x: 0, y: phoenix.speed }, health },
    { position: { x: 300 + R + otherRadius + gap, y: 300 }, velocity: { x: 0, y: blue.speed } },
  ]);
  const { events } = step(world, lookup);
  return events
    .filter((event) => event.type === 'damage' && event.sourceId === 'ball-0')
    .reduce((sum, event) => sum + (event.type === 'damage' ? event.amount : 0), 0);
}

describe('the Phoenix (prototype)', () => {
  it('grows its fire with the health it has lost, widest from a quarter down', () => {
    const max = phoenix.maxHealth;
    expect(heatOf(max, max)).toBe(0);
    expect(reachOf(max, max)).toBe(BASE_REACH);
    expect(reachOf(max * 0.25, max)).toBe(FULL_REACH);
    expect(reachOf(1, max)).toBe(FULL_REACH);
    expect(reachOf(max * 0.6, max)).toBeGreaterThan(BASE_REACH);
    expect(reachOf(max * 0.6, max)).toBeLessThan(FULL_REACH);
  });

  it('burns only what is close at full health, and everything near it once hurt', () => {
    const far = (BASE_REACH + FULL_REACH) / 2;
    expect(burnAt(phoenix.maxHealth, BASE_REACH - 2)).toBe(BURN_DAMAGE);
    expect(burnAt(phoenix.maxHealth, far)).toBe(0);
    expect(burnAt(Math.floor(phoenix.maxHealth / 4), far)).toBe(BURN_DAMAGE);
    expect(burnAt(Math.floor(phoenix.maxHealth / 4), FULL_REACH + 5)).toBe(0);
  });
});
