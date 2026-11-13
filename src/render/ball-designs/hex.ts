import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** A hexagon of circumradius `size` around (x, y), pointy side up. */
export function hexagonPath(p: Painter, x: number, y: number, size: number): void {
  p.beginPath();
  for (let corner = 0; corner < 6; corner++) {
    const angle = -Math.PI / 2 + (corner * Math.PI) / 3;
    const cx = x + Math.cos(angle) * size;
    const cy = y + Math.sin(angle) * size;
    if (corner === 0) p.moveTo(cx, cy);
    else p.lineTo(cx, cy);
  }
  p.closePath();
}

/**
 * The Hex (ADR 0049): a hexagon sigil in the dark accent with an open eye in the middle, the same
 * hexagon it leaves on the ball it curses. At small size the eye becomes a dot and the hexagon
 * thickens.
 */
export const hexDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    p.strokeStyle = accent;
    p.lineJoin = 'round';
    p.lineWidth = (simple ? 0.15 : theme.markLine) * r;
    hexagonPath(p, 0, 0, 0.6 * r);
    p.stroke();
    p.fillStyle = accent;
    if (simple) {
      p.beginPath();
      p.arc(0, 0, 0.18 * r, 0, Math.PI * 2);
      p.fill();
      return;
    }
    // An almond eye with a round pupil.
    p.save();
    p.scale(1, 0.55);
    p.beginPath();
    p.arc(0, 0, 0.3 * r, 0, Math.PI * 2);
    p.fill();
    p.restore();
    p.fillStyle = theme.highlight;
    p.beginPath();
    p.arc(0, 0, 0.1 * r, 0, Math.PI * 2);
    p.fill();
  },
};
