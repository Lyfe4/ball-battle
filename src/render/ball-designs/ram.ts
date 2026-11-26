import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/**
 * A ram (prototype): two heavy curled horns in its accent, one each side of a blunt brow plate,
 * facing where it heads. At small size the horns are thicker and the brow plate goes.
 */
export const ramDesign: BallDesign = {
  facing: 'velocity',
  draw(p, { radius: r, accent, simple }) {
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineWidth = r * theme.markLine * (simple ? 2.2 : 1.7);
    for (const side of [-1, 1]) {
      p.beginPath();
      p.arc(-0.05 * r, side * 0.42 * r, 0.3 * r, side * 1.2, side * 1.2 + side * 4.4, side < 0);
      p.stroke();
    }
    if (simple) return;
    p.fillStyle = accent;
    p.beginPath();
    p.rect(0.4 * r, -0.16 * r, 0.32 * r, 0.32 * r);
    p.fill();
  },
};
