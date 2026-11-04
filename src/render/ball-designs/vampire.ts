import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/**
 * The collar's outer edge, as a fraction of r: inset so a rim of the ball's colour keeps its round
 * silhouette against the dark arena.
 */
const COLLAR_RADIUS = 0.86;
/**
 * Angle of the collar's lapel tips above the horizontal (radians). The collar fills the lower
 * third, with a pointed lapel rising up each side like a cape's stand-up collar.
 */
const TIP_ANGLE = 0.32;
/**
 * The collar's top edge between the lapel tips, as [x, y] fractions of r: each lapel drops
 * steeply inwards, then the edge runs nearly flat with a small notch at the centre. A flat edge
 * reads as clothing; a curved one under the fangs read as a grinning mouth.
 */
const EDGE: readonly (readonly [number, number])[] = [
  [-0.46, 0.4],
  [-0.1, 0.44],
  [0, 0.54],
  [0.1, 0.44],
  [0.46, 0.4],
];
/**
 * Fangs: centre offset, top, length and base width, as fractions of r, bigger at small size. They
 * hang just above the collar's flat edge: placed high in the body on their own, they read as eyes.
 */
const FANG = { x: 0.16, top: 0.02, length: 0.34, width: 0.2 } as const;
const SIMPLE_FANG = { x: 0.19, top: -0.06, length: 0.42, width: 0.27 } as const;

function drawFangs(p: Painter, r: number, fang: typeof FANG | typeof SIMPLE_FANG): void {
  p.fillStyle = theme.highlight;
  for (const side of [-1, 1]) {
    const x = side * fang.x * r;
    p.beginPath();
    p.moveTo(x - (fang.width / 2) * r, fang.top * r);
    p.lineTo(x + (fang.width / 2) * r, fang.top * r);
    p.lineTo(x, (fang.top + fang.length) * r);
    p.closePath();
    p.fill();
  }
}

/**
 * Two large fangs in the purple body above a dark collar across the lower third, with a pointed
 * lapel rising up each side. Most of the body stays purple so the fangs carry the identity. When it heals, the collar's edge
 * flushes crimson.
 */
export const vampireDesign: BallDesign = {
  facing: 'none',
  showsHeal: true,
  draw(p, { radius: r, accent, heal, simple }) {
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

    drawFangs(p, r, simple ? SIMPLE_FANG : FANG);

    if (heal > 0) {
      p.save();
      p.globalAlpha *= heal;
      p.strokeStyle = theme.vampireHeal;
      p.lineWidth = r * theme.markLine * (simple ? 1.6 : 1);
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
