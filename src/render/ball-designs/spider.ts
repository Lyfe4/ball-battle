import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** Each leg on one side, as [hip x, hip y, knee x, knee y, foot x, foot y] fractions of r. */
const LEGS = [
  [0.12, -0.16, 0.42, -0.5, 0.62, -0.42],
  [0.16, -0.06, 0.52, -0.22, 0.76, -0.08],
  [0.16, 0.06, 0.52, 0.2, 0.74, 0.34],
  [0.12, 0.16, 0.4, 0.46, 0.5, 0.7],
] as const;

/**
 * The Spider (ADR 0049): a dark spider on a silver ball, seen from above, a round body and head and
 * four bent legs a side, facing where it goes. (A dark ball would fail 3:1 against the court, so
 * the ball is silver and the spider dark.) At small size the legs thicken.
 */
export const spiderDesign: BallDesign = {
  facing: 'velocity',
  draw(p, { radius: r, accent, simple }) {
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineJoin = 'round';
    p.lineWidth = (simple ? 0.13 : theme.markLine * 0.85) * r;
    for (const side of [-1, 1]) {
      for (const [hx, hy, kx, ky, fx, fy] of LEGS) {
        // +x is the heading: the legs spread sideways (y), bending forward and back.
        p.beginPath();
        p.moveTo(-hy * r, side * hx * r);
        p.lineTo(-ky * r, side * kx * r);
        p.lineTo(-fy * r, side * fx * r);
        p.stroke();
      }
    }
    p.fillStyle = accent;
    p.beginPath();
    p.arc(-0.14 * r, 0, 0.26 * r, 0, Math.PI * 2);
    p.fill();
    p.beginPath();
    p.arc(0.2 * r, 0, 0.15 * r, 0, Math.PI * 2);
    p.fill();
  },
};
