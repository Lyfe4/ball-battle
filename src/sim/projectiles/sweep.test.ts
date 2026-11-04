import { describe, expect, it } from 'vitest';
import { sweepHitTime, wallHitTime } from './sweep.ts';

describe('sweepHitTime', () => {
  it('finds the moment a head-on shot touches', () => {
    // 100 units away, reach 20, moving 200 per tick: touches after 80 units, at s = 0.4.
    expect(sweepHitTime({ x: -100, y: 0 }, { x: 200, y: 0 }, 20)).toBeCloseTo(0.4, 12);
  });

  it('hits a ball it would cross completely within one tick', () => {
    // Travels 1000 units past a ball 50 wide: a discrete check at either end would miss.
    const s = sweepHitTime({ x: -400, y: 0 }, { x: 1000, y: 0 }, 50);
    expect(s).toBeCloseTo(0.35, 12);
  });

  it('misses when the path passes outside reach, ends short, or moves away', () => {
    expect(sweepHitTime({ x: -100, y: 30 }, { x: 200, y: 0 }, 20)).toBeUndefined();
    expect(sweepHitTime({ x: -100, y: 0 }, { x: 50, y: 0 }, 20)).toBeUndefined();
    expect(sweepHitTime({ x: -100, y: 0 }, { x: -50, y: 0 }, 20)).toBeUndefined();
    expect(sweepHitTime({ x: -100, y: 0 }, { x: 0, y: 0 }, 20)).toBeUndefined();
  });

  it('reports an immediate hit when already touching', () => {
    expect(sweepHitTime({ x: 5, y: 5 }, { x: 100, y: 0 }, 20)).toBe(0);
  });

  it('grazes exactly at the edge', () => {
    expect(sweepHitTime({ x: -100, y: 20 }, { x: 200, y: 0 }, 20)).toBeCloseTo(0.5, 12);
  });

  it('works on relative motion: a fast ball crossing a still arrow', () => {
    // Arrow still at the origin, ball moving +x from -300 by 600 this tick. Relative to the ball,
    // the arrow starts at +300 and moves -600.
    const s = sweepHitTime({ x: 300, y: 0 }, { x: -600, y: 0 }, 30);
    expect(s).toBeCloseTo(270 / 600, 12);
  });
});

describe('wallHitTime', () => {
  it('finds the first wall along the path', () => {
    // r = 5 in a 1000 arena: the right wall is at x = 995; 95 away, moving 190 per tick.
    expect(wallHitTime({ x: 900, y: 500 }, { x: 190, y: 0 }, 5, 1000)).toBeCloseTo(0.5, 12);
    // Diagonal: y reaches its wall first.
    expect(wallHitTime({ x: 500, y: 100 }, { x: 100, y: -190 }, 5, 1000)).toBeCloseTo(0.5, 12);
  });

  it('is undefined when no wall is reached this tick', () => {
    expect(wallHitTime({ x: 500, y: 500 }, { x: 100, y: 100 }, 5, 1000)).toBeUndefined();
  });
});
