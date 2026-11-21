// A Jouster's bump as it lands (ADR 0077), drawn over everything: head-on, the lance shatters into
// splinters thrown out round the point and a big ×3 pops up over it (the hit-stop is impact.ts's);
// at a glance, only a few small sparks skid off sideways. With reduced motion nothing flies or
// grows: the splinters and sparks fade where they start and the ×3 fades in place.
import type { Vec2 } from '../sim/types.ts';
import type { LanceMoment } from './moments.ts';
import { theme } from './theme.ts';

/** Eases out: fast at first, settling at the end. */
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

/** The arena's one family (ADR 0032), for the ×3. */
const FONT_FAMILY = "'Bricolage Grotesque Variable', system-ui, sans-serif";

function splinters(
  ctx: CanvasRenderingContext2D,
  point: Vec2,
  way: Vec2,
  t: number,
  still: boolean,
) {
  const fly = still ? 0.15 : easeOut(t);
  const base = Math.atan2(way.y, way.x);
  ctx.strokeStyle = theme.splinter;
  ctx.lineWidth = theme.splinterWidth;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1 - t * t;
  ctx.beginPath();
  for (let index = 0; index < theme.splinters; index++) {
    // Round the point, a little more of them thrown back the way the lance came.
    const angle = base + Math.PI + ((index / theme.splinters) * 2 - 1) * Math.PI * 0.85;
    const reach = theme.splinterReach * fly * (0.7 + (0.3 * ((index * 5) % 3)) / 2);
    const turn = angle + (still ? 0 : t * (index % 2 === 0 ? 2 : -2));
    const x = point.x + Math.cos(angle) * reach;
    const y = point.y + Math.sin(angle) * reach;
    const half = theme.splinterLength / 2;
    ctx.moveTo(x - Math.cos(turn) * half, y - Math.sin(turn) * half);
    ctx.lineTo(x + Math.cos(turn) * half, y + Math.sin(turn) * half);
  }
  ctx.stroke();
}

function times(ctx: CanvasRenderingContext2D, point: Vec2, t: number, still: boolean) {
  const grow = still ? 1 : 1 + 0.4 * Math.max(0, 1 - t / 0.25);
  const rise = still ? 0 : theme.lanceTimesRise * easeOut(t);
  const size = theme.lanceTimesSize * grow;
  ctx.globalAlpha = t < 0.6 ? 1 : (1 - t) / 0.4;
  ctx.font = `800 ${String(Math.round(size))}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = theme.lanceTimesEdge;
  ctx.fillStyle = theme.lanceTimesFill;
  const y = point.y - theme.lanceTimesSize * 0.9 - rise;
  ctx.strokeText(theme.lanceTimesText, point.x, y);
  ctx.fillText(theme.lanceTimesText, point.x, y);
}

function sparks(ctx: CanvasRenderingContext2D, point: Vec2, way: Vec2, t: number, still: boolean) {
  const fly = still ? 0.2 : easeOut(t);
  ctx.strokeStyle = theme.glanceSpark;
  ctx.lineWidth = theme.splinterWidth * 0.6;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1 - t;
  ctx.beginPath();
  for (let index = 0; index < theme.glanceSparks; index++) {
    // Skidding off to either side of the lance's line.
    const side = index % 2 === 0 ? 1 : -1;
    const angle = Math.atan2(way.y, way.x) + side * (1.1 + 0.25 * Math.floor(index / 2));
    const from = theme.glanceSparkReach * fly;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    ctx.moveTo(point.x + ux * from, point.y + uy * from);
    ctx.lineTo(
      point.x + ux * (from + theme.glanceSparkLength),
      point.y + uy * (from + theme.glanceSparkLength),
    );
  }
  ctx.stroke();
}

/** Every lance hit being shown, over the balls. */
export function drawLanceHits(
  ctx: CanvasRenderingContext2D,
  hits: readonly LanceMoment[],
  reducedMotion: boolean,
): void {
  for (const { point, way, headOn, progress } of hits) {
    ctx.save();
    if (headOn) {
      splinters(ctx, point, way, progress, reducedMotion);
      times(ctx, point, progress, reducedMotion);
    } else {
      sparks(ctx, point, way, progress, reducedMotion);
    }
    ctx.restore();
  }
}
