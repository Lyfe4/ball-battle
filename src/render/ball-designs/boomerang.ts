import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** The bent bar, as fractions of r: its elbow and the tips of its two arms. */
const BAR = { elbow: [-0.1, 0.28], tipA: [-0.52, -0.3], tipB: [0.56, 0.02] } as const;
/**
 * A boomerang: a bent bar in `color`, `scale` world units to one r, with round ends. Shared by the
 * ball's mark and the boomerang in flight (projectiles.ts), so the two always match.
 */
export function drawBoomerangBar(p: Painter, scale: number, width: number, color: string): void {
  p.strokeStyle = color;
  p.lineWidth = width * scale;
  p.lineCap = 'round';
  p.lineJoin = 'round';
  p.beginPath();
  p.moveTo(BAR.tipA[0] * scale, BAR.tipA[1] * scale);
  p.lineTo(BAR.elbow[0] * scale, BAR.elbow[1] * scale);
  p.lineTo(BAR.tipB[0] * scale, BAR.tipB[1] * scale);
  p.stroke();
}

/**
 * The boomerang it holds (ADR 0043): a bent bar in the dark accent while it is in hand. While it is
 * in the air the ball shows only its faint shape, an
 * empty hand, until it is caught. At small size the bar thickens.
 */
export const boomerangDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple, shotsOut }) {
    const width = simple ? theme.boomerangArmSimple : theme.boomerangArm;
    p.save();
    if (shotsOut > 0) {
      p.globalAlpha *= theme.boomerangOutAlpha;
      drawBoomerangBar(p, r, width * 0.6, accent);
      p.restore();
      return;
    }
    drawBoomerangBar(p, r, width, accent);
    p.restore();
  },
};
