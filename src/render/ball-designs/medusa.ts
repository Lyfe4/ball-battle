import { medusaStateOf } from '../../sim/balls/medusa.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** Snake locks round her back half: each starts at this angle (radians from her heading). */
const LOCKS = [2.0, 2.55, 3.14, 3.73, 4.28];

/** One lock: a short S-curve from inside the rim towards the centre. */
function lock(p: Painter, angle: number, r: number): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const at = (out: number, side: number): [number, number] => [
    (cos * out - sin * side) * r,
    (sin * out + cos * side) * r,
  ];
  p.moveTo(...at(0.86, 0));
  p.quadraticCurveTo(...at(0.72, 0.12), ...at(0.6, 0));
  p.quadraticCurveTo(...at(0.48, -0.12), ...at(0.38, 0));
}

/**
 * Medusa (prototype): two eyes at her front, the way she glares, and snake locks round her back.
 * Her eyes glow in the cream of the tip while her glare winds up.
 */
export const medusaDesign: BallDesign = {
  facing: 'velocity',
  draw(p, { ball, radius: r, accent, simple }) {
    const state = medusaStateOf(ball);
    const glowing = state !== undefined && state.glareTick >= 0;
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineWidth = r * theme.markLine * (simple ? 1.5 : 1);
    p.beginPath();
    LOCKS.forEach((angle, index) => {
      if (simple && index % 2 === 1) return;
      lock(p, angle, r);
    });
    p.stroke();
    p.fillStyle = glowing ? theme.medusaGlare : accent;
    p.beginPath();
    for (const side of [-1, 1]) {
      p.moveTo(0.42 * r + 0.14 * r, side * 0.26 * r);
      p.arc(0.42 * r, side * 0.26 * r, 0.14 * r, 0, Math.PI * 2);
    }
    p.fill();
  },
};
