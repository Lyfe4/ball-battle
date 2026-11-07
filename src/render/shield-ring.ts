// The Guardian's shield (ADR 0043): a bright gold ring hugging a shielded ball, and, when a hit
// breaks it, its pieces flying out and fading. Reads state and effect strength only.
import type { BallState } from '../sim/types.ts';
import { theme } from './theme.ts';

/** Where the ring sits: just outside the ball's edge. */
export function shieldRingRadius(ball: BallState): number {
  return ball.radius + theme.shieldRingGap;
}

/** The shield while it is up: a solid gold ring just outside the edge. Still. */
export function drawShieldRing(ctx: CanvasRenderingContext2D, ball: BallState): void {
  ctx.save();
  ctx.strokeStyle = theme.shieldRing;
  ctx.lineWidth = theme.shieldRingWidth;
  ctx.beginPath();
  ctx.arc(ball.position.x, ball.position.y, shieldRingRadius(ball), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * A shield breaking, `strength` from 1 (just broken) down to 0: the ring in pieces, flying out and
 * fading. With reduced motion the pieces fade where they broke.
 */
export function drawShieldBreak(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  strength: number,
  reducedMotion: boolean,
): void {
  if (strength <= 0) return;
  const pieces = theme.shieldShards;
  const out = reducedMotion ? 0 : (1 - strength) * theme.shieldShardFlight;
  const radius = shieldRingRadius(ball) + out;
  // Each piece is half its slot, so the ring reads as broken.
  const span = Math.PI / pieces;
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.strokeStyle = theme.shieldRing;
  ctx.lineWidth = theme.shieldRingWidth;
  ctx.lineCap = 'round';
  for (let index = 0; index < pieces; index++) {
    const start = (index * 2 * Math.PI) / pieces;
    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y, radius, start, start + span);
    ctx.stroke();
  }
  ctx.restore();
}
