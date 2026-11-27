import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/**
 * Poseidon (prototype): a trident in its accent, upright on its face: a shaft and three prongs.
 * At small size the lines are thicker.
 */
export const poseidonDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineJoin = 'round';
    p.lineWidth = r * theme.markLine * (simple ? 2 : 1.4);
    p.beginPath();
    p.moveTo(0, 0.62 * r);
    p.lineTo(0, -0.6 * r);
    p.moveTo(-0.4 * r, -0.55 * r);
    p.lineTo(-0.4 * r, -0.2 * r);
    p.quadraticCurveTo(-0.4 * r, 0.02 * r, 0, 0.02 * r);
    p.quadraticCurveTo(0.4 * r, 0.02 * r, 0.4 * r, -0.2 * r);
    p.lineTo(0.4 * r, -0.55 * r);
    p.stroke();
  },
};
