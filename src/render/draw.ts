import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { theme } from './theme.ts';

/**
 * Draws one frame. Reads the world and never writes to it. Everything is drawn in world units
 * under a single scale transform, so the picture is identical at any canvas size.
 */
export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
  canvasPixels: number,
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
    drawBall(ctx, ball.position.x, ball.position.y, ball.radius, color);
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
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = theme.ballOutline;
  ctx.lineWidth = theme.ballOutlineWidth;
  ctx.stroke();
}
