// Dev-only style guide (/styleguide.html under `pnpm dev`; not in the production build). Draws
// every ball with the game's own drawBall and designs, in each ability state, large and at phone
// size, so designs can be reviewed without playing matches.
import { BALL_DESIGNS } from '../render/ball-designs/index.ts';
import { ballColor } from '../render/ball-colors.ts';
import { drawBall, drawWorld, NO_EFFECTS } from '../render/draw.ts';
import { theme } from '../render/theme.ts';
import { COOLDOWN_TICKS as ARCHER_COOLDOWN } from '../sim/balls/archer.ts';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { COOLDOWN_TICKS as STORM_COOLDOWN } from '../sim/balls/storm.ts';
import { getDefinition } from '../sim/definitions.ts';
import type { AbilityState, BallState, Vec2, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';

const LARGE_RADIUS_PX = 56;
const SMALL_RADIUS_PX = 15;
const TICK = 600;

interface Tile {
  readonly label: string;
  readonly id: string;
  readonly abilityState?: AbilityState;
  /** Where the ball is heading (Speedster) or where its enemy is (Archer). */
  readonly toward?: Vec2;
  readonly repeat?: boolean;
  readonly defeated?: boolean;
  readonly heal?: number;
  readonly flash?: number;
}

/** Ability state for a cooldown ball `charge` of the way to its next shot or strike. */
const charged = (key: string, cooldown: number, charge: number): AbilityState => ({
  [key]: TICK + Math.round((1 - charge) * cooldown),
});

const right: Vec2 = { x: 1, y: 0 };
const upRight: Vec2 = { x: 0.8, y: -0.6 };
const downLeft: Vec2 = { x: -0.6, y: 0.8 };

const SECTIONS: readonly (readonly [string, readonly Tile[]])[] = [
  [
    'Brawler: hits hard, no tricks',
    [
      { label: 'idle', id: 'brawler' },
      { label: 'hit flash', id: 'brawler', flash: 0.6 },
      { label: 'mirror B', id: 'brawler', repeat: true },
      { label: 'defeated', id: 'brawler', defeated: true },
    ],
  ],
  [
    'Speedster: one streak per stack, facing its travel',
    [
      ...[0, 1, 2, 3, 4, 5].map((stacks): Tile => ({
        label: `${stacks} stacks`,
        id: 'speedster',
        abilityState: { stacks },
        toward: upRight,
      })),
      {
        label: 'mirror B, 3',
        id: 'speedster',
        abilityState: { stacks: 3 },
        toward: right,
        repeat: true,
      },
    ],
  ],
  [
    'Vampire: collar and fangs; the collar edge flushes when it heals',
    [
      { label: 'idle', id: 'vampire' },
      { label: 'healing', id: 'vampire', heal: 1 },
      { label: 'heal fading', id: 'vampire', heal: 0.4 },
      { label: 'mirror B', id: 'vampire', repeat: true },
    ],
  ],
  [
    'Archer: bow faces its target and draws back as the shot charges',
    [
      ...[0, 0.5, 1].map((charge): Tile => ({
        label: `charge ${charge * 100}%`,
        id: 'archer',
        abilityState: charged('nextShotTick', ARCHER_COOLDOWN, charge),
        toward: right,
      })),
      {
        label: 'aiming down-left, 70%',
        id: 'archer',
        abilityState: charged('nextShotTick', ARCHER_COOLDOWN, 0.7),
        toward: downLeft,
      },
      {
        label: 'mirror B, 50%',
        id: 'archer',
        abilityState: charged('nextShotTick', ARCHER_COOLDOWN, 0.5),
        toward: right,
        repeat: true,
      },
    ],
  ],
  [
    'Storm: the bolt brightens as the strike charges, then flickers',
    [
      ...[0, 0.5, 0.85, 1].map((charge): Tile => ({
        label: `charge ${charge * 100}%`,
        id: 'storm',
        abilityState: charged('nextStrikeTick', STORM_COOLDOWN, charge),
      })),
      {
        label: 'mirror B, 50%',
        id: 'storm',
        abilityState: charged('nextStrikeTick', STORM_COOLDOWN, 0.5),
        repeat: true,
      },
    ],
  ],
];

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
    health: tile.defeated === true ? 0 : definition.maxHealth,
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
  const cssSize = Math.ceil(radiusPx * 2 + 12);
  const { canvas, ctx } = canvasFor(cssSize);
  const { world, ball } = tileWorld(tile);
  const definition = getDefinition(BALL_LOOKUP, tile.id);
  ctx.fillStyle = theme.arenaFill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = (radiusPx / ball.radius) * (canvas.width / cssSize);
  ctx.setTransform(scale, 0, 0, scale, canvas.width / 2, canvas.height / 2);
  drawBall(ctx, world, ball, {
    color: ballColor(definition.color, tile.repeat === true),
    isRepeat: tile.repeat === true,
    flash: tile.flash ?? 0,
    heal: tile.heal ?? 0,
    design: BALL_DESIGNS.get(tile.id),
    cssPixelsPerUnit: radiusPx / ball.radius,
    ...(detail === undefined ? {} : { detail }),
  });
  return canvas;
}

/** All five balls in a real arena at phone width, as a match would show them. */
function phoneArena(): HTMLElement {
  const cssSize = 340;
  const { canvas, ctx } = canvasFor(cssSize);
  const spots: readonly Vec2[] = [
    { x: 180, y: 200 },
    { x: 500, y: 180 },
    { x: 820, y: 220 },
    { x: 320, y: 700 },
    { x: 700, y: 720 },
  ];
  const world = createWorld(4, BALLS);
  const balls = world.balls.map((ball, index) => ({
    ...ball,
    position: spots[index] ?? ball.position,
    abilityState:
      ball.definitionId === 'speedster'
        ? { stacks: 3 }
        : ball.definitionId === 'archer'
          ? charged('nextShotTick', ARCHER_COOLDOWN, 0.6)
          : ball.definitionId === 'storm'
            ? charged('nextStrikeTick', STORM_COOLDOWN, 0.6)
            : ball.abilityState,
  }));
  const view = { canvasPixels: canvas.width, cssPixels: cssSize };
  drawWorld(ctx, { ...world, tick: TICK, balls }, BALL_LOOKUP, view, NO_EFFECTS);
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = 'In the arena at phone width (340 px canvas)';
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
  const heading = document.createElement('h2');
  heading.textContent = 'Phone arena';
  root.append(heading, phoneArena());
}

const root = document.getElementById('guide');
if (root !== null) render(root);
