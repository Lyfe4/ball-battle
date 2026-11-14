import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/**
 * The Glitch's static, row by row: 0 its own colour, 1 the dark accent, 2 white. Fixed, so the ball
 * itself never flickers; only a glitched enemy's static moves (glitched.ts).
 */
const FULL = [
  [1, 0, 2, 1, 0],
  [0, 1, 1, 0, 1],
  [2, 1, 0, 1, 2],
  [1, 0, 1, 2, 0],
  [0, 2, 1, 0, 1],
] as const;
const SIMPLE = [
  [1, 0, 1],
  [0, 2, 1],
  [1, 1, 0],
] as const;

function paintStatic(
  p: Painter,
  rows: readonly (readonly number[])[],
  cell: number,
  tear: number,
  accent: string,
): void {
  const half = (rows.length * cell) / 2;
  rows.forEach((row, rowIndex) => {
    // The middle row is torn sideways, like a picture losing its hold.
    const shift = rowIndex === Math.floor(rows.length / 2) ? tear : 0;
    row.forEach((value, column) => {
      if (value === 0) return;
      p.fillStyle = value === 1 ? accent : theme.highlight;
      p.beginPath();
      p.rect(-half + column * cell + shift, -half + rowIndex * cell, cell, cell);
      p.fill();
    });
  });
}

/**
 * The Glitch (proposal): a screen of TV static in the dark accent and white, its middle row torn
 * sideways, inside a round window. At small size the blocks are fewer and bigger.
 */
export const glitchDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    p.save();
    p.beginPath();
    p.arc(0, 0, (simple ? 0.8 : 0.76) * r, 0, Math.PI * 2);
    p.clip();
    if (simple) paintStatic(p, SIMPLE, 0.5 * r, 0.16 * r, accent);
    else paintStatic(p, FULL, 0.3 * r, 0.12 * r, accent);
    p.restore();
  },
};
