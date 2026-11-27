// The Medusa's gaze (prototype): while her eyes glow, a faint cone along her heading; when she
// glares, a bright cone the way she glared that fades out. Read from sim state only.
import { GAZE_RANGE, GAZE_SPREAD, medusaStateOf } from '../sim/balls/medusa.ts';
import type { Vec2, WorldState } from '../sim/types.ts';
import { theme } from './theme.ts';

function cone(ctx: CanvasRenderingContext2D, from: Vec2, dir: Vec2): void {
  const far = { x: from.x + dir.x * GAZE_RANGE, y: from.y + dir.y * GAZE_RANGE };
  const half = GAZE_RANGE * GAZE_SPREAD;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(far.x - dir.y * half, far.y + dir.x * half);
  ctx.lineTo(far.x + dir.y * half, far.y - dir.x * half);
  ctx.closePath();
}

/** Every live Medusa's gaze: winding up, or just glared. */
export function drawGazes(ctx: CanvasRenderingContext2D, world: WorldState): void {
  for (const ball of world.balls) {
    if (ball.health <= 0) continue;
    const state = medusaStateOf(ball);
    if (state === undefined) continue;
    const { x, y } = ball.velocity;
    const speed = Math.sqrt(x * x + y * y);
    ctx.save();
    ctx.fillStyle = theme.medusaGlare;
    if (state.glareTick >= 0 && speed > 0) {
      ctx.globalAlpha = theme.medusaWindupAlpha;
      cone(ctx, ball.position, { x: x / speed, y: y / speed });
      ctx.fill();
    }
    const since = world.tick - state.lastGlareTick;
    if (state.lastGlareTick >= 0 && since < theme.medusaGlareTicks) {
      ctx.globalAlpha = theme.medusaGlareAlpha * (1 - since / theme.medusaGlareTicks);
      cone(ctx, ball.position, { x: state.glareDx, y: state.glareDy });
      ctx.fill();
    }
    ctx.restore();
  }
}
