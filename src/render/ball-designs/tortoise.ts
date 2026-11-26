import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** The centre plate's half-width, and the rim plates' reach, as fractions of r. */
const PLATE = 0.34;
const RIM = 0.78;

function hexagon(p: Painter, cx: number, cy: number, size: number): void {
  // A flat-topped hexagon from its six corners (no trigonometry: the corners are fixed ratios).
  const h = size * 0.866;
  p.moveTo(cx + size, cy);
  p.lineTo(cx + size / 2, cy + h);
  p.lineTo(cx - size / 2, cy + h);
  p.lineTo(cx - size, cy);
  p.lineTo(cx - size / 2, cy - h);
  p.lineTo(cx + size / 2, cy - h);
  p.closePath();
}

/**
 * A shell (prototype): a hexagonal centre plate and six plates round it, lined in its accent, like
 * a tortoise's back seen from above. Never rotates. At small size only the centre plate and a
 * thick rim show.
 */
export const tortoiseDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    p.strokeStyle = accent;
    p.lineWidth = r * theme.markLine * (simple ? 1.4 : 1);
    p.lineJoin = 'round';
    p.beginPath();
    hexagon(p, 0, 0, PLATE * r);
    p.stroke();
    p.beginPath();
    p.arc(0, 0, r * 0.93, 0, Math.PI * 2);
    p.stroke();
    if (simple) return;
    // Spokes from the centre plate's corners out to the rim: six plates.
    const h = 0.866;
    const corners: readonly (readonly [number, number])[] = [
      [1, 0],
      [0.5, h],
      [-0.5, h],
      [-1, 0],
      [-0.5, -h],
      [0.5, -h],
    ];
    p.beginPath();
    for (const [x, y] of corners) {
      p.moveTo(x * PLATE * r, y * PLATE * r);
      p.lineTo(x * RIM * r, y * RIM * r);
    }
    p.stroke();
  },
};
