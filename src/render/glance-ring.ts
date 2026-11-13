// A hit glancing off a defence (ADR 0045, 0047): the Spartan's planted shield took half of it, or
// the phased Ghost took all of it (ADR 0049). A bright gold ring just outside the ball, in pieces
// that fly out and fade.
import type { BallState } from '../sim/types.ts';
import { theme } from './theme.ts';

/**
 * A glance, `strength` from 1 (just hit) down to 0: the ring in pieces, flying out and fading.
 * With reduced motion the pieces fade where they are.
 */
export function drawGlance(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  strength: number,
  reducedMotion: boolean,
): void {
  if (strength <= 0) return;
  const pieces = theme.glanceShards;
  const out = reducedMotion ? 0 : (1 - strength) * theme.glanceShardFlight;
  const radius = ball.radius + theme.glanceRingGap + out;
  // Each piece is half its slot, so the ring reads as broken.
  const span = Math.PI / pieces;
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.strokeStyle = theme.glanceRing;
  ctx.lineWidth = theme.glanceRingWidth;
  ctx.lineCap = 'round';
  for (let index = 0; index < pieces; index++) {
    const start = (index * 2 * Math.PI) / pieces;
    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y, radius, start, start + span);
    ctx.stroke();
  }
  ctx.restore();
}
