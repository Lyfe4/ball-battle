import type { BallDesign, Painter } from './types.ts';

/** The crystal's corner distance from the centre, as a fraction of r. */
const CRYSTAL = 0.62;
/** Facet lines run from the centre to every corner, in the ball's colour. */
const FACET_LINE = 0.05;

/** The small-size snowflake, as fractions of r: spoke length and weight, and its branches. */
const SPOKE = 0.74;
const SPOKE_LINE = 0.15;
/** Where along a spoke its two branches leave, and how long they are. */
const BRANCH_AT = 0.42;
const BRANCH = 0.26;

/** Unit corners of a hexagon with a point at the top, precomputed (cos/sin of 30° steps). */
const CORNERS: readonly (readonly [number, number])[] = [
  [0, -1],
  [0.8660254037844386, -0.5],
  [0.8660254037844386, 0.5],
  [0, 1],
  [-0.8660254037844386, 0.5],
  [-0.8660254037844386, -0.5],
];
/** cos and sin of 60°, to turn a spoke's direction into its branches' directions. */
const COS_60 = 0.5;
const SIN_60 = 0.8660254037844386;

/**
 * Six spokes, each with a pair of branches at 60° to it: a snowflake that still reads as ice when
 * the ball is 25-30 px across. The faceted hexagon's facet lines vanish at that size and leave a
 * solid hexagon, which read as a gem.
 */
function drawSnowflake(p: Painter, r: number, accent: string): void {
  p.strokeStyle = accent;
  p.lineCap = 'round';
  p.lineWidth = SPOKE_LINE * r;
  p.beginPath();
  for (const [x, y] of CORNERS) {
    p.moveTo(0, 0);
    p.lineTo(x * SPOKE * r, y * SPOKE * r);
    const fromX = x * BRANCH_AT * r;
    const fromY = y * BRANCH_AT * r;
    for (const side of [1, -1]) {
      p.moveTo(fromX, fromY);
      p.lineTo(
        fromX + (x * COS_60 - side * y * SIN_60) * BRANCH * r,
        fromY + (side * x * SIN_60 + y * COS_60) * BRANCH * r,
      );
    }
  }
  p.stroke();
}

/**
 * A flat ice crystal: a hexagon in the dark accent, cut into six facets by thin lines of the
 * ball's pale colour from the centre to each corner. (Lines to alternate corners read as a cube.)
 * At small size it becomes a snowflake (drawSnowflake), since the facets are too fine to see.
 */
export const frostDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  draw(p, { radius: r, base, accent, simple }) {
    if (simple) {
      drawSnowflake(p, r, accent);
      return;
    }
    const size = CRYSTAL * r;
    p.fillStyle = accent;
    p.beginPath();
    CORNERS.forEach(([x, y], index) => {
      if (index === 0) p.moveTo(x * size, y * size);
      else p.lineTo(x * size, y * size);
    });
    p.closePath();
    p.fill();

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
