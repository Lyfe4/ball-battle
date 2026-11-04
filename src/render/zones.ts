import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { ownerColor } from './ball-colors.ts';
import { BALL_DESIGNS } from './ball-designs/index.ts';
import { boltPoints, strikeProgress } from './zone-geometry.ts';
import type { Strike } from './effects.ts';
import { theme } from './theme.ts';

/**
 * Pending zones, drawn under the balls so they never hide one. Each is a faint area in its
 * owner's colour with an inner disk that fills to the edge as the strike approaches, so viewers
 * can read when it will hit, and an outline that pulses with the sim tick. Reads state only.
 */
export function drawZones(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
): void {
  const pulse = 0.5 + 0.5 * Math.cos((world.tick * 2 * Math.PI) / theme.zonePulsePeriodTicks);
  for (const zone of world.zones) {
    const { x, y } = zone.position;
    const color = ownerColor(world.balls, definitions, zone.ownerId);
    const progress = strikeProgress(zone, world.tick);
    ctx.save();
    ctx.fillStyle = color;

    ctx.globalAlpha = theme.zoneAreaAlpha;
    ctx.beginPath();
    ctx.arc(x, y, zone.radius, 0, Math.PI * 2);
    ctx.fill();

    if (progress > 0) {
      ctx.globalAlpha = theme.zoneFillAlpha;
      ctx.beginPath();
      ctx.arc(x, y, zone.radius * progress, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha =
      theme.zonePulseMinAlpha + (theme.zonePulseMaxAlpha - theme.zonePulseMinAlpha) * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = theme.zoneOutlineWidth;
    ctx.beginPath();
    ctx.arc(x, y, zone.radius - theme.zoneOutlineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** A clean ring that sweeps out from part-way to the zone's edge as it fades. */
function drawShockwave(
  ctx: CanvasRenderingContext2D,
  position: Strike['position'],
  radius: number,
  strength: number,
): void {
  const start = theme.shockwaveStart;
  const ring = radius * (start + (1 - start) * (1 - strength)) - theme.shockwaveWidth / 2;
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.strokeStyle = theme.shockwaveRing;
  ctx.lineWidth = theme.shockwaveWidth;
  ctx.beginPath();
  ctx.arc(position.x, position.y, Math.max(0, ring), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Zones that just struck, in the style of their owner's design: by default a fading flash over the
 * area and a lightning bolt down to its centre; a shockwave is a clean ring sweeping out to the
 * zone's edge.
 */
export function drawStrikes(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  strikes: readonly Strike[],
): void {
  for (const { zoneId, ownerId, position, radius, strength } of strikes) {
    const owner = world.balls.find((ball) => ball.id === ownerId);
    const style = owner === undefined ? undefined : BALL_DESIGNS.get(owner.definitionId)?.strike;
    if (style === 'shockwave') {
      drawShockwave(ctx, position, radius, strength);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = strength * theme.strikeFlashMaxAlpha;
    ctx.fillStyle = theme.strikeFlash;
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
    ctx.fill();

    const points = boltPoints(zoneId, position);
    ctx.globalAlpha = strength;
    ctx.strokeStyle = theme.boltColor;
    ctx.lineWidth = theme.boltWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  }
}
