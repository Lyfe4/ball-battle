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
  it('draws a snowflake of strokes at small size, not a filled hexagon that reads as a gem', () => {
    const { painter, points, calls } = recorder();
    frostDesign.draw(painter, view(true));
    expect(calls.fill).toBe(0);
    expect(calls.stroke).toBeGreaterThan(0);
    // Six spokes, each a line out from the centre plus two branches: 18 segments of two points.
    expect(points).toHaveLength(36);
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
