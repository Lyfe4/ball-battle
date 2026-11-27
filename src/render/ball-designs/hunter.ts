import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

type Point = readonly [number, number];

/**
 * The right half of the hood's edge, from where it meets the ball's edge low on the right to the
 * middle of the wolf's upper jaw over the hunter's brow, as fractions of r (y down): ragged tufts
 * of fur down the side, then the jaw's rim. Mirrored for the left half.
 */
const HOOD_EDGE_RIGHT: readonly Point[] = [
  [0.9, 0.42],
  [0.82, 0.5],
  [0.76, 0.3],
  [0.68, 0.38],
  [0.64, 0.16],
  [0.56, 0.22],
  [0.54, 0.02],
  [0.44, 0.06],
  [0.38, -0.1],
  [0.16, -0.11],
  [0, -0.1],
];
/** Where the hood meets the ball's edge, each side: angles in radians (0 right, y down). */
const HOOD_FROM = Math.atan2(0.42, -0.9);
const HOOD_TO = Math.atan2(0.42, 0.9) + Math.PI * 2;
/** The wolf's muzzle down the front of the hood, from between its eyes to its nose at the rim. */
const MUZZLE: readonly Point[] = [
  [-0.12, -0.56],
  [0.12, -0.56],
  [0.22, -0.16],
  [0.13, -0.1],
  [-0.13, -0.1],
  [-0.22, -0.16],
];
/** The wolf's upper fangs hanging from the rim over the brow: x, length (fractions of r). */
const FANGS: readonly (readonly [number, number])[] = [
  [-0.19, 0.11],
  [-0.07, 0.05],
  [0.07, 0.05],
  [0.19, 0.11],
];
/** The wolf's jaw rim, where its fangs hang from. */
const RIM_Y = -0.11;
/** Short strokes of darker fur on the hood, each side: from, to. */
const FUR: readonly (readonly [Point, Point])[] = [
  [
    [0.5, -0.72],
    [0.6, -0.6],
  ],
  [
    [0.66, -0.44],
    [0.76, -0.3],
  ],
  [
    [0.72, -0.08],
    [0.8, 0.06],
  ],
];
/** An ear: its base on the hood and its tip just past the ball's edge (at most 12% of r out). */
const EAR: readonly Point[] = [
  [-0.74, -0.5],
  [-0.5, -0.98],
  [-0.2, -0.84],
];
const INNER_EAR: readonly Point[] = [
  [-0.6, -0.58],
  [-0.48, -0.86],
  [-0.3, -0.78],
];
/** The scarf over the hunter's mouth: its top edge, left to right; the ball's edge closes it. */
const SCARF_TOP: readonly Point[] = [
  [-0.86, 0.5],
  [-0.4, 0.5],
  [0, 0.54],
  [0.4, 0.5],
  [0.86, 0.5],
];

function shape(p: Painter, r: number, points: readonly Point[], mirror = 1): void {
  points.forEach(([x, y], index) => {
    if (index === 0) p.moveTo(mirror * x * r, y * r);
    else p.lineTo(mirror * x * r, y * r);
  });
  p.closePath();
}

/**
 * The face in the hood's shadow: a dark oval in the hood's opening (its top under the hood), the
 * leather of its cloak round it, and in the dark only two glinting eyes.
 */
function drawShadowedFace(p: Painter, r: number): void {
  p.fillStyle = theme.hunterShadow;
  p.save();
  p.translate(0, 0.24 * r);
  p.scale(1, 0.75);
  p.beginPath();
  p.arc(0, 0, 0.6 * r, 0, Math.PI * 2);
  p.fill();
  p.restore();
  // Two narrow eyes glinting out of the dark, the brightest thing on the ball, each with a white point.
  p.fillStyle = theme.hunterEyeGlint;
  p.beginPath();
  for (const side of [-1, 1]) {
    p.moveTo(side * 0.37 * r, 0.24 * r);
    p.lineTo(side * 0.22 * r, 0.165 * r);
    p.lineTo(side * 0.07 * r, 0.24 * r);
    p.lineTo(side * 0.22 * r, 0.285 * r);
    p.closePath();
  }
  p.fill();
  p.fillStyle = theme.hunterEyeSpark;
  p.beginPath();
  for (const side of [-1, 1]) {
    p.moveTo(side * 0.22 * r + 0.038 * r, 0.23 * r);
    p.arc(side * 0.22 * r, 0.23 * r, 0.038 * r, 0, Math.PI * 2);
  }
  p.fill();
}

/** A scarf in its leather over the mouth and chin, with two folds. */
function drawScarf(p: Painter, r: number, base: string, accent: string): void {
  p.beginPath();
  SCARF_TOP.forEach(([x, y], index) => {
    if (index === 0) p.moveTo(x * r, y * r);
    else p.lineTo(x * r, y * r);
  });
  p.arc(0, 0, r, Math.atan2(0.5, 0.86), Math.atan2(0.5, -0.86));
  p.closePath();
  p.fillStyle = base;
  p.fill();
  p.strokeStyle = accent;
  p.lineWidth = theme.hunterLine * r;
  p.lineJoin = 'round';
  p.stroke();
  p.lineWidth = theme.hunterLine * 0.6 * r;
  p.lineCap = 'round';
  p.beginPath();
  p.moveTo(-0.5 * r, 0.72 * r);
  p.quadraticCurveTo(-0.1 * r, 0.8 * r, 0.3 * r, 0.74 * r);
  p.moveTo(-0.3 * r, 0.87 * r);
  p.quadraticCurveTo(0.05 * r, 0.91 * r, 0.4 * r, 0.86 * r);
  p.stroke();
}

/** The wolf-pelt hood down low over the top, its ragged fur edge and upper jaw over the brow. */
function drawHood(p: Painter, r: number, accent: string): void {
  p.beginPath();
  p.arc(0, 0, r, HOOD_FROM, HOOD_TO);
  for (const [x, y] of HOOD_EDGE_RIGHT) p.lineTo(x * r, y * r);
  for (const [x, y] of [...HOOD_EDGE_RIGHT].reverse()) p.lineTo(-x * r, y * r);
  p.closePath();
  p.fillStyle = theme.hunterPelt;
  p.fill();
  p.strokeStyle = accent;
  p.lineWidth = theme.hunterLine * r;
  p.lineJoin = 'round';
  p.stroke();
  // Strokes of darker fur down each side.
  p.lineWidth = theme.hunterLine * 0.6 * r;
  p.lineCap = 'round';
  p.beginPath();
  for (const side of [-1, 1]) {
    for (const [[x1, y1], [x2, y2]] of FUR) {
      p.moveTo(side * x1 * r, y1 * r);
      p.lineTo(side * x2 * r, y2 * r);
    }
  }
  p.stroke();
}

/** The wolf's face on the hood: a paler muzzle to a dark nose, slanted eyes, upper fangs. */
function drawWolf(p: Painter, r: number, accent: string): void {
  p.beginPath();
  shape(p, r, MUZZLE);
  p.fillStyle = theme.hunterMuzzle;
  p.fill();
  // Its fangs hang over the hunter's brow from the jaw's rim.
  p.beginPath();
  for (const [x, length] of FANGS) {
    const half = length > 0.1 ? 0.045 : 0.035;
    p.moveTo((x - half) * r, RIM_Y * r);
    p.lineTo(x * r, (RIM_Y + length) * r);
    p.lineTo((x + half) * r, RIM_Y * r);
    p.closePath();
  }
  p.fillStyle = theme.hunterFang;
  p.fill();
  p.strokeStyle = accent;
  p.lineWidth = theme.hunterLine * 0.5 * r;
  p.stroke();
  // The nose at the end of the muzzle, and the slanted eyes either side of its top.
  p.fillStyle = accent;
  p.beginPath();
  p.moveTo(0.075 * r, -0.17 * r);
  p.arc(0, -0.17 * r, 0.075 * r, 0, Math.PI * 2);
  p.fill();
  p.beginPath();
  for (const side of [-1, 1]) {
    p.moveTo(side * 0.42 * r, -0.62 * r);
    p.lineTo(side * 0.18 * r, -0.54 * r);
    p.lineTo(side * 0.35 * r, -0.5 * r);
    p.closePath();
  }
  p.fillStyle = theme.hunterWolfEye;
  p.fill();
  p.lineWidth = theme.hunterLine * 0.7 * r;
  p.stroke();
}

/**
 * A hunter under a wolf pelt (ADR 0091): the wolf's head worn as a hood down low over the ball, its
 * ears up past the edge, its slanted eyes, pale muzzle and upper fangs over the brow, ragged fur
 * down its sides; under it the hunter's face is in shadow, only two eyes glinting, its leather
 * cloak round it and a scarf over the mouth. It shows no state: its snares on the court and the trap clamped on a
 * caught ball show its ability (the owner's waiver of ADR 0071 for it). Upright, never turning;
 * drawn alike at every size, in fractions of r.
 */
export const hunterDesign: BallDesign = {
  facing: 'none',
  // A sprung snare snaps shut where it lay, never a bolt (snares.ts).
  strike: 'snap',
  draw(p, { radius: r, accent, base }) {
    drawShadowedFace(p, r);
    drawScarf(p, r, base, accent);
    drawHood(p, r, accent);
    drawWolf(p, r, accent);
  },
  over(p, { radius: r, accent }) {
    // Both ears in one path, then both insides.
    p.beginPath();
    for (const side of [-1, 1]) shape(p, r, EAR, side);
    p.fillStyle = theme.hunterPelt;
    p.fill();
    p.strokeStyle = accent;
    p.lineWidth = theme.hunterLine * r;
    p.lineJoin = 'round';
    p.stroke();
    p.beginPath();
    for (const side of [-1, 1]) shape(p, r, INNER_EAR, side);
    p.fillStyle = theme.hunterInnerEar;
    p.fill();
  },
};
