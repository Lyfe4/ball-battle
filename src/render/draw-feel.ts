// Drawing for battle feel (ADR 0007): squash and intro transforms, the health bar's ghost,
// particles, knockout shards and the winner's ring. Reads state and effect values only.
import type { BallState, DefinitionLookup, WorldState } from '../sim/types.ts';
import { ballColor, isRepeatOfEarlierBall } from './ball-colors.ts';
import type { Knockout, Squash, WinnerRing } from './effects.ts';
import { healthBarRect, healthColor } from './health-bar.ts';
import { shardAt, shardPieces, type Dot } from './particles.ts';
import { theme } from './theme.ts';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Runs `draw` with the ball squashed along its impact normal and scaled and faded for the intro,
 * both around the ball's centre. Health bars are drawn outside this, so they never squash.
 */
export function withBallTransform(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  squash: Squash | undefined,
  intro: { readonly scale: number; readonly alpha: number },
  draw: () => void,
): void {
  if (squash === undefined && intro.scale === 1 && intro.alpha === 1) {
    draw();
    return;
  }
  ctx.save();
  ctx.globalAlpha *= intro.alpha;
  ctx.translate(ball.position.x, ball.position.y);
  ctx.scale(intro.scale, intro.scale);
  if (squash !== undefined) {
    const angle = Math.atan2(squash.normal.y, squash.normal.x);
    ctx.rotate(angle);
    ctx.scale(squash.along, squash.across);
    ctx.rotate(-angle);
  }
  ctx.translate(-ball.position.x, -ball.position.y);
  draw();
  ctx.restore();
}

/**
 * A ball's health bar: the track, a light "ghost" segment for health just lost, and the current
 * health on top. The ghost holds briefly after a hit, then drains down to the new health.
 */
export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  fraction: number,
  ghostFraction: number,
  arenaSize: number,
): void {
  const rect = healthBarRect(ball, arenaSize);
  const health = clamp01(fraction);
  const ghost = clamp01(ghostFraction);
  ctx.fillStyle = theme.healthTrack;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  if (ghost > health) {
    ctx.fillStyle = theme.healthGhost;
    ctx.fillRect(rect.x, rect.y, rect.width * ghost, rect.height);
  }
  ctx.fillStyle = healthColor(fraction);
  ctx.fillRect(rect.x, rect.y, rect.width * health, rect.height);
}

/** Impact particles: small dots that fly out and fade. */
export function drawParticles(ctx: CanvasRenderingContext2D, dots: readonly Dot[]): void {
  if (dots.length === 0) return;
  ctx.save();
  ctx.fillStyle = theme.particleColor;
  for (const { position, radius, alpha } of dots) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Knocked-out balls breaking into wedges in their own colour, flying apart and fading. */
export function drawKnockouts(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
  knockouts: readonly Knockout[],
): void {
  for (const { ballId, elapsedMs, seed } of knockouts) {
    const index = world.balls.findIndex((ball) => ball.id === ballId);
    const ball = world.balls[index];
    if (ball === undefined) continue;
    const base = definitions.get(ball.definitionId)?.color ?? theme.unknownBall;
    ctx.save();
    ctx.fillStyle = ballColor(base, isRepeatOfEarlierBall(world.balls, index));
    ctx.strokeStyle = theme.ballOutline;
    ctx.lineWidth = theme.ballOutlineWidth;
    for (const piece of shardPieces(seed)) {
      const shard = shardAt(piece, ball.position, ball.radius, 0, elapsedMs);
      if (shard === undefined) continue;
      ctx.globalAlpha = shard.alpha;
      ctx.beginPath();
      shard.points.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** The winner's ring, growing out from its edge and fading with each pulse. */
export function drawWinnerRing(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  ring: WinnerRing | undefined,
): void {
  if (ring === undefined) return;
  const ball = world.balls.find((candidate) => candidate.id === ring.ballId);
  if (ball === undefined) return;
  ctx.save();
  ctx.globalAlpha = ring.alpha;
  ctx.strokeStyle = theme.winnerRing;
  ctx.lineWidth = theme.winnerRingWidth;
  ctx.beginPath();
  ctx.arc(
    ball.position.x,
    ball.position.y,
    ball.radius + theme.winnerRingWidth + ring.growth,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}
