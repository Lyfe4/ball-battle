// Drawing for the heal pulse and the rule cue (ADR 0028); their sizes and shapes are pure
// functions in heal-pulse.ts and rule-cue.ts.
import type { BallState } from '../sim/types.ts';
import { healSize, type HealPulse } from './heal-pulse.ts';
import { cueAlpha, cueScale, ruleCuePoints } from './rule-cue.ts';
import { theme } from './theme.ts';

/**
 * A green wash over the ball and a ring that swells out from its edge, both sized by the heal. With
 * reduced motion the ring stays at the edge and only fades.
 */
export function drawHealPulse(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  { strength, amount, maxHealth }: HealPulse,
  reducedMotion: boolean,
): void {
  const size = healSize(amount, maxHealth);
  if (strength <= 0 || size <= 0) return;
  const { x, y } = ball.position;
  ctx.save();
  ctx.fillStyle = theme.healRing;
  ctx.globalAlpha = strength * theme.healWashAlpha * size;
  ctx.beginPath();
  ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  const growth = reducedMotion ? 0 : (1 - strength) * theme.healRingGrowth * size;
  ctx.globalAlpha = strength * (0.5 + 0.5 * size);
  ctx.strokeStyle = theme.healRing;
  ctx.lineWidth = theme.healRingWidth * (0.5 + 0.5 * size);
  ctx.beginPath();
  ctx.arc(x, y, ball.radius + ctx.lineWidth / 2 + growth, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * The spark beside `ball`, at its upper right (upper left near the right wall, so it stays in the
 * arena), clear of the health bar above it.
 */
export function drawRuleCue(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  strength: number,
  reducedMotion: boolean,
  arenaSize: number,
): void {
  if (strength <= 0) return;
  const size = ball.radius * theme.ruleCueSize * cueScale(strength, reducedMotion);
  if (size <= 0) return;
  const offset = ball.radius + ball.radius * theme.ruleCueSize * 0.5;
  const side = ball.position.x + offset + ball.radius * theme.ruleCueSize > arenaSize ? -1 : 1;
  const cx = ball.position.x + side * offset;
  const cy = ball.position.y - ball.radius * 0.45;
  ctx.save();
  ctx.globalAlpha = cueAlpha(strength);
  ctx.beginPath();
  ruleCuePoints().forEach(([px, py], index) => {
    const x = cx + px * size;
    const y = cy + py * size;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = theme.ruleCueOutlineWidth;
  ctx.strokeStyle = theme.ruleCueOutline;
  ctx.stroke();
  ctx.fillStyle = theme.ruleCueFill;
  ctx.fill();
  ctx.restore();
}
