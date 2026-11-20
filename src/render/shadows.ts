// A floating ball's shadow on the floor (ADR 0075): the Balloon is the only ball that casts one,
// a soft dark oval just below it, which is what says it floats over fire, bombs and shockwaves.
// Drawn on the floor before every ball, so it never covers one.
import type { WorldState } from '../sim/types.ts';
import { BALL_DESIGNS } from './ball-designs/index.ts';
import { theme } from './theme.ts';

/** The shadow of every live ball whose design floats. */
export function drawShadows(ctx: CanvasRenderingContext2D, world: WorldState): void {
  for (const ball of world.balls) {
    if (ball.health <= 0 || BALL_DESIGNS.get(ball.definitionId)?.floats !== true) continue;
    const r = ball.radius;
    ctx.save();
    ctx.globalAlpha = theme.shadowAlpha;
    ctx.fillStyle = theme.shadow;
    ctx.translate(
      ball.position.x + theme.shadowOffsetX * r,
      ball.position.y + theme.shadowOffsetY * r,
    );
    ctx.scale(1, theme.shadowSquash);
    ctx.beginPath();
    ctx.arc(0, 0, theme.shadowWidth * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
