// The Titan's look (ADR 0071): an ancient stone colossus. The Titan is the one ball whose size
// changes mid-fight, so it never switches detail: every part is drawn at every size, in fractions
// of r, and only its brow grows heavier, smoothly, with its growth. It ignores `simple`
// (titan.test.ts holds it to that).
import { STANDARD_BALL_RADIUS } from '../../sim/constants.ts';
import { MAX_RADIUS } from '../../sim/balls/titan.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

type Point = readonly [number, number];

/** How grown the Titan is, 0 at the start to 1 at its largest. */
export function titanGrowth(radius: number): number {
  return Math.min(
    1,
    Math.max(0, (radius - STANDARD_BALL_RADIUS) / (MAX_RADIUS - STANDARD_BALL_RADIUS)),
  );
}

function shape(p: Painter, r: number, points: readonly Point[]): void {
  p.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) p.moveTo(x * r, y * r);
    else p.lineTo(x * r, y * r);
  });
  p.closePath();
}

/** The brow's top: a fixed line across the upper third; the brow deepens downwards as it grows. */
const BROW_TOP = -0.68;
/** How deep the brow is at the start, and how much deeper it gets by its largest. */
const BROW = { depth: 0.24, growth: 0.12 } as const;
/** The shadow the brow casts on the face below it. */
const SHADOW = 0.24;
/** Where the nose ends, its dark base just above the mouth. */
const NOSE_BASE = 0.2;

/** The brow's lower edge, left to right: two rounded brow bones meeting in a notch. */
function browEdge(depth: number): readonly Point[] {
  const y = BROW_TOP + depth;
  return [
    [-1, y - 0.04],
    [-0.56, y + 0.02],
    [-0.32, y + 0.06],
    [-0.08, y + 0.02],
    [0, y - 0.06],
    [0.08, y + 0.02],
    [0.32, y + 0.06],
    [0.56, y + 0.02],
    [1, y - 0.04],
  ];
}

/** A band across the whole ball between two edges, each a run of points from left to right. */
function band(p: Painter, r: number, top: readonly Point[], bottom: readonly Point[]): void {
  shape(p, r, [...top, ...[...bottom].reverse()]);
}

/** The lit forehead above the brow and the shaded right cheek and jaw: carved stone in the light. */
function stone(p: Painter, r: number, accent: string, alpha: number): void {
  p.fillStyle = theme.highlight;
  p.globalAlpha = alpha * theme.titanLitAlpha;
  shape(p, r, [
    [-1, -1],
    [0.42, -1],
    [0.12, BROW_TOP],
    [-1, BROW_TOP],
  ]);
  p.fill();
  p.fillStyle = accent;
  p.globalAlpha = alpha * theme.titanShadeAlpha;
  shape(p, r, [
    [1, -0.1],
    [1, 1],
    [0.1, 1],
    [0.5, 0.12],
  ]);
  p.fill();
  p.globalAlpha = alpha;
}

/** A broad stone nose from under the brow, in its shadow, with a dark base. */
function nose(p: Painter, r: number, browBottom: number, alpha: number): void {
  p.globalAlpha = alpha * theme.titanBrowShadowAlpha;
  shape(p, r, [
    [-0.09, browBottom],
    [0.09, browBottom],
    [0.19, NOSE_BASE],
    [-0.19, NOSE_BASE],
  ]);
  p.fill();
  p.globalAlpha = alpha;
  p.beginPath();
  p.rect(-0.2 * r, (NOSE_BASE - 0.02) * r, 0.4 * r, 0.07 * r);
  p.fill();
}

/** The mouth cut straight across, the broad jaw in shadow under it, and the cleft in its chin. */
function jaw(p: Painter, r: number, alpha: number): void {
  p.beginPath();
  p.rect(-0.5 * r, 0.32 * r, r, 0.09 * r);
  p.fill();
  p.globalAlpha = alpha * theme.titanJawAlpha;
  shape(p, r, [
    [-0.8, 0.41],
    [0.8, 0.41],
    [0.66, 1],
    [-0.66, 1],
  ]);
  p.fill();
  p.globalAlpha = alpha;
  p.beginPath();
  p.rect(-0.03 * r, 0.62 * r, 0.06 * r, 0.3 * r);
  p.fill();
}

/**
 * An ancient stone colossus (ADR 0071): big and heavy, its face filling the ball. A massive brow of
 * two rounded brow bones across the top third casts a band of shadow, with small round eyes deep in
 * it and a broad stone nose; a mouth cut straight across a broad jaw with a cleft chin; a lit
 * forehead and a shaded side. The body grows on screen, and the brow gets heavier with it.
 */
export const titanDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent }) {
    const alpha = p.globalAlpha;
    const depth = BROW.depth + BROW.growth * titanGrowth(ball.radius);
    const edge = browEdge(depth);
    p.save();
    // The face fills the ball: everything is cut to its edge.
    p.beginPath();
    p.arc(0, 0, r, 0, Math.PI * 2);
    p.clip();
    stone(p, r, accent, alpha);
    // The shadow the brow casts and the nose in it, then the brow over them.
    p.fillStyle = accent;
    p.globalAlpha = alpha * theme.titanBrowShadowAlpha;
    band(
      p,
      r,
      edge,
      edge.map(([x, y]) => [x, y + SHADOW]),
    );
    p.fill();
    nose(p, r, BROW_TOP + depth, alpha);
    band(
      p,
      r,
      [
        [-1, BROW_TOP],
        [1, BROW_TOP],
      ],
      edge,
    );
    p.fill();
    const eyeY = BROW_TOP + depth + SHADOW * 0.5 + 0.02;
    for (const x of [-0.32, 0.32]) {
      p.beginPath();
      p.arc(x * r, eyeY * r, 0.085 * r, 0, Math.PI * 2);
      p.fill();
    }
    jaw(p, r, alpha);
    p.restore();
  },
};
