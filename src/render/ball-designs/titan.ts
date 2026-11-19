import { STANDARD_BALL_RADIUS } from '../../sim/constants.ts';
import { MAX_RADIUS } from '../../sim/balls/titan.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

// PROTOTYPE (proto/ball-looks): three stone-giant faces for the Titan, for the owner to pick one.
// The chosen one stays; the other two and the `?titan=` switch go.

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

function dot(p: Painter, x: number, y: number, radius: number): void {
  p.beginPath();
  p.arc(x, y, radius, 0, Math.PI * 2);
  p.fill();
}

/** A small white glint at the upper left of an eye, at full size only. */
function glint(p: Painter, r: number, x: number, y: number, simple: boolean): void {
  if (simple) return;
  p.fillStyle = theme.highlight;
  dot(p, (x - 0.035) * r, (y - 0.035) * r, 0.035 * r);
}

/**
 * Variation A, "Brow": one heavy slab of brow across the face, dipping in the middle in a frown,
 * over two small square eyes and a flat, set mouth. The brow gets heavier as the Titan grows.
 */
const brow: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const grown = titanGrowth(ball.radius);
    const depth = 0.16 + 0.11 * grown + (simple ? 0.04 : 0);
    const top = -0.38;
    p.fillStyle = accent;
    p.strokeStyle = accent;
    p.lineJoin = 'round';
    p.lineWidth = 0.06 * r;
    shape(p, r, [
      [-0.62, top],
      [0.62, top],
      [0.6, top + depth],
      [0.14, top + depth],
      [0, top + depth + 0.09],
      [-0.14, top + depth],
      [-0.6, top + depth],
    ]);
    p.fill();
    p.stroke();
    const eye = (simple ? 0.2 : 0.15) * r;
    const eyeY = top + depth + 0.2;
    for (const x of [-0.27, 0.27]) {
      p.fillStyle = accent;
      p.beginPath();
      p.rect(x * r - eye / 2, eyeY * r - eye / 2, eye, eye);
      p.fill();
      glint(p, r, x, eyeY, simple);
    }
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineWidth = (simple ? 0.12 : 0.09) * r;
    p.beginPath();
    p.moveTo(-0.22 * r, 0.5 * r);
    p.lineTo(0.22 * r, 0.5 * r);
    p.stroke();
  },
};

/**
 * Variation B, "Carved": a face cut into stone. Two brow blocks slant down to the middle, glaring;
 * narrow slit eyes sit under them, and a wide stone jaw grits its teeth (the gaps at full size).
 */
const carved: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    const heavy = simple ? 0.04 : 0;
    p.fillStyle = accent;
    p.strokeStyle = accent;
    p.lineJoin = 'round';
    p.lineWidth = 0.05 * r;
    for (const side of [-1, 1]) {
      shape(p, r, [
        [side * 0.62, -0.44],
        [side * 0.07, -0.26],
        [side * 0.07, -0.1 + heavy],
        [side * 0.62, -0.27 + heavy],
      ]);
      p.fill();
      p.stroke();
      p.beginPath();
      p.rect((side * 0.3 - 0.13) * r, 0.03 * r, 0.26 * r, (simple ? 0.11 : 0.08) * r);
      p.fill();
    }
    const jaw = { x: -0.38, y: 0.3, w: 0.76, h: simple ? 0.24 : 0.2 };
    p.beginPath();
    p.rect(jaw.x * r, jaw.y * r, jaw.w * r, jaw.h * r);
    p.fill();
    p.stroke();
    if (simple) return;
    p.strokeStyle = theme.highlight;
    p.lineWidth = 0.035 * r;
    p.lineCap = 'butt';
    p.beginPath();
    p.moveTo(jaw.x * r, (jaw.y + jaw.h / 2) * r);
    p.lineTo((jaw.x + jaw.w) * r, (jaw.y + jaw.h / 2) * r);
    for (const x of [-0.19, 0, 0.19]) {
      p.moveTo(x * r, (jaw.y + 0.03) * r);
      p.lineTo(x * r, (jaw.y + jaw.h - 0.03) * r);
    }
    p.stroke();
  },
};

/** The boulder's flat faces: a lit one at the upper left and a shaded one at the lower right. */
const LIT: readonly Point[] = [
  [-0.74, -0.34],
  [-0.32, -0.76],
  [0.12, -0.8],
  [-0.16, -0.5],
  [-0.62, -0.1],
];
const SHADED: readonly Point[] = [
  [0.8, 0.1],
  [0.58, 0.56],
  [0.12, 0.8],
  [0.36, 0.4],
];

/**
 * Variation C, "Boulder": a chiselled rock, a lit face at its upper left and a shaded one at its
 * lower right, with one thick frowning ridge of brow, two small dark eyes and a grim, set mouth.
 */
const boulder: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    // Scaled by what the ball is drawn at, so a defeated Titan stays see-through.
    const alpha = p.globalAlpha;
    p.fillStyle = theme.highlight;
    p.globalAlpha = alpha * theme.titanLitAlpha;
    shape(p, r, LIT);
    p.fill();
    p.fillStyle = accent;
    p.globalAlpha = alpha * theme.titanShadeAlpha;
    shape(p, r, SHADED);
    p.fill();
    p.globalAlpha = alpha;
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineJoin = 'round';
    p.lineWidth = (simple ? 0.2 : 0.16) * r;
    p.beginPath();
    p.moveTo(-0.5 * r, -0.26 * r);
    p.lineTo(0, -0.12 * r);
    p.lineTo(0.5 * r, -0.26 * r);
    p.stroke();
    for (const x of [-0.24, 0.24]) {
      p.fillStyle = accent;
      dot(p, x * r, 0.08 * r, (simple ? 0.11 : 0.085) * r);
      glint(p, r, x, 0.08, simple);
    }
    p.strokeStyle = accent;
    p.lineWidth = (simple ? 0.1 : 0.075) * r;
    // A grim set mouth, barely turned down: determined, never sad.
    p.beginPath();
    p.arc(0, 1.0 * r, 0.52 * r, Math.PI * 1.38, Math.PI * 1.62);
    p.stroke();
  },
};

/** The three faces by name, for the gallery and the `?titan=` switch. */
export const TITAN_LOOKS = { brow, carved, boulder } as const;
export type TitanLook = keyof typeof TITAN_LOOKS;

/** True for a name of one of the three faces. */
export function isTitanLook(look: unknown): look is TitanLook {
  return look === 'brow' || look === 'carved' || look === 'boulder';
}

let chosen: TitanLook = 'brow';

/** Picks the face every Titan on this page is drawn with. */
export function chooseTitanLook(look: TitanLook): void {
  chosen = look;
}

/**
 * A stone giant (ADR 0034): big and heavy, its face cut in the dark accent on its green. The body
 * already grows on screen, so the face says weight rather than growth. Drawn as the chosen face.
 */
export const titanDesign: BallDesign = {
  facing: 'none',
  draw(p, view) {
    TITAN_LOOKS[chosen].draw(p, view);
  },
};
