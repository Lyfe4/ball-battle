import { describe, expect, it } from 'vitest';
import { boltPoints, burnLook, strikeProgress } from './zone-geometry.ts';
import { theme } from './theme.ts';

describe('boltPoints', () => {
  const target = { x: 420, y: 610 };

  it('draws the same bolt for the same zone, so a replay looks identical', () => {
    expect(boltPoints('zone-7', target)).toStrictEqual(boltPoints('zone-7', target));
  });

  it('draws a different bolt for a different zone', () => {
    expect(boltPoints('zone-8', target)).not.toStrictEqual(boltPoints('zone-7', target));
  });

  it('runs from the top of the arena down to the zone centre, within the jitter', () => {
    const points = boltPoints('zone-3', target);
    expect(points).toHaveLength(theme.boltSegments + 1);
    expect(points[0]?.y).toBe(0);
    expect(points.at(-1)).toStrictEqual(target);
    for (const point of points) {
      expect(Math.abs(point.x - target.x)).toBeLessThanOrEqual(theme.boltJitter);
    }
    const ys = points.map((point) => point.y);
    expect(ys).toStrictEqual([...ys].sort((a, b) => a - b));
  });
});

describe('strikeProgress', () => {
  const zone = { spawnTick: 100, strikeTick: 148 };

  it('fills from 0 when the zone appears to 1 on its strike tick', () => {
    expect(strikeProgress(zone, 100)).toBe(0);
    expect(strikeProgress(zone, 124)).toBe(0.5);
    expect(strikeProgress(zone, 148)).toBe(1);
  });

  it('stays within 0 to 1 outside the warning', () => {
    expect(strikeProgress(zone, 90)).toBe(0);
    expect(strikeProgress(zone, 200)).toBe(1);
    expect(strikeProgress({ spawnTick: 5, strikeTick: 5 }, 5)).toBe(1);
  });
});

describe('a burning patch', () => {
  const patch = { spawnTick: 0, strikeTick: 20, endTick: 140, pulseEveryTicks: 15 };

  it('grows while it catches, then burns at full size', () => {
    expect(burnLook(patch, 10, 6)).toStrictEqual({ caught: 0.5, life: 1, glow: 0 });
    expect(burnLook(patch, 20, 6)).toStrictEqual({ caught: 1, life: 1, glow: 1 });
  });

  it('flares on each burn, and fades as it burns out', () => {
    expect(burnLook(patch, 23, 6).glow).toBeCloseTo(0.5, 9);
    expect(burnLook(patch, 29, 6).glow).toBe(0);
    expect(burnLook(patch, 35, 6).glow).toBe(1);
    expect(burnLook(patch, 80, 6).life).toBeCloseTo(0.5, 9);
    expect(burnLook(patch, 140, 6).life).toBe(0);
  });
});
