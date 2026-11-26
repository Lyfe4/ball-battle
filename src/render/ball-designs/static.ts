import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** The zigzag's corners across the ball, as fractions of r. */
const ZIGZAG: readonly (readonly [number, number])[] = [
  [-0.7, -0.1],
  [-0.35, 0.25],
  [-0.05, -0.25],
  [0.25, 0.25],
  [0.7, -0.1],
];

/**
 * Static (prototype): a crackling zigzag across it in its accent, and a white spark over its
 * middle once it is one hit from sparking (its ability state). Never rotates.
 */
export const staticDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, ball, simple }) {
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineJoin = 'round';
    p.lineWidth = r * theme.markLine * (simple ? 1.8 : 1.2);
    p.beginPath();
    ZIGZAG.forEach(([x, y], index) => {
      if (index === 0) p.moveTo(x * r, y * r);
      else p.lineTo(x * r, y * r);
    });
    p.stroke();
    if (ball.abilityState['charge'] !== 1) return;
    p.fillStyle = theme.highlight;
    p.beginPath();
    p.arc(-0.05 * r, -0.25 * r, r * (simple ? 0.2 : 0.14), 0, Math.PI * 2);
    p.fill();
  },
};
