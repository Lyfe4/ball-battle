// A floating ball's shadow on the floor (ADR 0075): the Balloon is the only ball that casts one,
// a soft dark oval below it, which is what says it floats over fire, bombs and shockwaves. The
// light comes from one fixed direction (up and to the left), and the shadow trails a touch behind
// the way the ball drifts (drift.ts, shadowOffset), stretching a little with speed. Drawn on the
// floor before every ball, so it never covers one.
import type { Vec2, WorldState } from '../sim/types.ts';
import { BALL_DESIGNS } from './ball-designs/index.ts';
import { shadowOffset } from './drift.ts';
import { theme } from './theme.ts';

/** The shadow of every live ball whose design floats, trailing its drift. */
export function drawShadows(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  drift: (ballId: string) => Vec2,
): void {
  for (const ball of world.balls) {
    if (ball.health <= 0 || BALL_DESIGNS.get(ball.definitionId)?.floats !== true) continue;
    const r = ball.radius;
    const offset = shadowOffset(r, drift(ball.id));
    ctx.save();
    ctx.globalAlpha = theme.shadowAlpha;
    ctx.fillStyle = theme.shadow;
    ctx.translate(ball.position.x + offset.x, ball.position.y + offset.y);
    ctx.scale(1 + theme.shadowStretch * offset.stretch, theme.shadowSquash);
    ctx.beginPath();
    ctx.arc(0, 0, theme.shadowWidth * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
