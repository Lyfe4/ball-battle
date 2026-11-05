import { describe, expect, it } from 'vitest';
import { assertSteerShare, steerToward } from './steer.ts';

const speedOf = (v: { x: number; y: number }) => Math.sqrt(v.x * v.x + v.y * v.y);

describe('steerToward', () => {
  it('turns the heading toward the point and keeps the speed', () => {
    // Heading +x at 600; the point is straight up (-y).
    const turned = steerToward({ x: 500, y: 500 }, { x: 600, y: 0 }, { x: 500, y: 100 }, 0.5);
    expect(speedOf(turned)).toBeCloseTo(600, 9);
    expect(turned.y).toBeLessThan(0);
    expect(turned.x).toBeGreaterThan(0);
  });

  it('turns further with a larger share', () => {
    const small = steerToward({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 10 }, 0.1);
    const large = steerToward({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 10 }, 0.9);
    expect(large.y).toBeGreaterThan(small.y);
  });

  it('leaves a still ball, a zero share or a ball on the point alone', () => {
    expect(steerToward({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }, 1)).toStrictEqual({
      x: 0,
      y: 0,
    });
    expect(steerToward({ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 5, y: 5 }, 0)).toStrictEqual({
      x: 3,
      y: 4,
    });
    expect(steerToward({ x: 5, y: 5 }, { x: 3, y: 4 }, { x: 5, y: 5 }, 1)).toStrictEqual({
      x: 3,
      y: 4,
    });
  });

  it('heads straight for the point when it was heading exactly away with share 1', () => {
    expect(steerToward({ x: 0, y: 0 }, { x: -10, y: 0 }, { x: 5, y: 0 }, 1)).toStrictEqual({
      x: 10,
      y: 0,
    });
  });
});

describe('assertSteerShare', () => {
  it('accepts 0 to 1 and throws otherwise', () => {
    expect(() => {
      assertSteerShare(0.5, 'ball-0');
    }).not.toThrow();
    for (const bad of [-0.1, 1.1, Number.NaN, Infinity]) {
      expect(() => {
        assertSteerShare(bad, 'ball-0');
      }).toThrow();
    }
  });
});
