// Short streaks on the court behind a ball that has just sped up (ADR 0077): gold behind a charging
// Jouster, red behind a thirsty Vampire. Under the balls. They are a state (it is charging, it is
// thirsty), drawn from the sim's state and the ball's velocity, so they follow the ball and change
// only as the sim's clock does; reduced motion draws them the same.
import { jousterStateOf } from '../sim/balls/jouster.ts';
import { thirstyUntilOf } from '../sim/balls/vampire.ts';
import type { BallState, WorldState } from '../sim/types.ts';
import { thirstShown } from './ball-designs/vampire.ts';
import { theme } from './theme.ts';

function streak(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  color: string,
  alpha: number,
): void {
  const { x: vx, y: vy } = ball.velocity;
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed === 0 || alpha <= 0) return;
  const back = { x: -vx / speed, y: -vy / speed };
  const side = { x: -back.y, y: back.x };
  const r = ball.radius;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = theme.streakWidth * r;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let index = 0; index < theme.streakLines; index++) {
    // Spread across the ball's back, the middle line longest.
    const across = (index / (theme.streakLines - 1) - 0.5) * 2 * theme.streakSpread;
    const length = theme.streakLength * (1 - Math.abs(across) * 0.6) * r;
    const from = {
      x: ball.position.x + (back.x * 0.75 + side.x * across) * r,
      y: ball.position.y + (back.y * 0.75 + side.y * across) * r,
    };
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(from.x + back.x * length, from.y + back.y * length);
  }
  ctx.stroke();
  ctx.restore();
}

/** Every charging Jouster's and thirsty Vampire's streak. Drawn under the balls. */
export function drawTrails(ctx: CanvasRenderingContext2D, world: WorldState): void {
  for (const ball of world.balls) {
    if (ball.health <= 0) continue;
    if (jousterStateOf(ball)?.charging === true) {
      streak(ctx, ball, theme.chargeStreak, theme.chargeStreakAlpha);
    }
    const until = thirstyUntilOf(ball);
    if (until !== undefined) {
      streak(
        ctx,
        ball,
        theme.thirstStreak,
        theme.thirstStreakAlpha * thirstShown(until, world.tick),
      );
    }
  }
}
