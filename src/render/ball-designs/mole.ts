import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** Clods of a dirt mound, as [x, y, radius] fractions of r: a heap, highest in the middle. */
const CLODS: readonly (readonly [number, number, number])[] = [
  [-0.45, 0.25, 0.22],
  [0, 0.2, 0.26],
  [0.45, 0.25, 0.22],
  [-0.22, -0.12, 0.22],
  [0.22, -0.12, 0.22],
  [0, -0.42, 0.2],
];

/** The mound it raises underground: a heap of dirt clods in its accent. */
function mound(p: Painter, r: number, accent: string, simple: boolean): void {
  p.fillStyle = accent;
  p.beginPath();
  for (const [x, y, size] of CLODS) {
    const clod = size * r * (simple ? 1.2 : 1);
    p.moveTo(x * r + clod, y * r);
    p.arc(x * r, y * r, clod, 0, Math.PI * 2);
  }
  p.fill();
}

/** The mole above ground, facing along its heading: a pointed snout, two eyes and two claws. */
function face(p: Painter, r: number, accent: string, simple: boolean): void {
  p.fillStyle = accent;
  p.beginPath();
  // The snout: a wedge to the front edge, with a round nose at its tip.
  p.moveTo(0.35 * r, -0.28 * r);
  p.lineTo(0.85 * r, 0);
  p.lineTo(0.35 * r, 0.28 * r);
  p.closePath();
  p.fill();
  p.beginPath();
  p.arc(0.78 * r, 0, 0.16 * r, 0, Math.PI * 2);
  p.fill();
  if (!simple) {
    for (const side of [-1, 1]) {
      p.beginPath();
      p.arc(0.12 * r, side * 0.32 * r, 0.09 * r, 0, Math.PI * 2);
      p.fill();
    }
  }
  // Two digging claws, swept back on each side.
  p.strokeStyle = accent;
  p.lineWidth = r * theme.markLine * (simple ? 1.6 : 1);
  p.lineCap = 'round';
  p.beginPath();
  for (const side of [-1, 1]) {
    p.moveTo(-0.15 * r, side * 0.55 * r);
    p.lineTo(-0.5 * r, side * 0.72 * r);
  }
  p.stroke();
}

/**
 * The Mole (prototype): above ground a snout, eyes and claws along its heading; underground (it is
 * drawn see-through, as every phased ball) a heap of dirt clods: the mound tunnelling at its prey.
 * Its burst strikes as a shockwave ring.
 */
export const moleDesign: BallDesign = {
  facing: 'velocity',
  strike: 'shockwave',
  draw(p, { ball, radius: r, accent, simple }) {
    if (ball.abilityState['phase'] !== 'up') mound(p, r, accent, simple);
    else face(p, r, accent, simple);
  },
};
