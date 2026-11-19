import { describe, expect, it } from 'vitest';
import { STANDARD_BALL_RADIUS } from '../../sim/constants.ts';
import { MAX_RADIUS, titan } from '../../sim/balls/titan.ts';
import { createWorld } from '../../sim/world.ts';
import { TITAN_LOOKS, titanDesign, titanGrowth } from './titan.ts';
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
  for (const [name, design] of Object.entries(TITAN_LOOKS)) {
    it(`${name}: draws the very same parts at every size, so nothing appears or disappears`, () => {
      const first = parts(record(design, view(STANDARD_BALL_RADIUS, true)));
      for (const radius of SIZES) {
        for (const simple of [true, false]) {
          expect(parts(record(design, view(radius, simple)))).toStrictEqual(first);
        }
      }
    });

    it(`${name}: ignores the small-size switch: phone and desktop draw it alike`, () => {
      for (const radius of SIZES) {
        expect(record(design, view(radius, true))).toStrictEqual(
          record(design, view(radius, false)),
        );
      }
    });

    it(`${name}: changes only a little between neighbouring sizes, never with a jump`, () => {
      const numbers = (radius: number) =>
        record(design, view(radius, false)).flatMap((call) =>
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
  }

  it('gets heavier as it grows: growth runs from 0 at the start to 1 at its largest', () => {
    expect(titanGrowth(STANDARD_BALL_RADIUS)).toBe(0);
    expect(titanGrowth(MAX_RADIUS)).toBe(1);
    expect(titanGrowth(MAX_RADIUS + 10)).toBe(1);
  });

  it('draws as the chosen variation', () => {
    const shown = view(70, false);
    expect(record(titanDesign, shown)).toStrictEqual(record(TITAN_LOOKS.lintel, shown));
  });
});
