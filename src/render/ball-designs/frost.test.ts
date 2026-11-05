import { describe, expect, it } from 'vitest';
import { createWorld } from '../../sim/world.ts';
import { frost } from '../../sim/balls/frost.ts';
import { frostDesign } from './frost.ts';
import type { DesignView, Painter } from './types.ts';

/** A painter that records the points it is sent to, and how often it fills and strokes. */
function recorder() {
  const points: { x: number; y: number; lineWidth: number }[] = [];
  const calls = { fill: 0, stroke: 0 };
  const painter: Painter = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo(x, y) {
      points.push({ x, y, lineWidth: this.lineWidth });
    },
    lineTo(x, y) {
      points.push({ x, y, lineWidth: this.lineWidth });
    },
    arc: () => undefined,
    rect: () => undefined,
    fill: () => {
      calls.fill++;
    },
    stroke: () => {
      calls.stroke++;
    },
    clip: () => undefined,
    setLineDash: () => undefined,
  };
  return { painter, points, calls };
}

function view(simple: boolean): DesignView {
  const [ball] = createWorld(1, [frost, frost]).balls;
  if (ball === undefined) throw new Error('expected a ball');
  return {
    ball,
    radius: 30,
    base: '#bae6fd',
    accent: '#0c4a6e',
    tick: 0,
    heading: undefined,
    heal: 0,
    simple,
  };
}

describe('Frost design', () => {
  it('draws a snowflake of strokes at every size, never a filled shape that reads as a gem', () => {
    for (const simple of [true, false]) {
      const { painter, calls } = recorder();
      frostDesign.draw(painter, view(simple));
      expect(calls.fill).toBe(0);
      expect(calls.stroke).toBeGreaterThan(0);
    }
  });

  it('is the same flake at both sizes, with more branches when there is room', () => {
    const small = recorder();
    frostDesign.draw(small.painter, view(true));
    const full = recorder();
    frostDesign.draw(full.painter, view(false));
    // Six spokes, each a line out from the centre plus a pair of branches per branch point.
    expect(small.points).toHaveLength(6 * (2 + 4));
    expect(full.points).toHaveLength(6 * (2 + 8));
    // The spokes reach the same tips at both sizes.
    const tips = (points: { x: number; y: number }[]) =>
      points.filter((_, i) => i % (points.length / 6) === 1).map(({ x, y }) => [x, y]);
    expect(tips(full.points)).toStrictEqual(tips(small.points));
  });

  it('keeps every mark inside the ball, line weight included, at both sizes', () => {
    for (const simple of [true, false]) {
      const { painter, points } = recorder();
      const { radius } = view(simple);
      frostDesign.draw(painter, view(simple));
      for (const { x, y, lineWidth } of points) {
        expect(Math.hypot(x, y) + lineWidth / 2).toBeLessThan(radius);
      }
    }
  });
});
