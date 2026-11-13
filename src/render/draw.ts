import { ownerColor } from './ball-colors.ts';
import { drawRewinds } from './draw-rewind.ts';
import type { RewindTrail } from './rewind.ts';
import type { BallState, DefinitionLookup, Vec2, WorldState } from '../sim/types.ts';
import { BALL_DESIGNS } from './ball-designs/index.ts';
import { designView, paintDesign } from './ball-designs/paint.ts';
import type { BallDesign } from './ball-designs/types.ts';
import { ballColor, isRepeatOfEarlierBall } from './ball-colors.ts';
import {
  drawHealthBar,
  drawKnockouts,
  drawParticles,
  drawStatuses,
  drawWinnerRing,
  withBallTransform,
} from './draw-feel.ts';
import type { Knockout, Spark, Squash, Strike, WinnerRing } from './effects.ts';
import type { Dot } from './particles.ts';
import { drawHealPulse, drawSourceChip } from './draw-cues.ts';
import type { SourceChip } from './source-chips.ts';
import { drawMinions } from './minions.ts';
import { drawAimLines, drawProjectiles, drawPullLines, drawSparks } from './projectiles.ts';
import { drawGlance } from './glance-ring.ts';
import { theme } from './theme.ts';
import { drawStrikes, drawZones } from './zones.ts';
import { drawCurses } from './curse.ts';
import { drawWebs } from './webs.ts';

/** How big the canvas is: its backing store, and how large it appears on screen. */
export interface CanvasView {
  readonly canvasPixels: number;
  readonly cssPixels: number;
}

/** Render-only inputs that are not sim state, such as effect strengths. */
export interface FrameEffects {
  /** Damage flash strength for a ball, 0 to 1. */
  readonly flash: (ballId: string) => number;
  /** Heal pulse strength for a ball, 0 to 1. */
  readonly heal: (ballId: string) => number;
  /** Health its latest heal restored, which sizes the pulse. */
  readonly healAmount: (ballId: string) => number;
  /** Recent projectile hits. */
  readonly sparks: readonly Spark[];
  /** Zones that just struck. */
  readonly strikes: readonly Strike[];
  /** Screen shake offset, world units. */
  readonly shake: Vec2;
  readonly squash: (ballId: string) => Squash | undefined;
  /** Health the bar's ghost segment reaches down from (equal to health when there is none). */
  readonly ghost: (ballId: string, health: number) => number;
  readonly particles: readonly Dot[];
  /** Balls breaking apart; their bodies are replaced by shards. */
  readonly knockouts: readonly Knockout[];
  readonly winner: WinnerRing | undefined;
  /** Intro scale and opacity for the ball at an index. */
  readonly intro: (index: number) => { readonly scale: number; readonly alpha: number };
  /** A hit just glanced off this ball's defence: 1 down to 0 (ADR 0045). */
  readonly glance: (ballId: string) => number;
  /** Rewinds being shown: the Chrono's trail back and its ghost (ADR 0034). */
  readonly rewinds: readonly RewindTrail[];
  /** Unseen damage just landed: who dealt it, beside the hit ball's bar (ADR 0036). */
  readonly chips: readonly SourceChip[];
  /** Holds animated details (a heal's swelling ring, a glance's shards, the chip's pop) still. */
  readonly reducedMotion: boolean;
}

/** A frame with no effects at all, for static pictures (the style guide). */
export const NO_EFFECTS: FrameEffects = {
  flash: () => 0,
  heal: () => 0,
  healAmount: () => 0,
  sparks: [],
  strikes: [],
  shake: { x: 0, y: 0 },
  squash: () => undefined,
  ghost: (_ballId, health) => health,
  particles: [],
  knockouts: [],
  winner: undefined,
  intro: () => ({ scale: 1, alpha: 1 }),
  glance: () => 0,
  rewinds: [],
  chips: [],
  reducedMotion: false,
};

/**
 * Draws one frame. Reads the world and never writes to it. Everything is drawn in world units
 * under a single scale transform, so the picture is identical at any canvas size.
 */
export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
  view: CanvasView,
  effects: FrameEffects,
): void {
  const { size } = world.arena;
  const { canvasPixels } = view;
  // The border sits outside the arena so balls touching a wall touch the border, not overlap it.
  const border = theme.arenaBorderWidth;
  const scale = canvasPixels / (size + border * 2);
  const cssPixelsPerUnit = view.cssPixels / (size + border * 2);

  // setTransform replaces any previous transform, so frames never accumulate scaling.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasPixels, canvasPixels);
  const { shake } = effects;
  ctx.setTransform(scale, 0, 0, scale, (border + shake.x) * scale, (border + shake.y) * scale);

  drawArena(ctx, size);
  // Pending zones go under the balls, so a warning never hides a ball.
  drawZones(ctx, world, definitions);
  drawWebs(ctx, world);
  drawAimLines(ctx, world);
  drawPullLines(ctx, world);
  drawRewinds(
    ctx,
    effects.rewinds,
    (ballId) => world.balls.find((ball) => ball.id === ballId)?.radius ?? 0,
    (ballId) => ownerColor(world.balls, definitions, ballId),
  );
  const breaking = new Set(effects.knockouts.map(({ ballId }) => ballId));
  world.balls.forEach((ball, index) => {
    if (breaking.has(ball.id)) return;
    const isRepeat = isRepeatOfEarlierBall(world.balls, index);
    const color = ballColor(
      definitions.get(ball.definitionId)?.color ?? theme.unknownBall,
      isRepeat,
    );
    const definition = definitions.get(ball.definitionId);
    const design = BALL_DESIGNS.get(ball.definitionId);
    const heal = effects.heal(ball.id);
    const phased = definition?.phasedOf?.(ball) ?? false;
    withBallTransform(ctx, ball, effects.squash(ball.id), effects.intro(index), () => {
      drawBall(ctx, world, ball, {
        color,
        isRepeat,
        flash: effects.flash(ball.id),
        heal,
        design,
        cssPixelsPerUnit,
        phased,
      });
    });
    if (ball.health > 0) {
      const maxHealth = definition?.maxHealth ?? 1;
      const pulse = { strength: heal, amount: effects.healAmount(ball.id), maxHealth };
      drawHealPulse(ctx, ball, pulse, effects.reducedMotion);
      drawStatuses(ctx, ball);
      drawGlance(ctx, ball, effects.glance(ball.id), effects.reducedMotion);
    }
  });
  drawCurses(ctx, world, effects.reducedMotion);
  drawKnockouts(ctx, world, definitions, effects.knockouts);
  drawWinnerRing(ctx, world, effects.winner);
  drawMinions(ctx, world, definitions, cssPixelsPerUnit);
  drawProjectiles(ctx, world, definitions);
  drawSparks(ctx, effects.sparks);
  drawStrikes(ctx, world, effects.strikes);
  drawParticles(ctx, effects.particles);
  // Bars go on top of every ball so a neighbour never hides them.
  for (const ball of world.balls) {
    const maxHealth = definitions.get(ball.definitionId)?.maxHealth;
    if (ball.health > 0 && maxHealth !== undefined) {
      const ghost = effects.ghost(ball.id, ball.health);
      drawHealthBar(ctx, ball, ball.health / maxHealth, ghost / maxHealth, size);
    }
  }
  // Unseen damage: who dealt it, beside the bar it came off (ADR 0036).
  for (const { targetId, sourceId, strength } of effects.chips) {
    const ball = world.balls.find((candidate) => candidate.id === targetId);
    if (ball === undefined || ball.health <= 0) continue;
    const color = ownerColor(world.balls, definitions, sourceId);
    drawSourceChip(ctx, ball, color, strength, effects.reducedMotion, size);
  }
}

/**
 * The court (ADR 0032): a chunky rounded rim around a plain floor (no centre circle, ADR 0033). The
 * rim lies wholly outside [0, size], so a ball touching a wall touches the rim. Flat fills, no
 * gradients or shadows, so it costs the same on a phone.
 */
function drawArena(ctx: CanvasRenderingContext2D, size: number): void {
  const rim = theme.arenaBorderWidth;
  const corner = theme.arenaCornerRadius;
  ctx.fillStyle = theme.arenaBorder;
  ctx.beginPath();
  ctx.roundRect(-rim, -rim, size + rim * 2, size + rim * 2, corner + rim);
  ctx.fill();

  ctx.fillStyle = theme.arenaFill;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, corner);
  ctx.fill();
}

export interface BallLook {
  /** Base colour as drawn (lighter for a repeat). */
  readonly color: string;
  readonly isRepeat: boolean;
  /** Damage flash strength, 0 to 1. */
  readonly flash: number;
  /** Heal effect strength, 0 to 1. */
  readonly heal: number;
  readonly design: BallDesign | undefined;
  /** How many CSS pixels one world unit covers, to pick the design's detail level. */
  readonly cssPixelsPerUnit: number;
  /** Forces a detail level (the style guide shows both); otherwise chosen by on-screen size. */
  readonly detail?: 'full' | 'simple';
  /** Phased (ADR 0026, 0049): drawn see-through with a broken outline. */
  readonly phased?: boolean;
}

/**
 * One ball: its body, its design's markings, the damage flash, the outline and, for a repeat, a
 * ring just inside the edge. Also used by the dev style guide, so it shows exactly what the game
 * draws.
 */
export function drawBall(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  ball: BallState,
  look: BallLook,
): void {
  const { x, y } = ball.position;
  const { color, flash, isRepeat, design } = look;
  ctx.save();
  if (ball.health <= 0) ctx.globalAlpha = theme.defeatedAlpha;
  else if (look.phased === true) ctx.globalAlpha = theme.phasedAlpha;

  ctx.beginPath();
  ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  const view = design === undefined ? undefined : designView(design, ball, world, look);
  if (design !== undefined && view !== undefined) paintDesign(ctx, view, design.draw);
  // The design leaves its own path behind (paths are not part of save/restore), so the flash and
  // outline rebuild the body's.
  ctx.beginPath();
  ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha *= flash * theme.flashMaxAlpha;
    ctx.fillStyle = theme.flash;
    ctx.fill();
    ctx.restore();
  }
  if (look.phased === true && ball.health > 0) {
    // A broken pale outline, fully opaque, so the see-through ball still has a clear edge.
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.setLineDash([...theme.phasedDash]);
    ctx.strokeStyle = theme.phasedOutline;
    ctx.lineWidth = theme.phasedOutlineWidth;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = theme.ballOutline;
    ctx.lineWidth = theme.ballOutlineWidth;
    ctx.stroke();
  }
  if (isRepeat) {
    // Just inside the edge, so it never overlaps a neighbouring ball or the wall.
    ctx.beginPath();
    ctx.arc(x, y, ball.radius - theme.repeatRingWidth, 0, Math.PI * 2);
    ctx.strokeStyle = theme.repeatRing;
    ctx.lineWidth = theme.repeatRingWidth;
    ctx.stroke();
  }
  // A part that stands proud of the ball (the Spartan's crest), over its outline.
  if (design?.over !== undefined && view !== undefined) paintDesign(ctx, view, design.over);
  ctx.restore();
}

/** A ring that grows outwards and fades as `strength` falls from 1 to 0. */
