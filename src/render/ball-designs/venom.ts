import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

interface Drop {
  /** Centre of the drop's round bottom, its radius, and the height of its tip, as fractions of r. */
  readonly y: number;
  readonly radius: number;
  readonly tip: number;
}

/** A slimmer drop with a highlight at full size; a fuller one without it at phone size. */
const FULL: Drop = { y: 0.16, radius: 0.36, tip: -0.6 };
const SIMPLE: Drop = { y: 0.14, radius: 0.44, tip: -0.7 };
/** The highlight on the drop's round side, as [x, y, radius] fractions of r. */
const SHINE = [-0.13, 0.08, 0.075] as const;

/**
 * A flat poison drop in the dark accent: a round bottom drawn up to a point, so it reads as a
 * drip rather than a dot. A small white shine on its round side at full size.
 */
export const venomDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  draw(p, { radius: r, accent, simple }) {
    const drop = simple ? SIMPLE : FULL;
    const centre = drop.y * r;
    const radius = drop.radius * r;
    const tip = drop.tip * r;
    // The tip's two tangent lines meet the circle this far either side of straight up.
    const spread = Math.acos(radius / (centre - tip));
    p.fillStyle = accent;
    p.beginPath();
    p.moveTo(0, tip);
    p.arc(0, centre, radius, -Math.PI / 2 + spread, (Math.PI * 3) / 2 - spread);
    p.closePath();
    p.fill();
    if (simple) return;

    const [x, y, size] = SHINE;
    p.fillStyle = theme.highlight;
    p.beginPath();
    p.arc(x * r, y * r, size * r, 0, Math.PI * 2);
    p.fill();
  },
};
