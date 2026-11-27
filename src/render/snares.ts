// The Hunter's snares (ADR 0091): a zone with a trigger that holds. Each lies on the floor as the
// Hunter's own jaw trap, set, in its owner's colour, faint until it arms; a ball a snare holds has the
// trap clamped round it, snapping in over its first few ticks. Reads state only.
import type { BallState, DefinitionLookup, WorldState, ZoneState } from '../sim/types.ts';
import { clampGap, drawJawTrap } from './ball-designs/jaw-trap.ts';
import { ownerColor } from './ball-colors.ts';
import { theme } from './theme.ts';

/** True for a snare: a zone that can be set off and holds what it catches. */
export function isSnare(zone: ZoneState): boolean {
  return zone.trigger !== undefined && zone.status?.kind === 'held';
}

/** One snare lying on the floor, under the balls like every zone: a set trap the size of its trap. */
export function drawSnare(
  ctx: CanvasRenderingContext2D,
  zone: ZoneState,
  color: string,
  tick: number,
): void {
  const reach = zone.trigger?.radius ?? zone.radius;
  const armed = zone.trigger === undefined || tick >= zone.trigger.armTick;
  ctx.save();
  ctx.globalAlpha = armed ? 1 : theme.bombUnarmedAlpha;
  ctx.translate(zone.position.x, zone.position.y);
  drawJawTrap(ctx, reach, 1, color, theme.ballOutline);
  ctx.restore();
}

/**
 * The trap clamped round every ball a Hunter's snare holds (a hold from a ball whose zones are
 * snares; the Kraken's holds show its tentacles, tentacles.ts). Drawn over the balls.
 */
export function drawSnared(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
): void {
  for (const ball of world.balls) {
    const held = heldBySnare(ball, world);
    if (held === undefined) continue;
    const reach = ball.radius + clampGap(world.tick - held.sinceTick);
    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);
    drawJawTrap(
      ctx,
      reach,
      1,
      ownerColor(world.balls, definitions, held.sourceId),
      theme.ballOutline,
    );
    ctx.restore();
  }
}

/** The hold on `ball` when a Hunter's snare gave it, else undefined. */
function heldBySnare(
  ball: BallState,
  world: WorldState,
): { readonly sourceId: string; readonly sinceTick: number } | undefined {
  const status = ball.statuses.find((candidate) => candidate.kind === 'held');
  if (ball.health <= 0 || status === undefined) return undefined;
  const source = world.balls.find((candidate) => candidate.id === status.sourceId);
  return source?.definitionId === 'hunter' ? status : undefined;
}
