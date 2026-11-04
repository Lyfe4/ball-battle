import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { ballColor, isRepeatOfEarlierBall } from './ball-colors.ts';
import type { Spark } from './effects.ts';
import { theme } from './theme.ts';

/** Arrows and other projectiles: a short streak behind a round head, in the owner's colour. */
export function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
): void {
  for (const projectile of world.projectiles) {
    const ownerIndex = world.balls.findIndex((ball) => ball.id === projectile.ownerId);
    const owner = world.balls[ownerIndex];
    const base = owner === undefined ? undefined : definitions.get(owner.definitionId)?.color;
    const color = ballColor(
      base ?? theme.unknownBall,
      isRepeatOfEarlierBall(world.balls, ownerIndex),
    );

    const { x, y } = projectile.position;
    const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
    if (speed > 0) {
      const back = theme.projectileTrail / speed;
      ctx.beginPath();
      ctx.moveTo(x - projectile.velocity.x * back, y - projectile.velocity.y * back);
      ctx.lineTo(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = theme.projectileTrailWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, projectile.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/** A burst of short rays at each recent hit, growing and fading as its strength falls. */
export function drawSparks(ctx: CanvasRenderingContext2D, sparks: readonly Spark[]): void {
  ctx.save();
  ctx.strokeStyle = theme.sparkColor;
  ctx.lineWidth = theme.sparkWidth;
  ctx.lineCap = 'round';
  for (const { point, strength } of sparks) {
    // Rays start a third of the way out and grow to full length as the spark fades.
    const reach =
      theme.sparkInner + (theme.sparkOuter - theme.sparkInner) * (0.35 + 0.65 * (1 - strength));
    ctx.globalAlpha = strength;
    for (let i = 0; i < theme.sparkRays; i++) {
      const angle = (i / theme.sparkRays) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(point.x + cos * theme.sparkInner, point.y + sin * theme.sparkInner);
      ctx.lineTo(point.x + cos * reach, point.y + sin * reach);
      ctx.stroke();
    }
  }
  ctx.restore();
}
