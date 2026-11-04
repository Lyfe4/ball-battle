import type { BallDesign } from './types.ts';

/** The crystal's corner distance from the centre, as a fraction of r, larger at small size. */
const CRYSTAL = 0.62;
const SIMPLE_CRYSTAL = 0.7;
/** Facet lines run from the centre to every corner, in the ball's colour. */
const FACET_LINE = 0.05;

/** Unit corners of a hexagon with a point at the top, precomputed (cos/sin of 30° steps). */
const CORNERS: readonly (readonly [number, number])[] = [
  [0, -1],
  [0.8660254037844386, -0.5],
  [0.8660254037844386, 0.5],
  [0, 1],
  [-0.8660254037844386, 0.5],
  [-0.8660254037844386, -0.5],
];

/**
 * A flat ice crystal: a hexagon in the dark accent, cut into six facets by thin lines of the
 * ball's pale colour from the centre to each corner. (Lines to alternate corners read as a cube.) At small size the facets are dropped and the
 * crystal grows, so it still reads as a hexagon.
 */
export const frostDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  draw(p, { radius: r, base, accent, simple }) {
    const size = (simple ? SIMPLE_CRYSTAL : CRYSTAL) * r;
    p.fillStyle = accent;
    p.beginPath();
    CORNERS.forEach(([x, y], index) => {
      if (index === 0) p.moveTo(x * size, y * size);
      else p.lineTo(x * size, y * size);
    });
    p.closePath();
    p.fill();
    if (simple) return;

    p.strokeStyle = base;
    p.lineWidth = FACET_LINE * r;
    p.lineCap = 'round';
    p.beginPath();
    for (const [x, y] of CORNERS) {
      p.moveTo(0, 0);
      p.lineTo(x * size, y * size);
    }
    p.stroke();
  },
};
