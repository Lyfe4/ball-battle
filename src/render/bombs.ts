// The Bomber's bombs and their blasts (ADR 0043). A bomb is a zone with a trigger: drawn as a dark
// body ringed in its owner's colour, with a fuse arc around it that burns down to the blast and a
// faint dashed circle for the blast's reach, dim until it arms. Reads state only.
import type { Strike } from './effects.ts';
import { strikeProgress } from './zone-geometry.ts';
import { theme } from './theme.ts';
import type { ZoneState } from '../sim/types.ts';

/** One bomb lying on the floor, under the balls like every zone. */
export function drawBomb(
  ctx: CanvasRenderingContext2D,
  zone: ZoneState,
  color: string,
  tick: number,
): void {
  const body = zone.trigger?.radius ?? 0;
  const armed = zone.trigger === undefined || tick >= zone.trigger.armTick;
  const { x, y } = zone.position;
  const fuseLeft = 1 - strikeProgress(zone, tick);
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = theme.bombAreaAlpha;
  ctx.beginPath();
  ctx.arc(x, y, zone.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = theme.bombReachAlpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = theme.bombRingWidth;
  ctx.setLineDash([...theme.bombReachDash]);
  ctx.beginPath();
  ctx.arc(x, y, zone.radius - theme.bombRingWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = armed ? 1 : theme.bombUnarmedAlpha;
  ctx.fillStyle = theme.bombBody;
  ctx.beginPath();
  ctx.arc(x, y, body, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = theme.bombRingWidth;
  ctx.stroke();
  // The fuse: an arc that shrinks clockwise from the top as the blast nears.
  ctx.strokeStyle = theme.bombFuse;
  ctx.lineWidth = theme.bombFuseWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const start = -Math.PI / 2;
  ctx.arc(x, y, body + theme.bombFuseWidth, start, start + Math.PI * 2 * fuseLeft);
  ctx.stroke();
  ctx.restore();
}

/** A bomb going off: a warm flash over its reach, and a ring sweeping out to its edge. */
export function drawBlast(
  ctx: CanvasRenderingContext2D,
  { position, radius, strength }: Strike,
): void {
  const ring = radius * (0.3 + 0.7 * (1 - strength)) - theme.blastRingWidth / 2;
  ctx.save();
  ctx.globalAlpha = strength * theme.blastFlashMaxAlpha;
  ctx.fillStyle = theme.blastFlash;
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = strength;
  ctx.strokeStyle = theme.blastRing;
  ctx.lineWidth = theme.blastRingWidth;
  ctx.beginPath();
  ctx.arc(position.x, position.y, Math.max(0, ring), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
