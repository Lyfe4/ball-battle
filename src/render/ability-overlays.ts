import { MAX_STACKS, stacksOf } from '../sim/balls/speedster.ts';
import type { BallState } from '../sim/types.ts';
import { theme } from './theme.ts';

type OverlayDrawer = (ctx: CanvasRenderingContext2D, ball: BallState) => void;

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
]);
