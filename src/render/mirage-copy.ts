// The Mirage's copy on the court (ADR 0077): the same ball at half opacity with a wobbling pale
// outline, no face and no health bar, so it never reads as a minion. It shimmers in where it
// appears and, popped, bursts into a ripple of haze (over the balls); the copy itself is under
// them, like a zone. Reads sim state only, so it moves only as the sim's clock does; with reduced motion its outline holds still and it simply fades in.
import { copyPosition, mirageStateOf } from '../sim/balls/mirage.ts';
import type { WorldState } from '../sim/types.ts';
import { wavyCircle } from './ball-designs/mirage.ts';
import type { CopyPopMoment } from './moments.ts';
import { theme } from './theme.ts';

/** Every live Mirage's copy while it shows. `colorOf` is the ball's colour as drawn. */
export function drawCopies(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  colorOf: (ballId: string) => string,
  reducedMotion: boolean,
): void {
  for (const ball of world.balls) {
    if (ball.health <= 0) continue;
    const state = mirageStateOf(ball);
    if (state?.copyOn !== true) continue;
    const at = copyPosition(ball.position, state, world.arena.size);
    const since = world.tick - state.backAt;
    const shimmer = Math.min(1, Math.max(0, since / theme.copyShimmerTicks));
    const r = ball.radius;
    // Its waves turn round once every copyWobbleTicks of the sim's clock.
    const phase = reducedMotion ? 0 : ((world.tick / theme.copyWobbleTicks) % 1) * Math.PI * 2;
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.globalAlpha = theme.copyAlpha * shimmer;
    ctx.fillStyle = colorOf(ball.id);
    ctx.beginPath();
    wavyCircle(ctx, r, theme.copyWobbleWaves, theme.copyWobble, phase, theme.copyWobbleSamples);
    ctx.fill();
    ctx.globalAlpha = shimmer;
    ctx.strokeStyle = theme.copyEdge;
    ctx.lineWidth = theme.copyEdgeWidth * r;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * A popped copy bursting into a ripple of haze where it hung: pale rings sweeping out one after
 * another and fading. With reduced motion the rings stand still and fade.
 */
export function drawCopyPops(
  ctx: CanvasRenderingContext2D,
  pops: readonly CopyPopMoment[],
  reducedMotion: boolean,
): void {
  for (const { point, radius, progress: t } of pops) {
    ctx.save();
    ctx.strokeStyle = theme.copyEdge;
    ctx.lineWidth = theme.copyPopWidth;
    for (let ring = 0; ring < theme.copyPopRings; ring++) {
      // Each ring a little behind the last, so the burst ripples.
      const lag = ring * 0.18;
      const own = Math.min(1, Math.max(0, (t - lag) / (1 - lag)));
      if (own <= 0 || own >= 1) continue;
      const out = reducedMotion ? 0.5 : 1 - (1 - own) * (1 - own);
      ctx.globalAlpha = (1 - own) * (1 - ring * 0.25);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 0.6 + theme.copyPopReach * out, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
