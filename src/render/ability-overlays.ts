import { COOLDOWN_TICKS, nextShotTickOf } from '../sim/balls/archer.ts';
import { MAX_STACKS, stacksOf } from '../sim/balls/speedster.ts';
import type { BallState } from '../sim/types.ts';
import { theme } from './theme.ts';

type OverlayDrawer = (ctx: CanvasRenderingContext2D, ball: BallState, tick: number) => void;

/**
 * A row of pips across the middle of the ball, `filled` of `total` lit. Drawn inside the ball so
 * they are never clipped by a wall or covered by the health bar.
 */
function drawPips(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  filled: number,
  total: number,
): void {
  const { x, y } = ball.position;
  const startX = x - ((total - 1) * theme.pipSpacing) / 2;
  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * theme.pipSpacing, y, theme.pipRadius, 0, Math.PI * 2);
    ctx.fillStyle = i < filled ? theme.pipFilled : theme.pipEmpty;
    ctx.fill();
  }
}

/**
 * A ring around the ball that fills clockwise from the top as `fraction` goes from 0 to 1, e.g. a
 * cooldown recharging. Trig is fine here: only src/sim must avoid it (ADR 0001).
 */
function drawChargeArc(ctx: CanvasRenderingContext2D, ball: BallState, fraction: number): void {
  const { x, y } = ball.position;
  const radius = ball.radius + theme.chargeArcGap;
  const start = -Math.PI / 2;
  ctx.lineWidth = theme.chargeArcWidth;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = theme.chargeArcEmpty;
  ctx.stroke();
  if (fraction <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, radius, start, start + fraction * Math.PI * 2);
  ctx.strokeStyle = theme.chargeArcFilled;
  ctx.stroke();
}

/**
 * Per-ball ability visuals, keyed by definition id. Balls without an entry draw nothing extra.
 * Reads ability state only; never changes it.
 */
export const ABILITY_OVERLAYS: ReadonlyMap<string, OverlayDrawer> = new Map([
  [
    'speedster',
    (ctx, ball) => {
      drawPips(ctx, ball, stacksOf(ball), MAX_STACKS);
    },
  ],
  [
    'archer',
    (ctx, ball, tick) => {
      const next = nextShotTickOf(ball);
      if (next === undefined) return;
      drawChargeArc(ctx, ball, Math.min(1, Math.max(0, 1 - (next - tick) / COOLDOWN_TICKS)));
    },
  ],
]);
