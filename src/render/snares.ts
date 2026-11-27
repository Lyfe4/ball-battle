// The Hunter's snares (prototype): a zone with a trigger that holds. Drawn as a small jaw trap on the
// floor in its owner's colour: a ring with teeth pointing in, faint until it arms. Reads state only.
import { theme } from './theme.ts';
import type { ZoneState } from '../sim/types.ts';

const TEETH = 6;

/** True for a snare: a zone that can be set off and holds what it catches. */
export function isSnare(zone: ZoneState): boolean {
  return zone.trigger !== undefined && zone.status?.kind === 'held';
}

/** One snare lying on the floor, under the balls like every zone. */
export function drawSnare(
  ctx: CanvasRenderingContext2D,
  zone: ZoneState,
  color: string,
  tick: number,
): void {
  const body = zone.trigger?.radius ?? zone.radius;
  const armed = zone.trigger === undefined || tick >= zone.trigger.armTick;
  const { x, y } = zone.position;
  ctx.save();
  ctx.globalAlpha = armed ? 1 : theme.bombUnarmedAlpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = theme.bombRingWidth;
  ctx.beginPath();
  ctx.arc(x, y, body, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < TEETH; i += 1) {
    const angle = (i * 2 * Math.PI) / TEETH;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const half = body * 0.22;
    ctx.moveTo(x + dx * body - dy * half, y + dy * body + dx * half);
    ctx.lineTo(x + dx * body * 0.45, y + dy * body * 0.45);
    ctx.lineTo(x + dx * body + dy * half, y + dy * body - dx * half);
  }
  ctx.fill();
  ctx.restore();
}
