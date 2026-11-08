// Drawing for battle feel (ADR 0007): squash and intro transforms, the health bar's ghost,
// particles, knockout shards and the winner's ring. Reads state and effect values only.
import { hasStatus } from '../sim/status.ts';
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
  // A chunky pill (ADR 0032): the dark track, then the ghost and the fill inset inside it. A pill
  // narrower than its own height would bulge, so a sliver of health is drawn at that width.
  const pill = (x: number, y: number, width: number, height: number): void => {
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(width, height), height, height / 2);
    ctx.fill();
  };
  ctx.fillStyle = theme.healthTrack;
  pill(rect.x, rect.y, rect.width, rect.height);
  const inset = theme.healthBarInset;
  const inner = { x: rect.x + inset, y: rect.y + inset, width: rect.width - inset * 2 };
  const innerHeight = rect.height - inset * 2;
  if (ghost > health) {
    ctx.fillStyle = theme.healthGhost;
    pill(inner.x, inner.y, inner.width * ghost, innerHeight);
  }
  if (health > 0) {
    ctx.fillStyle = healthColor(fraction);
    pill(inner.x, inner.y, inner.width * health, innerHeight);
  }
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

/**
 * Status effects on a ball (ADR 0009, 0012), read from its state, as thin rings just outside the
 * edge, one per status, each further out than the last; all hold still:
 * - slowed: solid, pale ice, with short frost ticks pointing outwards;
 * - poisoned: a ring of round pale-lime dots, like drops.
 */
export function drawStatuses(ctx: CanvasRenderingContext2D, ball: BallState): void {
  let radius = ball.radius + theme.statusRingGap;
  if (hasStatus(ball, 'slowed')) {
    drawSlowRing(ctx, ball, radius);
    radius += theme.statusRingSpacing;
  }
  if (hasStatus(ball, 'poisoned')) drawPoisonRing(ctx, ball, radius);
}

function drawSlowRing(ctx: CanvasRenderingContext2D, ball: BallState, radius: number): void {
  const { x, y } = ball.position;
  ctx.save();
  ctx.globalAlpha = theme.slowRingAlpha;
  ctx.strokeStyle = theme.slowRing;
  ctx.lineWidth = theme.slowRingWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  for (let index = 0; index < theme.slowTicks; index++) {
    const angle = (index / theme.slowTicks) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    ctx.moveTo(x + dx * radius, y + dy * radius);
    ctx.lineTo(x + dx * (radius + theme.slowTickLength), y + dy * (radius + theme.slowTickLength));
  }
  ctx.stroke();
  ctx.restore();
}

function drawPoisonRing(ctx: CanvasRenderingContext2D, ball: BallState, radius: number): void {
  ctx.save();
  ctx.globalAlpha = theme.poisonRingAlpha;
  ctx.strokeStyle = theme.poisonRing;
  ctx.lineWidth = theme.poisonRingWidth;
  // Zero-length dashes with round caps are dots. The gap is stretched so the dots space evenly.
  const circumference = Math.PI * 2 * radius;
  const dots = Math.max(1, Math.round(circumference / theme.poisonDotGap));
  ctx.lineCap = 'round';
  ctx.setLineDash([0, circumference / dots]);
  ctx.beginPath();
  ctx.arc(ball.position.x, ball.position.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
