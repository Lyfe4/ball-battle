// The Banshee's wail on the court (ADR 0075): a pale glow swelling round it as it draws breath,
// then the wail's ring sweeping out to its reach (WAIL_RADIUS, from its centre: any ball the ring
// touches is hit) and dying away. Under the balls, like a zone. Reads sim state only, so it moves
// only as the sim's clock does; with reduced motion the ring appears at its reach and fades there.
import { WAIL_RADIUS } from '../sim/balls/banshee.ts';
import type { WorldState } from '../sim/types.ts';
import { wailMomentOf } from './ball-designs/banshee.ts';
import { theme } from './theme.ts';

/** Eases out: fast at first, settling at the end. */
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

/** Every live Banshee's breath and wail. Drawn under the balls. */
export function drawWails(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  reducedMotion: boolean,
): void {
  for (const ball of world.balls) {
    if (ball.health <= 0) continue;
    const moment = wailMomentOf(ball, world.tick);
    if (moment === undefined) continue;
    const { x, y } = ball.position;
    ctx.save();
    ctx.fillStyle = theme.bansheeWail;
    if (moment.breath > 0) {
      ctx.globalAlpha = theme.bansheeBreathAlpha * moment.breath;
      ctx.beginPath();
      ctx.arc(x, y, ball.radius * (1 + theme.bansheeBreathGrowth * moment.breath), 0, Math.PI * 2);
      ctx.fill();
    }
    if (moment.wail > 0) {
      // The sweep takes the first share of the wail's time; the rest it fades at full reach.
      const spent = 1 - moment.wail;
      const out = reducedMotion ? 1 : easeOut(Math.min(1, spent / theme.bansheeSweepShare));
      const radius = ball.radius + (WAIL_RADIUS - ball.radius) * out;
      ctx.strokeStyle = theme.bansheeWail;
      ctx.globalAlpha = moment.wail;
      ctx.lineWidth = theme.bansheeRingWidth;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = moment.wail * theme.bansheeEchoAlpha;
      ctx.lineWidth = theme.bansheeRingWidth / 2;
      ctx.beginPath();
      ctx.arc(x, y, radius * theme.bansheeEchoShare, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
