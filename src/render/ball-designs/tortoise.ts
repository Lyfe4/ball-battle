import { hasStatus } from '../../sim/status.ts';
import type { BallState } from '../../sim/types.ts';
import { theme } from '../theme.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

/** The carapace (the shell's top) and its centre plate, as fractions of r. */
const CARAPACE = 0.76;
const PLATE = 0.3;
/**
 * A part that peeks out from under the carapace: its angle off the heading, its radius, and where
 * its centre sits ducked (hidden under the carapace) and out (just past the ball's edge, never more
 * than an icon's padding, 12% of r), as fractions of r.
 */
interface Lobe {
  readonly cos: number;
  readonly sin: number;
  readonly angle: number;
  readonly radius: number;
  readonly ducked: number;
  readonly out: number;
}
const lobe = (angle: number, radius: number, ducked: number, out: number): Lobe => ({
  cos: Math.cos(angle),
  sin: Math.sin(angle),
  angle,
  radius,
  ducked,
  out,
});
const HEAD = lobe(0, 0.27, 0.45, 0.85);
const FEET: readonly Lobe[] = [0.9, -0.9, 2.3, -2.3].map((angle) => lobe(angle, 0.15, 0.58, 0.93));
const PARTS: readonly Lobe[] = [HEAD, ...FEET];
/** The flat-topped centre plate's corners (unit), its first pointing at the head. */
const HEX: readonly (readonly [number, number])[] = [0, 1, 2, 3, 4, 5].map((k) => [
  Math.cos((k * Math.PI) / 3),
  Math.sin((k * Math.PI) / 3),
]);
/** The seams across the rim below the carapace: twelve, between the parts. */
const RIM_SEAMS: readonly (readonly [number, number])[] = Array.from({ length: 12 }, (_, k) => {
  const angle = ((k + 0.5) * Math.PI) / 6;
  return [Math.cos(angle), Math.sin(angle)];
});

/**
 * How far its head and feet are out, 0 (ducked into the shell) to 1: out while it moves, in while a
 * snare or tentacle holds it or it stands still, and in for a moment as its shell cuts a hit (the
 * glance, 1 just cut down to 0).
 */
export function peekOf(ball: BallState, glance: number): number {
  const moving = ball.velocity.x !== 0 || ball.velocity.y !== 0;
  if (!moving || hasStatus(ball, 'held')) return 0;
  return Math.min(1, Math.max(0, 1 - glance));
}

/** Where a part's centre sits, and how far its front reaches, at `peek`, as fractions of r. */
function partAt(part: Lobe, peek: number): { readonly centre: number; readonly front: number } {
  const centre = part.ducked + (part.out - part.ducked) * peek;
  return { centre, front: centre + part.radius };
}

/**
 * The body's outline: the ball's circle, with a bump round each part that reaches past its edge.
 * Each bump is the part's own circle from where it meets the ball's on one side to the other.
 */
function outline(p: Painter, view: DesignView): void {
  const r = view.radius;
  const peek = peekOf(view.ball, view.glance ?? 0);
  // Each part out past the edge: its angle, and the half-angles where its circle meets the ball's.
  const bumps = PARTS.map((part) => {
    const { centre, front } = partAt(part, peek);
    if (front <= 1) return undefined;
    const d = centre;
    const x = (1 - part.radius * part.radius + d * d) / (2 * d);
    const y = Math.sqrt(Math.max(0, 1 - x * x));
    return { part, d, onBall: Math.atan2(y, x), onPart: Math.atan2(y, x - d) };
  })
    .filter((bump) => bump !== undefined)
    .map((bump) => ({ ...bump, from: (bump.part.angle + Math.PI * 2) % (Math.PI * 2) }))
    .sort((a, b) => a.from - b.from);
  if (bumps.length === 0) {
    p.arc(0, 0, r, 0, Math.PI * 2);
    return;
  }
  const last = bumps.at(-1);
  if (last === undefined) return;
  let at = last.from + last.onBall - Math.PI * 2;
  for (const { part, d, onBall, onPart, from } of bumps) {
    p.arc(0, 0, r, at, from - onBall);
    p.arc(d * part.cos * r, d * part.sin * r, part.radius * r, from - onPart, from + onPart);
    at = from + onBall;
  }
  p.closePath();
}

/** The head and feet, in its skin with a dark edge, at `peek`; the carapace is drawn over them. */
function drawParts(p: Painter, r: number, accent: string, peek: number): void {
  p.fillStyle = theme.tortoiseSkin;
  p.strokeStyle = accent;
  p.lineWidth = theme.tortoiseSeam * r;
  for (const part of PARTS) {
    const { centre } = partAt(part, peek);
    p.beginPath();
    p.arc(centre * part.cos * r, centre * part.sin * r, part.radius * r, 0, Math.PI * 2);
    p.fill();
    p.stroke();
  }
}

/** The carapace: plain shell over the parts, a lighter centre plate and seams out to its rim. */
function drawCarapace(p: Painter, r: number, base: string, accent: string): void {
  p.fillStyle = base;
  p.strokeStyle = accent;
  p.lineWidth = theme.tortoiseSeam * r;
  p.beginPath();
  p.arc(0, 0, CARAPACE * r, 0, Math.PI * 2);
  p.fill();
  p.stroke();
  p.beginPath();
  for (const [x, y] of HEX) p.lineTo(x * PLATE * r, y * PLATE * r);
  p.closePath();
  p.fillStyle = theme.tortoiseScute;
  p.fill();
  // Spokes from the plate's corners to the carapace's rim: six plates round the centre one.
  for (const [x, y] of HEX) {
    p.moveTo(x * PLATE * r, y * PLATE * r);
    p.lineTo(x * CARAPACE * r, y * CARAPACE * r);
  }
  p.stroke();
}

/**
 * A tortoise from above (ADR 0091): the carapace of plates over a rim of shell, with its head and
 * four feet in its skin peeking out from under it, the head along its heading. While it moves they
 * are out; when its shell cuts a hit they duck in for a moment (as the glance ring flashes round
 * it), and they stay in while it is held. Drawn alike at every size, in fractions of r.
 */
export const tortoiseDesign: BallDesign = {
  facing: 'velocity',
  outline,
  draw(p, view) {
    const { radius: r, accent, base } = view;
    const peek = peekOf(view.ball, view.glance ?? 0);
    // Seams across the rim, under the parts.
    p.strokeStyle = accent;
    p.lineWidth = theme.tortoiseSeam * 0.8 * r;
    p.beginPath();
    for (const [x, y] of RIM_SEAMS) {
      p.moveTo(x * CARAPACE * r, y * CARAPACE * r);
      p.lineTo(x * r, y * r);
    }
    p.stroke();
    drawParts(p, r, accent, peek);
    drawCarapace(p, r, base, accent);
    // Its eyes, once the head is out far enough to show them past the carapace.
    const { centre } = partAt(HEAD, peek);
    const eye = centre + 0.1;
    if (eye - 0.05 > CARAPACE) {
      p.fillStyle = accent;
      p.beginPath();
      for (const side of [-1, 1]) {
        p.moveTo((eye + 0.055) * r, side * 0.11 * r);
        p.arc(eye * r, side * 0.11 * r, 0.055 * r, 0, Math.PI * 2);
      }
      p.fill();
    }
  },
};
