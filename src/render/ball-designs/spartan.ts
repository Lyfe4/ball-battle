import { spartanRaisedOf } from '../../sim/balls/spartan.ts';
import { theme } from '../theme.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

type Point = readonly [number, number];

/**
 * A bronze Corinthian helmet in profile, looking along +x, as fractions of r: the dome, the face
 * guard sloping to the chin and the neck guard flaring at the back. Small enough to leave a ring of
 * the body round it, so the planted shield never touches it.
 */
const DOME = { y: 0.04, radius: 0.54, front: Math.PI * 1.85 } as const;
const HELMET: readonly Point[] = [
  [0.56, 0.12],
  [0.4, 0.56],
  [0.06, 0.58],
  [-0.08, 0.28],
  [-0.3, 0.38],
  [-0.5, 0.44],
];
/** The eye: an almond opening looking forward. At small size its front is taller, so it reads. */
const EYE: readonly Point[] = [
  [0.06, -0.06],
  [0.28, -0.17],
  [0.54, -0.12],
  [0.54, 0.04],
  [0.28, 0.04],
];
const EYE_SIMPLE: readonly Point[] = [
  [0.06, -0.06],
  [0.28, -0.19],
  [0.54, -0.14],
  [0.54, 0.09],
  [0.28, 0.07],
];
/**
 * The crest: a thick band of horsehair standing on the dome, from the brow over the top to the
 * back, a little past the ball's edge (drawn over the outline). Angles in radians.
 */
const CREST = {
  y: -0.1,
  radius: 0.68,
  width: 0.48,
  from: Math.PI * 1.04,
  to: Math.PI * 1.68,
} as const;
/** The planted shield: a thick arc at the edge facing the enemy, its half-angle in radians. */
const SHIELD = { radius: 0.83, width: 0.26, half: Math.PI * 0.25 } as const;
/** Dark rims, as fractions of r: thicker at small size so each part keeps its edge on a phone. */
const RIM = { full: 0.07, simple: 0.1 } as const;

function polygon(p: Painter, r: number, points: readonly Point[]): void {
  for (const [x, y] of points) p.lineTo(x * r, y * r);
  p.closePath();
}

/**
 * Undoes the turn towards the enemy, so the helmet stays upright and only looks left or right:
 * mirrored when the enemy is to its left.
 */
function upright(p: Painter, view: DesignView): void {
  const { heading } = view;
  if (heading === undefined) return;
  p.rotate(-Math.atan2(heading.y, heading.x));
  if (heading.x < 0) p.scale(-1, 1);
}

function drawHelmet(p: Painter, r: number, accent: string, simple: boolean): void {
  p.beginPath();
  p.moveTo(-0.5 * r, 0.44 * r);
  p.lineTo(-DOME.radius * r, DOME.y * r);
  p.arc(0, DOME.y * r, DOME.radius * r, Math.PI, DOME.front);
  polygon(p, r, HELMET);
  p.fillStyle = theme.spartanBronze;
  p.fill();
  if (!simple) {
    p.strokeStyle = accent;
    p.lineWidth = RIM.full * 0.8 * r;
    p.lineJoin = 'round';
    p.stroke();
  }
  p.fillStyle = accent;
  p.beginPath();
  polygon(p, r, simple ? EYE_SIMPLE : EYE);
  p.fill();
}

/** A smooth thick bronze arc at the edge facing the enemy (+x), with a dark rim all round. */
function drawShield(p: Painter, r: number, accent: string, simple: boolean): void {
  const rim = (simple ? RIM.simple : RIM.full) * r;
  p.save();
  p.beginPath();
  p.arc(0, 0, r, 0, Math.PI * 2);
  p.clip();
  p.lineCap = 'round';
  for (const [color, width] of [
    [accent, SHIELD.width * r + 2 * rim],
    [theme.spartanBronze, SHIELD.width * r],
  ] as const) {
    p.strokeStyle = color;
    p.lineWidth = width;
    p.beginPath();
    p.arc(0, 0, SHIELD.radius * r, -SHIELD.half, SHIELD.half);
    p.stroke();
  }
  p.restore();
}

/** The crest over the top, in cream with a dark rim, and at full size a few strands of horsehair. */
function drawCrest(p: Painter, r: number, accent: string, simple: boolean): void {
  const radius = CREST.radius * r;
  const y = CREST.y * r;
  p.lineCap = 'butt';
  for (const [color, width, pad] of [
    [accent, (CREST.width + 2 * (simple ? RIM.simple : RIM.full)) * r, 0.03],
    [theme.spartanCrest, CREST.width * r, 0],
  ] as const) {
    p.strokeStyle = color;
    p.lineWidth = width;
    p.beginPath();
    p.arc(0, y, radius, CREST.from - pad, CREST.to + pad);
    p.stroke();
  }
  if (simple) return;
  p.strokeStyle = accent;
  p.lineWidth = 0.035 * r;
  p.beginPath();
  const inner = radius - CREST.width * 0.25 * r;
  const outer = radius + CREST.width * 0.35 * r;
  for (let angle = CREST.from + 0.12; angle < CREST.to; angle += 0.16) {
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    p.moveTo(cos * inner, y + sin * inner);
    p.lineTo(cos * outer, y + sin * outer);
  }
  p.stroke();
}

/**
 * Shield and spear (the Spartan): a bronze crested helmet in profile on a crimson body, looking at
 * the enemy (it turns only left or right, never upside down), with a cream crest standing over the
 * top and a little past the ball's edge. While its shield is planted a thick bronze arc, rimmed in
 * dark and clear of the helmet, hugs the edge facing the enemy; once the spear is thrown the arc is
 * gone. The spear is only ever drawn in flight (projectiles.ts), never on the ball.
 */
export const spartanDesign: BallDesign = {
  facing: 'aim',
  shot: 'spear',
  draw(p, view) {
    const { radius: r, accent, simple } = view;
    p.save();
    upright(p, view);
    drawHelmet(p, r, accent, simple);
    p.restore();
    if (spartanRaisedOf(view.ball) === true) drawShield(p, r, accent, simple);
  },
  over(p, view) {
    p.save();
    upright(p, view);
    drawCrest(p, view.radius, view.accent, view.simple);
    p.restore();
  },
};
