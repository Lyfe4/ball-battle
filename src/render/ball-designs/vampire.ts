import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** Angle of the collar's tips above the horizontal, so they rise high on each side. */
const TIP_ANGLE = 0.42;
/** The collar's outer edge, as a fraction of r. */
const COLLAR_RADIUS = 0.8;
/** The collar's top edge between its tips, dipping in the middle, as [x, y] fractions of r. */
const EDGE: readonly (readonly [number, number])[] = [
  [-0.4, 0.2],
  [0, 0.42],
  [0.4, 0.2],
];

/**
 * A dark high collar across the lower part, rising to a point on each side and dipping in the
 * middle, with two small fangs above the dip. When it heals, the collar's edge flushes crimson.
 */
export const vampireDesign: BallDesign = {
  facing: 'none',
  showsHeal: true,
  draw(p, { radius: r, accent, heal }) {
    // Inset from the edge so a rim of the ball's colour keeps its round silhouette against the
    // dark arena; a collar out to the edge merged with the floor at phone size.
    const collar = COLLAR_RADIUS * r;
    const tipX = Math.cos(TIP_ANGLE) * collar;
    const tipY = -Math.sin(TIP_ANGLE) * collar;

    p.fillStyle = accent;
    p.beginPath();
    p.moveTo(tipX, tipY);
    p.arc(0, 0, collar, -TIP_ANGLE, Math.PI + TIP_ANGLE);
    for (const [x, y] of EDGE) p.lineTo(x * r, y * r);
    p.closePath();
    p.fill();

    // Fangs hang just above the collar's dip.
    p.fillStyle = theme.highlight;
    for (const side of [-1, 1]) {
      const x = side * 0.14 * r;
      p.beginPath();
      p.moveTo(x - 0.075 * r, 0.12 * r);
      p.lineTo(x + 0.075 * r, 0.12 * r);
      p.lineTo(x, 0.33 * r);
      p.closePath();
      p.fill();
    }

    if (heal > 0) {
      p.save();
      p.globalAlpha *= heal;
      p.strokeStyle = theme.vampireHeal;
      p.lineWidth = r * theme.markLine;
      p.lineJoin = 'round';
      p.lineCap = 'round';
      p.beginPath();
      p.moveTo(-tipX, tipY);
      for (const [x, y] of EDGE) p.lineTo(x * r, y * r);
      p.lineTo(tipX, tipY);
      p.stroke();
      p.restore();
    }
  },
};
