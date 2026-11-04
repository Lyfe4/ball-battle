import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { ownerColor } from './ball-colors.ts';
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

/** Zones that just struck: a fading flash over the area and a lightning bolt down to its centre. */
export function drawStrikes(ctx: CanvasRenderingContext2D, strikes: readonly Strike[]): void {
  for (const { zoneId, position, radius, strength } of strikes) {
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
    ctx.shadowColor = theme.boltGlow;
    ctx.shadowBlur = theme.boltGlowBlur;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  }
}
