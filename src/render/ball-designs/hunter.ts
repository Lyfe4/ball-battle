import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** The jaw ring's radius, and how far each tooth reaches in from it, as fractions of r. */
const RING = 0.62;
const TOOTH = 0.26;
/** Teeth round the jaw; their corners are fixed ratios, so no trigonometry per frame. */
const TEETH: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.5, 0.866],
  [-0.5, 0.866],
  [-1, 0],
  [-0.5, -0.866],
  [0.5, -0.866],
];

/** One tooth: a small triangle from the ring pointing in, its base along the ring. */
function tooth(p: Painter, x: number, y: number, r: number): void {
  const base = RING * r;
  const tip = (RING - TOOTH) * r;
  const half = 0.16 * r;
  // The base's ends sit across the tooth's direction (x, y) -> (-y, x).
  p.moveTo(x * base - y * half, y * base + x * half);
  p.lineTo(x * tip, y * tip);
  p.lineTo(x * base + y * half, y * base - x * half);
}

/**
 * A jaw trap seen from above (prototype): a ring with six teeth pointing in, lined in its accent.
 * Never rotates. At small size only the ring and three thick teeth show.
 */
export const hunterDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    p.strokeStyle = accent;
    p.fillStyle = accent;
    p.lineWidth = r * theme.markLine * (simple ? 1.6 : 1);
    p.lineJoin = 'round';
    p.beginPath();
    p.arc(0, 0, RING * r, 0, Math.PI * 2);
    p.stroke();
    p.beginPath();
    TEETH.forEach(([x, y], index) => {
      if (simple && index % 2 === 1) return;
      tooth(p, x, y, r);
    });
    p.fill();
  },
};
