// The Kraken's tentacles on the court (ADR 0075). While they are called, ripples spread on the
// floor where each enemy was heading, out to the grab's reach (a ball whose edge is inside the
// outer ring when they rise is caught). Then 2-4 thick tentacles break through the floor round each
// ball held, coil over it, suckers inward, and tighten to the crush, with a faint line back to the
// anchored Kraken. Reads sim state only; with reduced motion the ripples stand still.
import { GRAB_REACH, HOLD_TICKS, krakenStateOf, RIPPLE_TICKS } from '../sim/balls/kraken.ts';
import { tentaclesFor } from '../sim/balls/kraken.ts';
import type { BallState, WorldState } from '../sim/types.ts';
import { theme } from './theme.ts';

/** Ripples where the tentacles will rise. Drawn under the balls. */
export function drawRipples(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  reducedMotion: boolean,
): void {
  for (const kraken of world.balls) {
    const state = krakenStateOf(kraken);
    if (state === undefined || kraken.health <= 0 || state.burstTick < 0) continue;
    // 0 as they are called, 1 as the tentacles rise.
    const near = Math.min(1, Math.max(0, 1 - (state.burstTick - world.tick) / RIPPLE_TICKS));
    const drift = reducedMotion
      ? 0
      : (world.tick % theme.krakenRippleTicks) / theme.krakenRippleTicks;
    ctx.save();
    ctx.strokeStyle = theme.krakenRipple;
    ctx.lineWidth = theme.krakenRippleWidth;
    for (const spot of state.spots) {
      // The reach, steady and brightening; inside it, rings spreading out to it.
      ctx.globalAlpha = theme.krakenRippleAlpha * (0.5 + 0.5 * near);
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, GRAB_REACH, 0, Math.PI * 2);
      ctx.stroke();
      for (let ring = 0; ring < theme.krakenRippleRings; ring++) {
        const share = (ring + drift) / theme.krakenRippleRings;
        ctx.globalAlpha = theme.krakenRippleAlpha * (1 - share) * (0.4 + 0.6 * near);
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, Math.max(1, GRAB_REACH * share), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** A point on a tentacle's centre line and its half-width there. */
type Section = readonly [x: number, y: number, half: number];

/** How many sections along each tentacle, and the share of it from the floor to the ball. */
const SECTIONS = 12;
const REACH_SHARE = 0.28;

/**
 * One tentacle's centre line round a held ball, as far as it has risen (`rise`): from the floor
 * outside the ball at `angle`, in to its edge, then coiling `sweep` round it over the top, tighter
 * and thicker as the crush nears (`grip`). Thick at the floor, tapering to the tip.
 */
function coil(
  ball: BallState,
  angle: number,
  sweep: number,
  grip: number,
  rise: number,
): readonly Section[] {
  const { x, y } = ball.position;
  const r = ball.radius;
  const wrap = theme.krakenCoilRadius - theme.krakenCoilTighten * grip;
  const width = theme.krakenTentacleWidth * (1 + theme.krakenSwell * grip);
  const start = angle + theme.krakenCoilLead;
  const sections: Section[] = [];
  for (let index = 0; index <= SECTIONS; index++) {
    const t = index / SECTIONS;
    if (t > rise) break;
    let turn: number;
    let radius: number;
    if (t <= REACH_SHARE) {
      // From the floor in to the ball's edge, bending round into the coil.
      const u = t / REACH_SHARE;
      turn = angle + (start - angle) * u * u;
      radius = r * (theme.krakenBase + (1 - theme.krakenBase) * u);
    } else {
      // Over the ball, closing in from its edge to the grip.
      const u = (t - REACH_SHARE) / (1 - REACH_SHARE);
      turn = start + sweep * u;
      radius = r * (1 + (wrap - 1) * Math.min(1, u * 2.5));
    }
    const half = (width / 2) * (1 - theme.krakenTaper * t);
    sections.push([x + Math.cos(turn) * radius, y + Math.sin(turn) * radius, half]);
  }
  return sections;
}

/**
 * A tentacle as one closed outline, `extra` wider each side: out along one side of its centre line,
 * back along the other.
 */
function ribbon(ctx: CanvasRenderingContext2D, sections: readonly Section[], extra: number): void {
  const left: (readonly [number, number])[] = [];
  const right: (readonly [number, number])[] = [];
  sections.forEach(([px, py, narrow], index) => {
    const half = narrow + extra;
    const [ax, ay] = sections[Math.max(0, index - 1)] ?? [px, py];
    const [bx, by] = sections[Math.min(sections.length - 1, index + 1)] ?? [px, py];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / length;
    const ny = (bx - ax) / length;
    left.push([px + nx * half, py + ny * half]);
    right.push([px - nx * half, py - ny * half]);
  });
  ctx.beginPath();
  [...left, ...right.reverse()].forEach(([px, py], index) => {
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

/** The line from the Kraken's edge to the held ball's: it anchors while it squeezes. */
function anchor(ctx: CanvasRenderingContext2D, kraken: BallState, ball: BallState): void {
  const dx = ball.position.x - kraken.position.x;
  const dy = ball.position.y - kraken.position.y;
  const apart = Math.hypot(dx, dy);
  if (apart <= kraken.radius + ball.radius) return;
  const ux = dx / apart;
  const uy = dy / apart;
  ctx.globalAlpha = theme.krakenAnchorAlpha;
  ctx.strokeStyle = theme.krakenTentacle;
  ctx.lineWidth = theme.krakenAnchorWidth;
  ctx.beginPath();
  ctx.moveTo(kraken.position.x + ux * kraken.radius, kraken.position.y + uy * kraken.radius);
  ctx.lineTo(ball.position.x - ux * ball.radius, ball.position.y - uy * ball.radius);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** One tentacle: the ripple and hole where it broke the floor, its body, and its suckers. */
function tentacle(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  sections: readonly Section[],
  rise: number,
): void {
  const [root] = sections;
  if (root === undefined) return;
  if (rise < 1) {
    // The ripple it breaks through, gone once it has risen.
    ctx.strokeStyle = theme.krakenRipple;
    ctx.lineWidth = theme.krakenRippleWidth;
    ctx.globalAlpha = theme.krakenRippleAlpha * (1 - rise);
    ctx.beginPath();
    ctx.arc(root[0], root[1], root[2] * theme.krakenHoleShare, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // The dark hole it comes up out of, so its cut root reads as below the floor.
  ctx.fillStyle = theme.krakenTentacleEdge;
  ctx.beginPath();
  ctx.arc(root[0], root[1], root[2] * theme.krakenHoleFill, 0, Math.PI * 2);
  ctx.fill();
  // Its dark edge, then its body: two fills, much cheaper than stroking the outline.
  ribbon(ctx, sections, theme.krakenTentacleEdgeWidth);
  ctx.fillStyle = theme.krakenTentacleEdge;
  ctx.fill();
  ribbon(ctx, sections, 0);
  ctx.fillStyle = theme.krakenTentacle;
  ctx.fill();
  const { x, y } = ball.position;
  ctx.fillStyle = theme.krakenSucker;
  ctx.beginPath();
  for (let index = 3; index < sections.length - 1; index += 2) {
    const [px, py, half] = sections[index] ?? root;
    const toward = Math.hypot(x - px, y - py) || 1;
    const sx = px + ((x - px) / toward) * half * 0.45;
    const sy = py + ((y - py) / toward) * half * 0.45;
    const size = half * theme.krakenSuckerShare;
    ctx.moveTo(sx + size, sy);
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** The tentacles round every ball a Kraken holds, and its anchor line. Drawn over the balls. */
export function drawTentacles(ctx: CanvasRenderingContext2D, world: WorldState): void {
  for (const kraken of world.balls) {
    const state = krakenStateOf(kraken);
    if (state === undefined || kraken.health <= 0) continue;
    for (const [id, crushTick] of Object.entries(state.holds)) {
      const ball = world.balls.find((other) => other.id === id);
      if (ball === undefined || ball.health <= 0) continue;
      const held = Math.min(1, Math.max(0, 1 - (crushTick - world.tick) / HOLD_TICKS));
      const rise = Math.min(1, held / theme.krakenRiseShare);
      const count = tentaclesFor(ball.radius);
      const sweep = (Math.PI * 2) / count + theme.krakenCoilOverlap;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      anchor(ctx, kraken, ball);
      for (let index = 0; index < count; index++) {
        const angle = Math.PI / 2 + (index * Math.PI * 2) / count;
        tentacle(ctx, ball, coil(ball, angle, sweep, held, rise), rise);
      }
      ctx.restore();
    }
  }
}
