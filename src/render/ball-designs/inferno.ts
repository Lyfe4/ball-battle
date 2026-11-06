import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** A flame: a round base and a point, as fractions of r. */
interface Flame {
  readonly baseY: number;
  readonly baseRadius: number;
  readonly tipY: number;
}

const OUTER: Flame = { baseY: 0.2, baseRadius: 0.42, tipY: -0.7 };
const INNER: Flame = { baseY: 0.3, baseRadius: 0.2, tipY: -0.18 };

/** A teardrop: the base circle, and two lines up to the tip that meet the circle at tangents. */
function flame(p: Painter, r: number, { baseY, baseRadius, tipY }: Flame, flicker: number): void {
  const cy = baseY * r;
  const radius = baseRadius * r;
  const tip = tipY * r - flicker;
  // The angle, from straight up, at which a tangent line from the tip touches the base circle.
  const half = Math.acos(radius / (cy - tip));
  p.beginPath();
  p.moveTo(0, tip);
  p.arc(0, cy, radius, -Math.PI / 2 - half, -Math.PI / 2 + half, true);
  p.closePath();
  p.fill();
}

/**
 * A flame in the dark accent with a pale yellow heart: the ball that leaves fire behind it
 * (ADR 0034). Its tip flickers in steps of the sim tick. At small size the heart goes and the one
 * tongue stays.
 */
export const infernoDesign: BallDesign = {
  facing: 'none',
  strike: 'burn',
  draw(p, { radius: r, accent, tick, simple }) {
    const flicker = (Math.floor(tick / 4) % 3) * theme.infernoFlicker * r;
    p.fillStyle = accent;
    flame(p, r, OUTER, flicker);
    if (simple) return;
    p.fillStyle = theme.infernoHeart;
    flame(p, r, INNER, flicker / 2);
  },
};
