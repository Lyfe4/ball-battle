// The Hunter's snares (ADR 0091): a zone with a trigger that holds. Each lies on the floor as the
// Hunter's own jaw trap, set, in its owner's colour, faint until it arms; a ball a snare holds has the
// trap clamped round it, snapping in over its first few ticks. Reads state only.
import type { BallState, DefinitionLookup, WorldState, ZoneState } from '../sim/types.ts';
import { clampGap, drawJawTrap } from './ball-designs/jaw-trap.ts';
import type { Strike } from './effects.ts';
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

/** The dust's directions: fixed, a little uneven, so no two bits fly alike. */
const DUST: readonly (readonly [number, number, number])[] = Array.from({ length: 12 }, (_, k) => {
  const angle = (k / 12) * Math.PI * 2 + (k % 3) * 0.35;
  return [Math.cos(angle), Math.sin(angle), 0.75 + ((k * 7) % 5) * 0.08];
});

/**
 * A snare springing where it lay (a strike, ADR 0091): the Hunter's trap snapping shut, a short
 * side-to-side shake, and dust and splinters thrown out in the pelt's leather browns, fading over
 * the strike. A trap, not a strike from the sky: never the Storm's flash and bolt. With reduced
 * motion the trap shuts and fades in place, the dust a still ring that fades.
 */
export function drawTrapSnap(
  ctx: CanvasRenderingContext2D,
  { position, radius, strength }: Strike,
  color: string,
  reducedMotion: boolean,
): void {
  const reach = radius * theme.trapSnapReach;
  const t = 1 - strength;
  const open = Math.max(0, 1 - t / theme.trapSnapShut);
  // The shake: a quick to and fro after the jaws meet, dying away by half the strike.
  const shaking = !reducedMotion && open === 0 && t < 0.5;
  const swing = Math.round(t * 24) % 2 === 0 ? 1 : -1;
  const shake = shaking ? swing * theme.trapShake * reach * (1 - t / 0.5) : 0;
  ctx.save();
  ctx.translate(position.x + shake, position.y);
  // A puff of dust round the trap, spreading and thinning; then the bits, out from its edge.
  const travel = reducedMotion ? 0.5 : t;
  ctx.globalAlpha = strength * theme.trapPuffAlpha;
  ctx.fillStyle = theme.hunterPelt;
  ctx.beginPath();
  ctx.arc(0, 0, reach * (1.1 + 0.6 * travel), 0, Math.PI * 2);
  ctx.fill();
  const count = Math.min(theme.trapDustCount, DUST.length);
  for (let k = 0; k < count; k++) {
    const [dx, dy, spread] = DUST[k] ?? [0, 0, 1];
    const out = reach * (0.7 + (theme.trapDustReach - 0.7) * travel * spread);
    ctx.globalAlpha = strength * 0.9;
    ctx.fillStyle = k % 2 === 0 ? theme.hunterPelt : theme.hunterInnerEar;
    ctx.beginPath();
    if (k % 3 === 0) {
      // A splinter: a short sliver along its way out.
      ctx.save();
      ctx.translate(dx * out, dy * out);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillRect(-reach * 0.18, -reach * 0.04, reach * 0.36, reach * 0.08);
      ctx.restore();
    } else {
      ctx.arc(dx * out, dy * out, reach * theme.trapDustSize * (1 - 0.4 * t), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = Math.min(1, strength * 1.6);
  drawJawTrap(ctx, reach, open, color, theme.ballOutline);
  ctx.restore();
}
