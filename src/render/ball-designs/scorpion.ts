import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/**
 * A curled tail seen from above (prototype): a segmented arc curling round the ball's back and over
 * to a barb that points at the nearest enemy (+x, facing 'aim'). At small size: the arc and barb.
 */
export const scorpionDesign: BallDesign = {
  facing: 'aim',
  strike: 'shockwave',
  draw(p, { radius: r, accent, simple }) {
    p.strokeStyle = accent;
    p.fillStyle = accent;
    p.lineCap = 'round';
    p.lineJoin = 'round';
    p.lineWidth = r * theme.markLine * (simple ? 2 : 1.6);
    // The tail: from the back (-x), round the top, ending near the front.
    p.beginPath();
    p.arc(-0.05 * r, 0, 0.5 * r, Math.PI * 0.95, Math.PI * 2.15);
    p.stroke();
    if (!simple) {
      // Segments across the tail.
      p.lineWidth = r * theme.markLine * 0.8;
      p.beginPath();
      for (const [x, y] of [
        [-0.55, -0.2],
        [-0.38, -0.47],
        [-0.05, -0.58],
        [0.28, -0.47],
      ] as const) {
        p.moveTo(x * r * 0.8, y * r * 0.8);
        p.lineTo(x * r * 1.2, y * r * 1.2);
      }
      p.stroke();
    }
    // The barb, pointing forward (+x).
    p.beginPath();
    p.moveTo(0.42 * r, 0.06 * r);
    p.lineTo(0.82 * r, 0.24 * r);
    p.lineTo(0.42 * r, 0.42 * r);
    p.closePath();
    p.fill();
  },
};
