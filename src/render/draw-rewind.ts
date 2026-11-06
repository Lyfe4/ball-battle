// Draws the Chrono's rewind (ADR 0034). The rewinds themselves are tracked in rewind.ts.
import type { RewindTrail } from './rewind.ts';
import { theme } from './theme.ts';

/**
 * Draws each rewind under the balls: the dotted trail back to where the ball landed, and a ghost
 * of it at the spot it left, both fading out. Nothing moves, so it is the same with reduced motion.
 */
export function drawRewinds(
  ctx: CanvasRenderingContext2D,
  trails: readonly RewindTrail[],
  radiusOf: (ballId: string) => number,
  colorOf: (ballId: string) => string,
): void {
  for (const { ballId, from, to, strength } of trails) {
    ctx.save();
    ctx.globalAlpha = strength;
    ctx.strokeStyle = theme.rewindTrail;
    ctx.lineWidth = theme.rewindTrailWidth;
    ctx.lineCap = 'round';
    ctx.setLineDash([...theme.rewindTrailDash]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = strength * theme.rewindGhostAlpha;
    ctx.fillStyle = colorOf(ballId);
    ctx.beginPath();
    ctx.arc(from.x, from.y, radiusOf(ballId), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
