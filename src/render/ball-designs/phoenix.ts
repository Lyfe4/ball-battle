import { heatOf, phoenix } from '../../sim/balls/phoenix.ts';
import type { BallDesign, Painter } from './types.ts';

/** Petal directions round the core: fixed ratios, so no trigonometry per frame. */
const PETALS: readonly (readonly [number, number])[] = [
  [0, -1],
  [0.866, -0.5],
  [0.866, 0.5],
  [0, 1],
  [-0.866, 0.5],
  [-0.866, -0.5],
];
/** A petal's length as a fraction of r: short at full health, near the rim at its hottest. */
const SHORT = 0.36;
const LONG = 0.86;
const WIDTH = 0.2;
const CORE = 0.2;

/** One flame petal: a pointed teardrop from the core out along (x, y). */
function petal(p: Painter, x: number, y: number, r: number, length: number): void {
  const half = WIDTH * r;
  const mid = 0.45 * length;
  p.moveTo(0, 0);
  p.quadraticCurveTo(x * mid - y * half, y * mid + x * half, x * length, y * length);
  p.quadraticCurveTo(x * mid + y * half, y * mid - x * half, 0, 0);
}

/**
 * A ring of flame petals (prototype) that grow from the core toward the rim as the Phoenix is
 * hurt: the drawing reads its fire's reach at a glance. At small size three thick petals show.
 */
export const phoenixDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const heat = heatOf(ball.health, phoenix.maxHealth);
    const length = (SHORT + (LONG - SHORT) * heat) * r;
    p.fillStyle = accent;
    p.beginPath();
    PETALS.forEach(([x, y], index) => {
      if (simple && index % 2 === 1) return;
      petal(p, x, y, r, length);
    });
    p.fill();
    p.beginPath();
    p.arc(0, 0, CORE * r, 0, Math.PI * 2);
    p.fill();
  },
};
