import { spartanRaisedOf } from '../../sim/balls/spartan.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/**
 * The helmet's face, upright whatever the ball faces, as fractions of r: the T-shaped opening of a
 * crested Greek helmet (almond eye slits either side of a nose guard, and the gap between the cheek
 * guards running down to its lower edge), and a crest arcing over the top. Points run round the
 * opening's right half; the left is its mirror. At small size the opening and the nose guard are
 * bolder, so the eyes still read at phone size.
 */
const OPENING: readonly (readonly [number, number])[] = [
  [0.08, -0.3],
  [0.16, -0.3],
  [0.66, -0.14],
  [0.2, 0.04],
  [0.13, 0.16],
  [0.22, 1],
];
const OPENING_SIMPLE: readonly (readonly [number, number])[] = [
  [0.11, -0.32],
  [0.2, -0.32],
  [0.7, -0.12],
  [0.24, 0.08],
  [0.16, 0.2],
  [0.24, 1],
];
/** How far down the nose guard reaches between the eyes. */
const NOSE_GUARD_END = 0.06;
const CREST = { radius: 0.8, from: Math.PI * 1.14, to: Math.PI * 1.86 } as const;
const CREST_WIDTH = { full: 0.2, simple: 0.24 } as const;
/** The planted shield: a thick band hugging the edge that faces the enemy (+x), half-angle in rad. */
const SHIELD = { outer: 1, inner: 0.64, half: Math.PI * 0.36 } as const;
const SHIELD_INNER_SIMPLE = 0.58;

/**
 * Traces the opening from its right-half points, starting at the foot of the nose guard: down the
 * right, back up the mirrored left and down the guard's other side.
 */
function traceOpening(p: Painter, r: number, half: readonly (readonly [number, number])[]): void {
  p.beginPath();
  const [first] = half;
  if (first === undefined) return;
  p.moveTo(first[0] * r, NOSE_GUARD_END * r);
  for (const [x, y] of half) p.lineTo(x * r, y * r);
  for (const [x, y] of [...half].reverse()) p.lineTo(-x * r, y * r);
  p.lineTo(-first[0] * r, NOSE_GUARD_END * r);
  p.closePath();
}

/** The opening and crest of the helmet, drawn upright in the ball's frame and kept inside it. */
function drawHelmet(p: Painter, r: number, accent: string, simple: boolean): void {
  p.save();
  p.beginPath();
  p.arc(0, 0, r, 0, Math.PI * 2);
  p.clip();
  const crestWidth = (simple ? CREST_WIDTH.simple : CREST_WIDTH.full) * r;
  p.lineCap = 'round';
  if (!simple) {
    // A dark edge round the crest, so the red reads apart from the bronze.
    p.strokeStyle = accent;
    p.lineWidth = crestWidth + r * 0.08;
    p.beginPath();
    p.arc(0, 0, CREST.radius * r, CREST.from, CREST.to);
    p.stroke();
  }
  p.strokeStyle = theme.spartanCrest;
  p.lineWidth = crestWidth;
  p.beginPath();
  p.arc(0, 0, CREST.radius * r, CREST.from, CREST.to);
  p.stroke();

  p.fillStyle = accent;
  p.lineJoin = 'round';
  traceOpening(p, r, simple ? OPENING_SIMPLE : OPENING);
  p.fill();
  p.restore();
}

/** The planted shield: a thick polished band on the edge facing the enemy, edged in the accent. */
function drawShield(p: Painter, r: number, accent: string, simple: boolean): void {
  const inner = (simple ? SHIELD_INNER_SIMPLE : SHIELD.inner) * r;
  const outer = SHIELD.outer * r;
  p.fillStyle = accent;
  p.beginPath();
  p.arc(0, 0, outer, -SHIELD.half - 0.12, SHIELD.half + 0.12);
  p.arc(0, 0, inner - r * 0.08, SHIELD.half + 0.12, -SHIELD.half - 0.12, true);
  p.closePath();
  p.fill();
  p.fillStyle = theme.spartanPolish;
  p.beginPath();
  p.arc(0, 0, outer, -SHIELD.half, SHIELD.half);
  p.arc(0, 0, inner, SHIELD.half, -SHIELD.half, true);
  p.closePath();
  p.fill();
}

/**
 * Shield and spear (the Spartan): the ball is a bronze crested helmet, its T-shaped opening and red
 * crest always upright so the face reads at any size. While its shield is planted a thick polished
 * band hugs the side facing the enemy; once the spear is thrown the band is gone and the ball is
 * open. The spear is only ever drawn in flight (projectiles.ts), never on the ball.
 */
export const spartanDesign: BallDesign = {
  facing: 'aim',
  shot: 'spear',
  draw(p, { ball, radius: r, accent, heading, simple }) {
    p.save();
    // The frame faces the enemy; the face stays upright.
    if (heading !== undefined) p.rotate(-Math.atan2(heading.y, heading.x));
    drawHelmet(p, r, accent, simple);
    p.restore();
    // The shield is held in front of the face.
    if (spartanRaisedOf(ball) === true) drawShield(p, r, accent, simple);
  },
};
