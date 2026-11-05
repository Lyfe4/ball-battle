import { isPulling } from '../sim/balls/magnet.ts';
import { nearestEnemy } from '../sim/balls/targeting.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { aimLineOf, laserAlpha } from './aim-line.ts';
import { ownerColor } from './ball-colors.ts';
import type { Spark } from './effects.ts';
import { theme } from './theme.ts';

/** Arrows and other projectiles: a short streak behind a round head, in the owner's colour. */
export function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
): void {
  for (const projectile of world.projectiles) {
    const color = ownerColor(world.balls, definitions, projectile.ownerId);

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

/** Every locked aim in the world, as a thin laser line. Drawn under the balls. */
export function drawAimLines(ctx: CanvasRenderingContext2D, world: WorldState): void {
  for (const ball of world.balls) {
    const line = aimLineOf(ball, world.tick, world.arena.size);
    if (line === undefined) continue;
    ctx.save();
    ctx.globalAlpha = laserAlpha(line.progress);
    ctx.strokeStyle = theme.sniperLaser;
    ctx.lineWidth = theme.laserWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(line.from.x, line.from.y);
    ctx.lineTo(line.to.x, line.to.y);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Every Magnet's pull in progress (ADR 0026), as a dashed line from it to the ball it pulls: the
 * nearest enemy ball, the same one `steer` turns. Drawn under the balls, like the laser.
 */
export function drawPullLines(ctx: CanvasRenderingContext2D, world: WorldState): void {
  for (const ball of world.balls) {
    if (ball.health <= 0 || !isPulling(ball, world.tick)) continue;
    const target = nearestEnemy(ball, world.balls);
    if (target === undefined) continue;
    ctx.save();
    ctx.globalAlpha = theme.magnetPullAlpha;
    ctx.strokeStyle = theme.magnetPullLine;
    ctx.lineWidth = theme.magnetPullWidth;
    ctx.setLineDash([...theme.magnetPullDash]);
    ctx.beginPath();
    ctx.moveTo(ball.position.x, ball.position.y);
    ctx.lineTo(target.position.x, target.position.y);
    ctx.stroke();
    ctx.restore();
  }
}
