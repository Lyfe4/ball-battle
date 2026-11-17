// Draws the moments tracked in moments.ts (ADR 0060). With reduced motion nothing flies: the split's
// bridge and the snapped web just fade where they are.
import type { WorldState } from '../sim/types.ts';
import type { SnapMoment, SplitMoment } from './moments.ts';
import { theme } from './theme.ts';
import { webFrame, webPath } from './webs.ts';

/** Eases out: fast at first, settling at the end. */
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

/**
 * A split, under the balls: a band of jelly joining the two halves that thins and breaks
 * (the stretch), then a ring of droplets thrown from where it broke (the pop).
 */
export function drawSplits(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  splits: readonly SplitMoment[],
  colorOf: (ballId: string) => string,
  reducedMotion: boolean,
): void {
  for (const split of splits) {
    const a = world.balls.find((ball) => ball.id === split.ballId);
    const b = world.balls.find((ball) => ball.id === split.newBallId);
    if (a === undefined || b === undefined) continue;
    const t = split.progress;
    const color = colorOf(split.ballId);
    const mid = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    // The stretch: thick at first, gone by the time the pop is halfway.
    const band = Math.max(0, 1 - t / theme.splitStretchShare);
    if (band > 0) {
      ctx.globalAlpha = reducedMotion ? band : 1;
      ctx.lineWidth = Math.min(a.radius, b.radius) * 1.6 * (reducedMotion ? 1 : band);
      ctx.beginPath();
      ctx.moveTo(a.position.x, a.position.y);
      ctx.lineTo(b.position.x, b.position.y);
      ctx.stroke();
    }
    if (!reducedMotion && t > theme.splitStretchShare * 0.6) {
      // The pop: droplets thrown out from the middle, shrinking as they go.
      const pop = (t - theme.splitStretchShare * 0.6) / (1 - theme.splitStretchShare * 0.6);
      const reach = theme.splitDropletReach * easeOut(pop);
      ctx.globalAlpha = 1 - pop;
      for (let i = 0; i < theme.splitDroplets; i++) {
        const angle = (i / theme.splitDroplets) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.arc(
          mid.x + Math.cos(angle) * reach,
          mid.y + Math.sin(angle) * reach,
          theme.splitDropletRadius * (1 - pop * 0.6),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/**
 * A snapped web, where it was: its two halves flash bright (the twang), then spring apart along
 * the wall and fade.
 */
export function drawSnaps(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  snaps: readonly SnapMoment[],
  reducedMotion: boolean,
): void {
  const half = Math.floor(theme.webSpokes / 2);
  for (const { web, progress: t } of snaps) {
    const frame = webFrame(web, world.arena.size);
    const fly = reducedMotion ? 0 : easeOut(t);
    ctx.save();
    ctx.translate(frame.x, frame.y);
    ctx.rotate(frame.angle);
    for (const [from, to, way] of [
      [0, half, 1],
      [half, theme.webSpokes, -1],
    ] as const) {
      ctx.save();
      // The twang: bright silk at first, then the web's own, fading.
      const twang = t < theme.webSnapTwangShare;
      ctx.globalAlpha = twang ? 1 : theme.webAlpha * (1 - t);
      ctx.translate(way * theme.webSnapSpring * fly, 0);
      ctx.rotate(-way * theme.webSnapTurn * fly);
      webPath(ctx, from, to);
      if (twang) ctx.strokeStyle = theme.highlight;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}
