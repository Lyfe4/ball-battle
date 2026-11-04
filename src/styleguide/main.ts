// Dev-only style guide (/styleguide.html under `pnpm dev`; not in the production build). Draws
// every ball with the game's own drawBall and designs, in each ability state, large and at phone
// size, so designs can be reviewed without playing matches.
import { BALL_DESIGNS } from '../render/ball-designs/index.ts';
import { ballColor } from '../render/ball-colors.ts';
import { drawStatuses } from '../render/draw-feel.ts';
import { drawBall, drawWorld, NO_EFFECTS } from '../render/draw.ts';
import { drawAimLines } from '../render/projectiles.ts';
import { drawStrikes } from '../render/zones.ts';
import { theme } from '../render/theme.ts';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { ARENA_SIZE } from '../sim/constants.ts';
import { getDefinition } from '../sim/definitions.ts';
import type { BallState, Vec2, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { arenaAbilityState, right, SECTIONS, TICK, type Tile } from './sections.ts';

const LARGE_RADIUS_PX = 56;
const SMALL_RADIUS_PX = 15;

/** A world holding the tile's ball at the origin and an enemy far off in its `toward` direction. */
function tileWorld(tile: Tile): { world: WorldState; ball: BallState } {
  const definition = getDefinition(BALL_LOOKUP, tile.id);
  const base = createWorld(1, [definition, definition]);
  const toward = tile.toward ?? right;
  const [first, second] = base.balls;
  if (first === undefined || second === undefined) throw new Error('expected two balls');
  const ball: BallState = {
    ...first,
    position: { x: 0, y: 0 },
    velocity: { x: toward.x * definition.speed, y: toward.y * definition.speed },
    health: tile.defeated === true ? 0 : Math.round((tile.health ?? 1) * definition.maxHealth),
    abilityState: tile.abilityState ?? definition.initialAbilityState,
  };
  const enemy: BallState = { ...second, position: { x: toward.x * 800, y: toward.y * 800 } };
  return { world: { ...base, tick: TICK, balls: [ball, enemy] }, ball };
}

function canvasFor(cssSize: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const ratio = Math.min(window.devicePixelRatio || 1, theme.maxPixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cssSize * ratio);
  canvas.height = Math.round(cssSize * ratio);
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D is not supported');
  return { canvas, ctx };
}

/**
 * One ball on its own canvas. `detail` forces full or simplified markings; without it the design
 * picks by on-screen size, as in a match.
 */
function drawTile(tile: Tile, radiusPx: number, detail?: 'full' | 'simple'): HTMLCanvasElement {
  // Room for the status rings outside the edge when there are any.
  const rings = tile.statuses?.length ?? 0;
  const cssSize = Math.ceil(radiusPx * 2 + (rings === 0 ? 12 : 16 + rings * 16));
  const { canvas, ctx } = canvasFor(cssSize);
  const { world, ball } = tileWorld(tile);
  const definition = getDefinition(BALL_LOOKUP, tile.id);
  ctx.fillStyle = theme.arenaFill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = (radiusPx / ball.radius) * (canvas.width / cssSize);
  ctx.setTransform(scale, 0, 0, scale, canvas.width / 2, canvas.height / 2);
  drawAimLines(ctx, world);
  drawBall(ctx, world, ball, {
    color: ballColor(definition.color, tile.repeat === true),
    isRepeat: tile.repeat === true,
    flash: tile.flash ?? 0,
    heal: tile.heal ?? 0,
    design: BALL_DESIGNS.get(tile.id),
    cssPixelsPerUnit: radiusPx / ball.radius,
    ...(detail === undefined ? {} : { detail }),
  });
  if (rings > 0) {
    const statuses = (tile.statuses ?? []).map((kind) => ({
      kind,
      sourceId: 'ball-1',
      expiresTick: TICK + 1,
      sinceTick: TICK,
    }));
    drawStatuses(ctx, { ...ball, statuses }, TICK, false);
  }
  return canvas;
}

/** Every ball in a real arena at phone width, as a match would show them. */
function phoneArena(): HTMLElement {
  const cssSize = 340;
  const { canvas, ctx } = canvasFor(cssSize);
  // A grid of four columns, as many rows as the roster needs.
  const columns = 4;
  const rows = Math.ceil(BALLS.length / columns);
  const spot = (index: number): Vec2 => ({
    x: ((index % columns) + 0.5) * (ARENA_SIZE / columns),
    y: (Math.floor(index / columns) + 0.5) * (ARENA_SIZE / rows),
  });
  // One ball per definition. createWorld gives each ball its own strip of the arena, which is too
  // narrow for the whole roster at once, so each comes from a two-ball world of its own.
  const world = createWorld(4, BALLS.slice(0, 2));
  const balls = BALLS.map((definition, index) => {
    const [first] = createWorld(4, [definition, definition]).balls;
    if (first === undefined) throw new Error('expected a ball');
    return { ...first, id: `ball-${String(index)}` };
  }).map((ball, index) => ({
    ...ball,
    position: spot(index),
    abilityState: arenaAbilityState(ball),
    // A hurt Berserker, so its cracks show.
    health:
      ball.definitionId === 'berserker'
        ? Math.round(getDefinition(BALL_LOOKUP, 'berserker').maxHealth * 0.3)
        : ball.health,
  }));
  const view = { canvasPixels: canvas.width, cssPixels: cssSize };
  drawWorld(ctx, { ...world, tick: TICK, balls }, BALL_LOOKUP, view, NO_EFFECTS);
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = 'In the arena at phone width (340 px canvas)';
  figure.append(canvas, caption);
  return figure;
}

/** A Storm strike and a Quake shockwave at three points of its fade, side by side. */
function strikesFigure(): HTMLElement {
  const cssSize = 340;
  const { canvas, ctx } = canvasFor(cssSize);
  const world = createWorld(1, [
    getDefinition(BALL_LOOKUP, 'storm'),
    getDefinition(BALL_LOOKUP, 'quake'),
  ]);
  const [storm, quake] = world.balls;
  if (storm === undefined || quake === undefined) throw new Error('expected two balls');
  const balls = [
    { ...storm, position: { x: 250, y: 260 } },
    { ...quake, position: { x: 760, y: 760 } },
  ];
  const shown = { ...world, tick: TICK, balls };
  const view = { canvasPixels: canvas.width, cssPixels: cssSize };
  drawWorld(ctx, shown, BALL_LOOKUP, view, NO_EFFECTS);
  const strike = (zoneId: string, ownerId: string, x: number, y: number, strength: number) => ({
    zoneId,
    ownerId,
    position: { x, y },
    radius: 180,
    strength,
  });
  drawStrikes(ctx, shown, [
    strike('zone-0', storm.id, 250, 260, 0.8),
    strike('zone-1', quake.id, 760, 260, 0.9),
    strike('zone-2', quake.id, 250, 760, 0.5),
    strike('zone-3', quake.id, 760, 760, 0.2),
  ]);
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = 'Storm strike; shockwave at 90%, 50% and 20% strength';
  figure.append(canvas, caption);
  return figure;
}

function render(root: HTMLElement): void {
  for (const [title, tiles] of SECTIONS) {
    const heading = document.createElement('h2');
    heading.textContent = title;
    const row = document.createElement('div');
    row.className = 'row';
    for (const tile of tiles) {
      const figure = document.createElement('figure');
      const sizes = document.createElement('div');
      sizes.className = 'sizes';
      sizes.append(
        drawTile(tile, LARGE_RADIUS_PX, 'full'),
        drawTile(tile, LARGE_RADIUS_PX, 'simple'),
        drawTile(tile, SMALL_RADIUS_PX),
      );
      const caption = document.createElement('figcaption');
      caption.textContent = tile.label;
      figure.append(sizes, caption);
      row.append(figure);
    }
    root.append(heading, row);
  }
  const strikes = document.createElement('h2');
  strikes.textContent = 'Strikes: lightning, then a shockwave sweeping out as it fades';
  root.append(strikes, strikesFigure());
  const heading = document.createElement('h2');
  heading.textContent = 'Phone arena';
  root.append(heading, phoneArena());
}

const root = document.getElementById('guide');
if (root !== null) render(root);
