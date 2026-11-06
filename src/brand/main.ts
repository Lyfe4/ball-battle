// Dev-only brand page (/brand.html under `pnpm dev`; not in the production build): the site's icons
// and its link-preview image, drawn with the game's own renderer so they match what players see.
// Each canvas has a `data-file` naming the file in public/ it becomes; save each canvas as that
// PNG (the "Save" links, or a headless capture of the canvases) and commit the files.
import '@fontsource-variable/bricolage-grotesque';
import { drawBallIcon } from '../render/ball-icon.ts';
import { drawWorld, NO_EFFECTS } from '../render/draw.ts';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import type { WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';

/** The page colour (tokens.css --color-page), for icons that must be opaque. */
const PAGE = '#17122b';
/** tokens.css --color-text, --color-text-muted and --color-focus (links). */
const TEXT = '#fff8ee';
const MUTED = '#b9afd9';
const LINK = '#ff8cc4';
/** The game's one type family (src/style.css), loaded before the preview draws its words. */
const FONT = "'Bricolage Grotesque Variable', system-ui, sans-serif";
/** The ball the icons are drawn from: the Brawler, the baseline ball. */
const ICON_BALL = getDefinition(BALL_LOOKUP, 'brawler');

interface IconSpec {
  readonly file: string;
  readonly size: number;
  /** Ball diameter as a share of the icon: smaller where a platform crops to a shape. */
  readonly ball: number;
  readonly opaque: boolean;
}

const ICONS: readonly IconSpec[] = [
  { file: 'favicon-32.png', size: 32, ball: 1, opaque: false },
  { file: 'apple-touch-icon.png', size: 180, ball: 0.82, opaque: true },
  { file: 'icon-192.png', size: 192, ball: 0.9, opaque: false },
  { file: 'icon-512.png', size: 512, ball: 0.9, opaque: false },
  // Maskable: the launcher may crop to a circle of 80% of the icon, so the ball stays inside it.
  { file: 'icon-maskable-512.png', size: 512, ball: 0.72, opaque: true },
];

function canvas(width: number, height: number, file: string): HTMLCanvasElement {
  const node = document.createElement('canvas');
  node.width = width;
  node.height = height;
  node.dataset['file'] = file;
  return node;
}

function context(node: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = node.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D is not supported');
  return ctx;
}

/** One icon: the Brawler drawn by the game (bold small design at tab size), centred. */
function icon(spec: IconSpec): HTMLCanvasElement {
  const out = canvas(spec.size, spec.size, spec.file);
  const ctx = context(out);
  if (spec.opaque) {
    ctx.fillStyle = PAGE;
    ctx.fillRect(0, 0, spec.size, spec.size);
  }
  // drawBallIcon sizes by CSS pixels times the device pixel ratio; divide it back out so the
  // icon is drawn at exactly `size` pixels whatever screen the page is on.
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const ball = document.createElement('canvas');
  drawBallIcon(ball, ICON_BALL, (spec.size * spec.ball) / ratio);
  const side = spec.size * spec.ball;
  ctx.drawImage(ball, (spec.size - side) / 2, (spec.size - side) / 2, side, side);
  return out;
}

/**
 * A real match at a telling moment: both balls well inside the arena, a readable distance apart,
 * with an arrow or a strike on its way. Searched over a few seeds and ticks, deterministically.
 */
function previewWorld(): WorldState {
  const pair = [getDefinition(BALL_LOOKUP, 'archer'), getDefinition(BALL_LOOKUP, 'storm')];
  let best: { world: WorldState; score: number } | undefined;
  for (let seed = 1; seed <= 40; seed++) {
    let world = createWorld(seed, pair);
    for (let tick = 1; tick <= 420 && world.match.status === 'running'; tick++) {
      world = step(world, BALL_LOOKUP).world;
      if (tick < 120 || tick % 10 !== 0) continue;
      const [a, b] = world.balls;
      if (a === undefined || b === undefined) continue;
      const inside = [a, b].every(
        (ball) =>
          Math.min(
            ball.position.x,
            ball.position.y,
            1000 - ball.position.x,
            1000 - ball.position.y,
          ) > 180,
      );
      const apart = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
      const action = world.projectiles.length + world.zones.length;
      if (!inside || apart < 250 || apart > 520 || action === 0) continue;
      const score = action * 100 + Math.min(a.health, b.health);
      if (best === undefined || score > best.score) best = { world, score };
    }
  }
  if (best === undefined) throw new Error('No preview frame found');
  return best.world;
}

/** The link preview (1200 x 630): a frame of a real fight beside the name, the pitch and the roster. */
function preview(): HTMLCanvasElement {
  const width = 1200;
  const height = 630;
  const out = canvas(width, height, 'og-image.png');
  const ctx = context(out);
  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, width, height);

  // drawWorld sets its own transform, so the arena is drawn on a canvas of its own and placed.
  const arena = 570;
  const arenaCanvas = document.createElement('canvas');
  arenaCanvas.width = arena;
  arenaCanvas.height = arena;
  const view = { canvasPixels: arena, cssPixels: arena };
  drawWorld(context(arenaCanvas), previewWorld(), BALL_LOOKUP, view, NO_EFFECTS);
  ctx.drawImage(arenaCanvas, 30, 30);

  const x = 650;
  ctx.fillStyle = TEXT;
  ctx.font = `800 76px ${FONT}`;
  ctx.fillText('BallBattle', x, 170);
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${FONT}`;
  const lines = [
    'Build a lineup of three balls,',
    'set your order, and watch',
    'your plan fight it out.',
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, x, 240 + i * 44);
  });

  const icon = 40;
  // The roster in two rows, clear of the address below: nine to a row for seventeen balls.
  const perRow = Math.ceil(BALLS.length / 2);
  BALLS.forEach((ball, i) => {
    const node = document.createElement('canvas');
    drawBallIcon(node, ball, icon / Math.min(window.devicePixelRatio || 1, 2));
    const column = i % perRow;
    const row = Math.floor(i / perRow);
    ctx.drawImage(node, x + column * (icon + 8), 410 + row * (icon + 10), icon, icon);
  });

  ctx.fillStyle = LINK;
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText('battle-ball.netlify.app', x, 580);
  return out;
}

function figure(node: HTMLCanvasElement): HTMLElement {
  const item = document.createElement('figure');
  const save = document.createElement('a');
  save.textContent = `Save ${node.dataset['file'] ?? ''}`;
  save.download = node.dataset['file'] ?? 'image.png';
  save.href = node.toDataURL('image/png');
  item.append(node, save);
  return item;
}

const root = document.getElementById('brand');
// Canvas text uses whatever font is loaded at the time, so wait for the weights the preview uses.
void Promise.all(
  [`800 76px ${FONT}`, `400 30px ${FONT}`, `600 26px ${FONT}`].map((font) =>
    document.fonts.load(font),
  ),
).then(() => {
  if (root !== null) root.append(...ICONS.map((spec) => figure(icon(spec))), figure(preview()));
});
