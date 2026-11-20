// The Kraken's tentacles on the court (ADR 0075). While they are called, ripples spread on the
// floor where each enemy was heading, out to the grab's reach (a ball whose edge is inside the
// outer ring when they rise is caught). Then 2-4 thick tentacles rise round each ball held, wrap
// over it and tighten to the crush, with a faint line back to the anchored Kraken. Reads sim state
// only; with reduced motion the ripples stand still.
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

/** One tentacle's path over a held ball: from the floor outside it, up and over to its tip. */
function tentaclePath(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  angle: number,
  grip: number,
  rise: number,
): void {
  const { x, y } = ball.position;
  const r = ball.radius;
  const at = (radius: number, turn: number) => ({
    x: x + Math.cos(angle + turn) * radius,
    y: y + Math.sin(angle + turn) * radius,
  });
  const base = at(r * 1.35, 0);
  const bend = at(r * 1.15, 0.85);
  // It tightens as the crush nears: the tip reaches further in.
  const tip = at(r * (0.5 - 0.25 * grip), 1.45);
  // Rising: only the first `rise` of the curve (de Casteljau), so it grows out of the floor.
  const u = 1 - rise;
  const end = {
    x: u * u * base.x + 2 * u * rise * bend.x + rise * rise * tip.x,
    y: u * u * base.y + 2 * u * rise * bend.y + rise * rise * tip.y,
  };
  const control = { x: base.x + (bend.x - base.x) * rise, y: base.y + (bend.y - base.y) * rise };
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
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
      ctx.save();
      ctx.lineCap = 'round';
      // The anchor: a faint line back to the Kraken.
      ctx.globalAlpha = theme.krakenAnchorAlpha;
      ctx.strokeStyle = theme.krakenTentacle;
      ctx.lineWidth = theme.krakenAnchorWidth;
      ctx.beginPath();
      ctx.moveTo(kraken.position.x, kraken.position.y);
      ctx.lineTo(ball.position.x, ball.position.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let index = 0; index < count; index++) {
        const angle = Math.PI / 2 + (index * Math.PI * 2) / count;
        tentaclePath(ctx, ball, angle, held, rise);
        ctx.strokeStyle = theme.krakenTentacleEdge;
        ctx.lineWidth = theme.krakenTentacleWidth + theme.krakenTentacleEdgeWidth * 2;
        ctx.stroke();
        ctx.strokeStyle = theme.krakenTentacle;
        ctx.lineWidth = theme.krakenTentacleWidth;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
