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
 * A boomerang in the dark accent: a bent bar across the ball, the ball that throws one (ADR 0043).
 * At small size the bar thickens.
 */
export const boomerangDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    drawBoomerangBar(p, r, simple ? theme.boomerangArmSimple : theme.boomerangArm, accent);
  },
};
