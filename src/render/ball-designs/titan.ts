import { STANDARD_BALL_RADIUS } from '../../sim/constants.ts';
import { MAX_RADIUS } from '../../sim/balls/titan.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** The heartwood: a solid core, in world units, the same size all match. */
const CORE = 15;
/**
 * Its rings, in world units from the centre, never fractions of r: the body grows out past them,
 * as a tree grows past its old rings. The first two are there from the start; each later one
 * appears once the body has grown RING_ROOM past it, one every 12 units of growth.
 */
const RINGS: readonly number[] = [26, 38, 50, 61, 73];
const RING_ROOM = 12;
/**
 * Rings drift off-centre the further out they are, as a tree's do (wider on its sunny side): so it
 * reads as wood, never as a target. Per world unit of ring radius.
 */
const DRIFT = { x: -0.06, y: -0.045 } as const;
/** A new ring fades in over this much growth, in world units, so it grows in rather than pops. */
const RING_FADE = 3;

/** How grown the Titan is, 0 at the start to 1 at its largest. */
export function titanGrowth(radius: number): number {
  return Math.min(
    1,
    Math.max(0, (radius - STANDARD_BALL_RADIUS) / (MAX_RADIUS - STANDARD_BALL_RADIUS)),
  );
}

/** How much of the ring at `ring` units shows on a body `radius` across, 0 to 1. */
export function titanRingShown(ring: number, radius: number): number {
  return Math.min(1, Math.max(0, (radius - ring - RING_ROOM) / RING_FADE + 1));
}

function circle(p: Painter, radius: number, x = 0, y = 0): void {
  p.beginPath();
  p.arc(x, y, radius, 0, Math.PI * 2);
}

/** Points round a ring; joined by curves through their midpoints, so it stays smooth. */
const RING_POINTS = 14;
/** How far a ring wanders from round, as a share of its radius. */
const RING_WANDER = 0.05;

type Point = readonly [number, number];

/**
 * One ring as a log's grows them: never quite round, each ring wandering its own way. Its corner
 * points and the midpoints between them on a ring of radius 1, worked out once: a frame only
 * scales them.
 */
function ringShape(seed: number): { readonly corners: Point[]; readonly mids: Point[] } {
  const corners = Array.from({ length: RING_POINTS }, (_, i): Point => {
    const angle = (i / RING_POINTS) * Math.PI * 2;
    const wander =
      1 +
      RING_WANDER * 0.6 * Math.sin(3 * angle + seed * 1.7) +
      RING_WANDER * 0.4 * Math.sin(5 * angle + seed * 2.9);
    return [Math.cos(angle) * wander, Math.sin(angle) * wander];
  });
  const mids = corners.map((corner, i): Point => {
    const next = corners[(i + 1) % RING_POINTS] ?? corner;
    return [(corner[0] + next[0]) / 2, (corner[1] + next[1]) / 2];
  });
  return { corners, mids };
}
const RING_SHAPES = RINGS.map((_, index) => ringShape(index));

function woodRing(p: Painter, radius: number, x: number, y: number, index: number): void {
  const shape = RING_SHAPES[index];
  if (shape === undefined) return;
  const at = ([px, py]: Point): Point => [x + px * radius, y + py * radius];
  p.moveTo(...at(shape.mids[RING_POINTS - 1] ?? [1, 0]));
  for (let i = 0; i < RING_POINTS; i++) {
    const corner = shape.corners[i];
    const mid = shape.mids[i];
    if (corner === undefined || mid === undefined) continue;
    p.quadraticCurveTo(...at(corner), ...at(mid));
  }
  p.closePath();
}

/** The check: a thin split from the heartwood out towards the bark, as a log end has. */
const CHECK = { cos: Math.cos(-0.7), sin: Math.sin(-0.7), width: 0.09 } as const;

/**
 * Tree rings (the Titan grows and gets heavier, ADR 0034): a dark heartwood core and rings drawn
 * at fixed sizes in the world, a little off-centre and never quite round, with a split from the heart, like a log's end, so the body visibly grows out past them and a new ring appears at
 * its edge every few seconds; at its largest it carries five. The rings thicken as it grows, as its
 * bump does. At small size the lines are heavier.
 */
export const titanDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const grown = titanGrowth(ball.radius);
    // Drawn in the ball's own units: a design is scaled so r is the ball's radius.
    const unit = r / ball.radius;
    const [thin, thick] = theme.titanRing;
    p.strokeStyle = accent;
    p.lineWidth = (thin + (thick - thin) * grown) * (simple ? 1.5 : 1) * unit;
    // Every whole ring in one stroke; only a ring still growing in is stroked on its own, fainter.
    const ringAt = (ring: number, index: number) => {
      woodRing(p, ring * unit, ring * DRIFT.x * unit, ring * DRIFT.y * unit, index);
    };
    p.beginPath();
    RINGS.forEach((ring, index) => {
      if (titanRingShown(ring, ball.radius) >= 1) ringAt(ring, index);
    });
    p.stroke();
    RINGS.forEach((ring, index) => {
      const shown = titanRingShown(ring, ball.radius);
      if (shown <= 0 || shown >= 1) return;
      p.globalAlpha = shown;
      p.beginPath();
      ringAt(ring, index);
      p.stroke();
      p.globalAlpha = 1;
    });
    p.fillStyle = accent;
    // The check runs from the core to just inside the edge, so it lengthens as the Titan grows.
    const reach = (ball.radius - 9) * unit;
    const { cos, sin } = CHECK;
    const half = CHECK.width * reach * (simple ? 1.4 : 1);
    p.beginPath();
    p.moveTo(-sin * half, cos * half);
    p.lineTo(cos * reach, sin * reach);
    p.lineTo(sin * half, -cos * half);
    p.closePath();
    p.fill();
    circle(p, CORE * unit, CORE * DRIFT.x * unit, CORE * DRIFT.y * unit);
    p.fill();
  },
};
