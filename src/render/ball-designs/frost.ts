import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** How far a spoke reaches from the centre, as a fraction of r. */
const SPOKE = 0.74;

interface Flake {
  /** Line weight, as a fraction of r. */
  readonly line: number;
  /** Each pair of branches: where along the spoke it leaves, and how long it is (fractions of r). */
  readonly branches: readonly { readonly at: number; readonly length: number }[];
}

/** Full size: the game's mark weight and two pairs of branches per spoke, like a real flake. */
const FULL: Flake = {
  line: theme.markLine,
  branches: [
    { at: 0.32, length: 0.24 },
    { at: 0.56, length: 0.16 },
  ],
};

/** Small size: thicker lines and one pair of branches, so it still reads at 25-30 px across. */
const SIMPLE: Flake = { line: 0.15, branches: [{ at: 0.42, length: 0.26 }] };

/** Unit directions of the six spokes, the first pointing up (cos/sin of 60° steps, precomputed). */
const SPOKES: readonly (readonly [number, number])[] = [
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
 * A snowflake in the dark accent: six spokes, each with branches at 60° to it. The same flake at
 * every size, finer at full size and bolder at small size, so the Frost looks like one ball in the
 * arena, the picker and the manual. (A faceted hexagon was used before; at small size it lost its
 * facets and read as a gem.)
 */
export const frostDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  draw(p, { radius: r, accent, simple }) {
    drawSnowflake(p, r, accent, simple ? SIMPLE : FULL);
  },
};

function drawSnowflake(p: Painter, r: number, accent: string, flake: Flake): void {
  p.strokeStyle = accent;
  p.lineCap = 'round';
  p.lineWidth = flake.line * r;
  p.beginPath();
  for (const [x, y] of SPOKES) {
    p.moveTo(0, 0);
    p.lineTo(x * SPOKE * r, y * SPOKE * r);
    for (const { at, length } of flake.branches) {
      const fromX = x * at * r;
      const fromY = y * at * r;
      for (const side of [1, -1]) {
        p.moveTo(fromX, fromY);
        p.lineTo(
          fromX + (x * COS_60 - side * y * SIN_60) * length * r,
          fromY + (side * x * SIN_60 + y * COS_60) * length * r,
        );
      }
    }
  }
  p.stroke();
}
