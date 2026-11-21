// Shared by the design tests: a painter that records every call a design makes.
import type { BallDesign, DesignView, Painter } from './types.ts';

/** Every call a design makes (its markings, outline and parts over it), numbers divided by r so drawings at two sizes can be compared. */
export function record(design: BallDesign, view: DesignView): string[] {
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
  // The body's own outline and the parts over it, after the markings (so a test reading the
  // markings by index is unchanged).
  design.outline?.(painter, view);
  design.over?.(painter, view);
  return calls;
}
