import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { ownerColor } from './ball-colors.ts';
import { BALL_DESIGNS } from './ball-designs/index.ts';
import { boltPoints, burnLook, strikeProgress } from './zone-geometry.ts';
import type { Strike } from './effects.ts';
import { drawBlast, drawBomb } from './bombs.ts';
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
    if (zone.endTick !== undefined) {
      drawBurn(ctx, zone, world.tick);
      continue;
    }
    if (zone.trigger !== undefined) {
      drawBomb(ctx, zone, ownerColor(world.balls, definitions, zone.ownerId), world.tick);
      continue;
    }
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

/**
 * A lasting zone, the Inferno's burning patch (ADR 0034): a small ember growing while it catches,
 * then a warm disc that flares on every burn and fades as it burns out. Under the balls, like every
 * zone.
 */
function drawBurn(
  ctx: CanvasRenderingContext2D,
  zone: WorldState['zones'][number],
  tick: number,
): void {
  const { caught, life, glow } = burnLook(zone, tick, theme.burnPulseTicks);
  const { x, y } = zone.position;
  ctx.save();
  ctx.fillStyle = theme.burnFill;
  if (caught < 1) {
    ctx.globalAlpha = theme.burnAlpha * caught;
    ctx.beginPath();
    ctx.arc(x, y, zone.radius * 0.4 * caught, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const fade = 0.5 + 0.5 * life;
  ctx.globalAlpha = (theme.burnAlpha + (theme.burnPulseAlpha - theme.burnAlpha) * glow) * fade;
  ctx.beginPath();
  ctx.arc(x, y, zone.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = fade;
  ctx.strokeStyle = theme.burnEdge;
  ctx.lineWidth = theme.burnEdgeWidth;
  ctx.beginPath();
  ctx.arc(x, y, zone.radius - theme.burnEdgeWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
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
  for (const strike of strikes) {
    const { zoneId, ownerId, position, radius, strength } = strike;
    const owner = world.balls.find((ball) => ball.id === ownerId);
    const style = owner === undefined ? undefined : BALL_DESIGNS.get(owner.definitionId)?.strike;
    if (style === 'blast') {
      drawBlast(ctx, strike);
      continue;
    }
    if (style === 'shockwave') {
      drawShockwave(ctx, position, radius, strength);
      continue;
    }
    // A burning patch shows its burns itself (drawBurn): no flash or bolt.
    if (style === 'burn') continue;
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
