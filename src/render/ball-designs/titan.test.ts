import { describe, expect, it } from 'vitest';
import { STANDARD_BALL_RADIUS } from '../../sim/constants.ts';
import { MAX_RADIUS, titan } from '../../sim/balls/titan.ts';
import { createWorld } from '../../sim/world.ts';
import { titanDesign, titanGrowth } from './titan.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

/** Every call a design makes, numbers divided by r so drawings at two sizes can be compared. */
function record(design: BallDesign, view: DesignView): string[] {
  const r = view.radius;
  const calls: string[] = [];
  const log =
    (name: string) =>
    (...args: number[]): void => {
      calls.push(`${name}(${args.map((n) => (n / r).toFixed(4)).join(',')})`);
    };
  const painter: Painter = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: log('translate'),
    rotate: (angle) => calls.push(`rotate(${angle.toFixed(4)})`),
    scale: (x, y) => calls.push(`scale(${x.toFixed(4)},${y.toFixed(4)})`),
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    moveTo: log('moveTo'),
    lineTo: log('lineTo'),
    quadraticCurveTo: log('quadraticCurveTo'),
    arc: (x, y, radius) => {
      log('arc')(x, y, radius);
    },
    rect: log('rect'),
    fill() {
      calls.push(`fill(${String(this.fillStyle)},${this.globalAlpha.toFixed(4)})`);
    },
    stroke() {
      calls.push(`stroke(${String(this.strokeStyle)},${(this.lineWidth / r).toFixed(4)})`);
    },
    clip: () => calls.push('clip'),
    setLineDash: () => calls.push('setLineDash'),
  };
  design.draw(painter, view);
  return calls;
}

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
