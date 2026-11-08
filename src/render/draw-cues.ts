// Drawing for the heal pulse, and the source chip for unseen damage (ADR 0036); the pulse's size is
// a pure function in heal-pulse.ts.
import type { BallState } from '../sim/types.ts';
import { healSize, type HealPulse } from './heal-pulse.ts';
import { healthBarRect } from './health-bar.ts';
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
 * A disc in the attacker's colour at the left end of the hit ball's health pill (the right end
 * near the left wall), for damage whose cause isn't on screen (ADR 0036). It pops in, then fades;
 * with reduced motion it only fades.
 */
export function drawSourceChip(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  color: string,
  strength: number,
  reducedMotion: boolean,
  arenaSize: number,
): void {
  if (strength <= 0) return;
  const bar = healthBarRect(ball, arenaSize);
  const pop = reducedMotion ? 1 : 1 + theme.sourceChipPop * Math.max(0, strength - 0.75) * 4;
  const radius = theme.sourceChipRadius * pop;
  const gap = theme.sourceChipGap + theme.sourceChipRadius;
  const left = bar.x - gap;
  const cx = left - theme.sourceChipRadius < 0 ? bar.x + bar.width + gap : left;
  const cy = bar.y + bar.height / 2;
  ctx.save();
  ctx.globalAlpha = Math.min(1, strength * 2.5);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = theme.sourceChipOutlineWidth;
  ctx.strokeStyle = theme.healthTrack;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
