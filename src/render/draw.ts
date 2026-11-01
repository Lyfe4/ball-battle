import type { BallState, DefinitionLookup, WorldState } from '../sim/types.ts';
import { healthBarRect, healthColor } from './health-bar.ts';
import { theme } from './theme.ts';

/** Render-only inputs that are not sim state, such as effect strengths. */
export interface FrameEffects {
  /** Damage flash strength for a ball, 0 to 1. */
  readonly flash: (ballId: string) => number;
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
  for (const ball of world.balls) {
    const color = definitions.get(ball.definitionId)?.color ?? theme.unknownBall;
    drawBall(ctx, ball, color, effects.flash(ball.id));
  }
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
