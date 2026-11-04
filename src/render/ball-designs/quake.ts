import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** The fault: a jagged line from top to bottom, as [x, y] fractions of r. */
const FAULT: readonly (readonly [number, number])[] = [
  [0.05, -1],
  [0.05, -0.84],
  [-0.07, -0.3],
  [0.07, 0.18],
  [-0.05, 0.84],
  [-0.05, 1],
];
/** Rock layers on the left of the fault, as [top, height] fractions of r; heavier at small size. */
const STRATA: readonly (readonly [number, number])[] = [
  [-0.42, 0.2],
  [0.04, 0.2],
];
const SIMPLE_STRATA: readonly (readonly [number, number])[] = [
  [-0.44, 0.25],
  [0.04, 0.25],
];
/** How far the layers on the right of the fault have slipped down, as a fraction of r. */
const SLIP = 0.24;
/** The layers stay inside this circle, so the ball's round outline is kept. */
const INSET = 0.86;

/** The half of the ball on one side of the fault, as a clip path. */
function clipSide(p: Painter, r: number, side: -1 | 1): void {
  p.beginPath();
  p.moveTo(side * r, -r);
  for (const [x, y] of FAULT) p.lineTo(x * r, y * r);
  p.lineTo(side * r, r);
  p.closePath();
  p.clip();
}

/**
 * Two rock strata in the dark accent, broken by a jagged fault line where the right side has
 * slipped down, like a cross-section after a quake. (Three thin layers read as a menu icon.) At
 * small size the layers and the fault are heavier.
 */
export const quakeDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  strike: 'shockwave',
  draw(p, { radius: r, accent, simple }) {
    const strata = simple ? SIMPLE_STRATA : STRATA;
    p.fillStyle = accent;
    for (const side of [-1, 1] as const) {
      const slip = side === 1 ? SLIP * r : 0;
      p.save();
      p.beginPath();
      p.arc(0, 0, INSET * r, 0, Math.PI * 2);
      p.clip();
      clipSide(p, r, side);
      p.beginPath();
      for (const [top, height] of strata) p.rect(-r, top * r + slip, 2 * r, height * r);
      p.fill();
      p.restore();
    }

    p.strokeStyle = accent;
    p.lineWidth = r * theme.markLine * (simple ? 1.4 : 1);
    p.lineJoin = 'round';
    p.lineCap = 'round';
    p.beginPath();
    FAULT.slice(1, -1).forEach(([x, y], index) => {
      if (index === 0) p.moveTo(x * r, y * r);
      else p.lineTo(x * r, y * r);
    });
    p.stroke();
  },
};
