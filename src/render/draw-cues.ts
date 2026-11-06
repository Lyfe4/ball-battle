// Drawing for the heal pulse and the rule cue (ADR 0028), and the source chip for unseen damage
// (ADR 0036); their sizes and shapes are pure functions in heal-pulse.ts and rule-cue.ts.
import type { BallState } from '../sim/types.ts';
import { healSize, type HealPulse } from './heal-pulse.ts';
import { healthBarRect } from './health-bar.ts';
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
