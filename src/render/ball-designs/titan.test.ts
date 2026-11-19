import { describe, expect, it } from 'vitest';
import { STANDARD_BALL_RADIUS } from '../../sim/constants.ts';
import { MAX_RADIUS, titan } from '../../sim/balls/titan.ts';
import { createWorld } from '../../sim/world.ts';
import { titanDesign, titanGrowth } from './titan.ts';
import { record } from './test-support.ts';
import type { DesignView } from './types.ts';

function view(radius: number, simple: boolean): DesignView {
  const [ball] = createWorld(1, [titan, titan]).balls;
  if (ball === undefined) throw new Error('expected a ball');
  return {
    ball: { ...ball, radius },
    radius,
    base: titan.color,
    accent: '#052e16',
    tick: 0,
    heading: undefined,
    heal: 0,
    simple,
    shotsOut: 0,
    minionsOut: 0,
  };
}

/** The call names alone: which parts are drawn, and in what order. */
const parts = (calls: readonly string[]) => calls.map((call) => call.replace(/\(.*$/, ''));

const SIZES = Array.from(
  { length: 41 },
  (_, i) => STANDARD_BALL_RADIUS + ((MAX_RADIUS - STANDARD_BALL_RADIUS) * i) / 40,
);

describe('Titan design', () => {
  it('draws the very same parts at every size, so nothing appears or disappears', () => {
    const first = parts(record(titanDesign, view(STANDARD_BALL_RADIUS, true)));
    for (const radius of SIZES) {
      for (const simple of [true, false]) {
        expect(parts(record(titanDesign, view(radius, simple)))).toStrictEqual(first);
      }
    }
  });

  it('ignores the small-size switch: phone and desktop draw it alike', () => {
    for (const radius of SIZES) {
      expect(record(titanDesign, view(radius, true))).toStrictEqual(
        record(titanDesign, view(radius, false)),
      );
    }
  });

  it('changes only a little between neighbouring sizes, never with a jump', () => {
    const numbers = (radius: number) =>
      record(titanDesign, view(radius, false)).flatMap((call) =>
        [...call.matchAll(/-?\d+\.\d+/g)].map((match) => Number(match[0])),
      );
    for (let i = 1; i < SIZES.length; i++) {
      const before = numbers(SIZES[i - 1] ?? 0);
      const after = numbers(SIZES[i] ?? 0);
      expect(after).toHaveLength(before.length);
      after.forEach((value, index) => {
        expect(Math.abs(value - (before[index] ?? 0))).toBeLessThan(0.02);
      });
    }
  });

  it('gets a heavier brow as it grows: its eyes sit deeper under it at its largest', () => {
    // The eyes are the two arcs of radius 0.085 r, set just under the brow's shadow.
    const eyeY = (radius: number) =>
      record(titanDesign, view(radius, false))
        .filter((call) => call.startsWith('arc(') && call.endsWith(',0.0850)'))
        .map((call) => Number(call.slice(4).split(',')[1]));
    const [start] = eyeY(STANDARD_BALL_RADIUS);
    const [full] = eyeY(MAX_RADIUS);
    expect(eyeY(STANDARD_BALL_RADIUS)).toHaveLength(2);
    expect((full ?? 0) - (start ?? 0)).toBeGreaterThan(0.1);
    expect(titanGrowth(STANDARD_BALL_RADIUS)).toBe(0);
    expect(titanGrowth(MAX_RADIUS)).toBe(1);
    expect(titanGrowth(MAX_RADIUS + 10)).toBe(1);
  });
});
