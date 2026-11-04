import type { BallState, DefinitionLookup, WorldState } from '../sim/types.ts';
import { ABILITY_OVERLAYS } from './ability-overlays.ts';
import { ballColor, isRepeatOfEarlierBall } from './ball-colors.ts';
import { healthBarRect, healthColor } from './health-bar.ts';
import { theme } from './theme.ts';

/** Render-only inputs that are not sim state, such as effect strengths. */
export interface FrameEffects {
  /** Damage flash strength for a ball, 0 to 1. */
  readonly flash: (ballId: string) => number;
  /** Heal pulse strength for a ball, 0 to 1. */
  readonly heal: (ballId: string) => number;
}

/**
 * Draws one frame. Reads the world and never writes to it. Everything is drawn in world units
 * under a single scale transform, so the picture is identical at any canvas size.
 */
export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
  canvasPixels: number,
  effects: FrameEffects,
): void {
  const { size } = world.arena;
  // The border sits outside the arena so balls touching a wall touch the border, not overlap it.
  const border = theme.arenaBorderWidth;
  const scale = canvasPixels / (size + border * 2);

  // setTransform replaces any previous transform, so frames never accumulate scaling.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasPixels, canvasPixels);
  ctx.setTransform(scale, 0, 0, scale, border * scale, border * scale);

  drawArena(ctx, size);
  world.balls.forEach((ball, index) => {
    const isRepeat = isRepeatOfEarlierBall(world.balls, index);
    const color = ballColor(
      definitions.get(ball.definitionId)?.color ?? theme.unknownBall,
      isRepeat,
    );
    drawBall(ctx, ball, color, effects.flash(ball.id), isRepeat);
    if (ball.health > 0) {
      ABILITY_OVERLAYS.get(ball.definitionId)?.(ctx, ball);
      drawHealPulse(ctx, ball, effects.heal(ball.id));
    }
  });
  // Bars go on top of every ball so a neighbour never hides them.
  for (const ball of world.balls) {
    const maxHealth = definitions.get(ball.definitionId)?.maxHealth;
    if (ball.health > 0 && maxHealth !== undefined) {
      drawHealthBar(ctx, ball, ball.health / maxHealth, size);
    }
  }
}

function drawArena(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = theme.arenaFill;
  ctx.fillRect(0, 0, size, size);

  // Offset by half the line width so the stroke lies entirely outside [0, size].
  const half = theme.arenaBorderWidth / 2;
  ctx.strokeStyle = theme.arenaBorder;
  ctx.lineWidth = theme.arenaBorderWidth;
  ctx.strokeRect(-half, -half, size + theme.arenaBorderWidth, size + theme.arenaBorderWidth);
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  color: string,
  flash: number,
  isRepeat: boolean,
): void {
  const { x, y } = ball.position;
  ctx.save();
  if (ball.health <= 0) ctx.globalAlpha = theme.defeatedAlpha;

  ctx.beginPath();
  ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha *= flash * theme.flashMaxAlpha;
    ctx.fillStyle = theme.flash;
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = theme.ballOutline;
  ctx.lineWidth = theme.ballOutlineWidth;
  ctx.stroke();
  if (isRepeat) {
    // Just inside the edge, so it never overlaps a neighbouring ball or the wall.
    ctx.beginPath();
    ctx.arc(x, y, ball.radius - theme.repeatRingWidth, 0, Math.PI * 2);
    ctx.strokeStyle = theme.repeatRing;
    ctx.lineWidth = theme.repeatRingWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/** A ring that grows outwards and fades as `strength` falls from 1 to 0. */
function drawHealPulse(ctx: CanvasRenderingContext2D, ball: BallState, strength: number): void {
  if (strength <= 0) return;
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.beginPath();
  ctx.arc(
    ball.position.x,
    ball.position.y,
    ball.radius + (1 - strength) * theme.healRingGrowth,
    0,
    Math.PI * 2,
  );
  ctx.strokeStyle = theme.healRing;
  ctx.lineWidth = theme.healRingWidth;
  ctx.stroke();
  ctx.restore();
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  fraction: number,
  arenaSize: number,
): void {
  const rect = healthBarRect(ball, arenaSize);
  ctx.fillStyle = theme.healthTrack;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = healthColor(fraction);
  ctx.fillRect(rect.x, rect.y, rect.width * Math.min(1, Math.max(0, fraction)), rect.height);
}
