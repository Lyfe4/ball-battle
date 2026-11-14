import { describe, expect, it } from 'vitest';
import { courtDifference, sameCourt, type Court } from './court-compare.ts';

const WIDTH = 64;
const HEIGHT = 64;

/** A grey court with a green disc of `radius` at (cx, cy), RGBA like getImageData. */
function court(cx = 32, cy = 32, radius = 10): Court {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const inside = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius;
      pixels.set(inside ? [17, 127, 58, 255] : [200, 200, 200, 255], (y * WIDTH + x) * 4);
    }
  }
  return { size: `${String(WIDTH)}x${String(HEIGHT)}`, pixels };
}

/** `base` with `count` pixels along the disc's edge nudged by `step` in green. */
function nudged(base: Court, count: number, step: number): Court {
  const pixels = Uint8ClampedArray.from(base.pixels);
  for (let at = 0; at < count; at += 1) {
    const index = ((22 + at) * WIDTH + 32) * 4 + 1;
    pixels[index] = (pixels[index] ?? 0) + step;
  }
  return { size: base.size, pixels };
}

describe('sameCourt', () => {
  it('accepts the same picture', () => {
    expect(sameCourt(court(), court())).toBe(true);
  });

  it('accepts a few edge pixels one or two steps apart (another rasteriser, PR #38)', () => {
    expect(sameCourt(court(), nudged(court(), 3, 1))).toBe(true);
    expect(sameCourt(court(), nudged(court(), 20, 2))).toBe(true);
  });

  it('refuses a pixel more than two steps apart', () => {
    expect(sameCourt(court(), nudged(court(), 1, 3))).toBe(false);
  });

  it('refuses many pixels, however slightly apart', () => {
    expect(sameCourt(court(), nudged(court(), 40, 1))).toBe(false);
  });

  it('refuses a ball moved one pixel, or missing', () => {
    expect(sameCourt(court(), court(33, 32))).toBe(false);
    expect(sameCourt(court(), court(32, 32, 0))).toBe(false);
  });

  it('refuses another size', () => {
    expect(sameCourt(court(), { ...court(), size: '64x65' })).toBe(false);
  });

  it('reports how many pixels differ and by how much', () => {
    expect(courtDifference(court(), nudged(court(), 3, 2))).toStrictEqual({
      differing: 3,
      worst: 2,
    });
  });
});
