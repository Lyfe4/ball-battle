import { STANDARD_BALL_RADIUS } from '../../sim/constants.ts';
import { MAX_RADIUS } from '../../sim/balls/titan.ts';
import { theme } from '../theme.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

// PROTOTYPE (proto/ball-looks): an ancient stone colossus, in three variations for the owner to
// pick from. The chosen one stays; the other two and the `?titan=` switch go.
//
// The Titan is the one ball whose size changes mid-fight, so it never switches detail: every part
// is drawn at every size, in fractions of r, and only grows heavier smoothly with its growth. It
// ignores `simple` (titan.test.ts holds it to that).

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

/** A band across the whole ball between two edges, each a run of points from left to right. */
function band(p: Painter, r: number, top: readonly Point[], bottom: readonly Point[]): void {
  shape(p, r, [...top, ...[...bottom].reverse()]);
}

/** How a variation shapes its parts. All fractions of r; `brow` is the brow's depth at a growth. */
interface Colossus {
  /** The brow ridge's lower edge, left to right, for a brow `depth` deep below BROW_TOP. */
  readonly browEdge: (depth: number) => readonly Point[];
  readonly brow: (grown: number) => number;
  /** The eyes, set deep in the shadow under the brow; `y` is the middle of that shadow. */
  readonly eyes: (p: Painter, r: number, y: number) => void;
  /** The jaw and mouth at the bottom of the face. */
  readonly jaw: (p: Painter, r: number) => void;
}

/** The brow's top: a fixed line across the upper third; the brow deepens downwards as it grows. */
const BROW_TOP = -0.68;
/** The shadow the brow casts on the face below it. */
const SHADOW = 0.24;
/** Where the nose ends, its dark base just above the mouth. */
const NOSE_BASE = 0.2;

/** The lit forehead above the brow and the shaded right cheek and jaw: C's lit and shaded stone. */
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

function drawColossus(colossus: Colossus) {
  return (p: Painter, { ball, radius: r, accent }: DesignView): void => {
    const alpha = p.globalAlpha;
    const depth = colossus.brow(titanGrowth(ball.radius));
    const edge = colossus.browEdge(depth);
    p.save();
    // The face fills the ball: everything is cut to its edge.
    p.beginPath();
    p.arc(0, 0, r, 0, Math.PI * 2);
    p.clip();
    stone(p, r, accent, alpha);
    // The shadow the brow casts, then the brow over it.
    p.fillStyle = accent;
    p.globalAlpha = alpha * theme.titanBrowShadowAlpha;
    band(
      p,
      r,
      edge,
      edge.map(([x, y]) => [x, y + SHADOW]),
    );
    p.fill();
    // A broad stone nose from under the brow, in the same shadow, with a dark base.
    shape(p, r, [
      [-0.09, BROW_TOP + depth],
      [0.09, BROW_TOP + depth],
      [0.19, NOSE_BASE],
      [-0.19, NOSE_BASE],
    ]);
    p.fill();
    p.globalAlpha = alpha;
    p.beginPath();
    p.rect(-0.2 * r, (NOSE_BASE - 0.02) * r, 0.4 * r, 0.07 * r);
    p.fill();
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
    colossus.eyes(p, r, BROW_TOP + depth + SHADOW * 0.5);
    colossus.jaw(p, r);
    p.restore();
  };
}

const flat = (depth: number): readonly Point[] => [
  [-1, BROW_TOP + depth],
  [1, BROW_TOP + depth],
];

/** A dark mouth cut straight across. */
function mouth(p: Painter, r: number, y: number, halfWidth: number): void {
  p.beginPath();
  p.rect(-halfWidth * r, y * r, 2 * halfWidth * r, 0.09 * r);
  p.fill();
}

/** The broad jaw under the mouth, in shadow, squarer than the ball, so it reads as a chin. */
function shadedJaw(p: Painter, r: number, top: number): void {
  const alpha = p.globalAlpha;
  p.globalAlpha = alpha * theme.titanJawAlpha;
  shape(p, r, [
    [-0.8, top],
    [0.8, top],
    [0.66, 1],
    [-0.66, 1],
  ]);
  p.fill();
  p.globalAlpha = alpha;
}

/**
 * Variation 1, "Lintel": a flat stone lintel of a brow, getting heavier as it grows; two narrow
 * slit eyes in its shadow; a mouth cut across a broad, shadowed jaw.
 */
const lintel: BallDesign = {
  facing: 'none',
  draw: drawColossus({
    brow: (grown) => 0.26 + 0.12 * grown,
    browEdge: flat,
    eyes(p, r, y) {
      p.beginPath();
      for (const x of [-0.32, 0.32]) p.rect((x - 0.13) * r, (y - 0.06) * r, 0.26 * r, 0.12 * r);
      p.fill();
    },
    jaw(p, r) {
      mouth(p, r, 0.34, 0.46);
      shadedJaw(p, r, 0.43);
    },
  }),
};

/**
 * Variation 2, "Glower": the brow dips into a deep V that deepens as it grows, B's glare; small
 * square eyes under it; a dark underbite of a jaw with two stubby tusks of stone rising from it.
 */
const glower: BallDesign = {
  facing: 'none',
  draw: drawColossus({
    brow: (grown) => 0.22 + 0.1 * grown,
    browEdge: (depth) => [
      [-1, BROW_TOP + depth - 0.1],
      [0, BROW_TOP + depth + 0.12],
      [1, BROW_TOP + depth - 0.1],
    ],
    eyes(p, r, y) {
      p.beginPath();
      for (const x of [-0.3, 0.3]) p.rect((x - 0.07) * r, (y + 0.02) * r, 0.14 * r, 0.14 * r);
      p.fill();
    },
    jaw(p, r) {
      // A dark underbite of a jaw, narrower than the ball, two stubby tusks rising from it.
      shape(p, r, [
        [-0.68, 0.42],
        [-0.36, 0.42],
        [-0.29, 0.27],
        [-0.22, 0.42],
        [0.22, 0.42],
        [0.29, 0.27],
        [0.36, 0.42],
        [0.68, 0.42],
        [0.56, 1],
        [-0.56, 1],
      ]);
      p.fill();
    },
  }),
};

/**
 * Variation 3, "Weathered": two rounded brow bones, heavier as it grows, with round eyes deep under
 * them; a mouth cut straight across a broad jaw with a cleft chin.
 */
const weathered: BallDesign = {
  facing: 'none',
  draw: drawColossus({
    brow: (grown) => 0.24 + 0.12 * grown,
    browEdge: (depth) => {
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
    },
    eyes(p, r, y) {
      for (const x of [-0.32, 0.32]) {
        p.beginPath();
        p.arc(x * r, (y + 0.02) * r, 0.085 * r, 0, Math.PI * 2);
        p.fill();
      }
    },
    jaw(p, r) {
      mouth(p, r, 0.32, 0.5);
      shadedJaw(p, r, 0.41);
      // The cleft in its chin.
      p.beginPath();
      p.rect(-0.03 * r, 0.62 * r, 0.06 * r, 0.3 * r);
      p.fill();
    },
  }),
};

/** The three variations by name, for the gallery and the `?titan=` switch. */
export const TITAN_LOOKS = { lintel, glower, weathered } as const;
export type TitanLook = keyof typeof TITAN_LOOKS;

/** True for a name of one of the three variations. */
export function isTitanLook(look: unknown): look is TitanLook {
  return look === 'lintel' || look === 'glower' || look === 'weathered';
}

let chosen: TitanLook = 'lintel';

/** Picks the variation every Titan on this page is drawn with. */
export function chooseTitanLook(look: TitanLook): void {
  chosen = look;
}

/**
 * An ancient stone colossus (ADR 0034): its face fills the ball, a massive brow ridge across the top
 * third casting a band of shadow with small eyes deep in it, a broad heavy jaw, lit and shaded
 * stone, and a brow that gets heavier as it grows. Drawn as the chosen variation.
 */
export const titanDesign: BallDesign = {
  facing: 'none',
  draw(p, view) {
    TITAN_LOOKS[chosen].draw(p, view);
  },
};
