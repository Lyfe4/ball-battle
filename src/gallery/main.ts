// PROTOTYPE ONLY (proto/ball-looks): the six redesigned balls, old and new side by side, cycling
// through their states at phone and desktop size, as the game's own drawBall draws them. Served as
// /ballgallery.html on the branch's deploy preview for review; never merged.
import './gallery.css';
import type { BallDesign } from '../render/ball-designs/types.ts';
import { ballColor } from '../render/ball-colors.ts';
import { drawBall } from '../render/draw.ts';
import { theme } from '../render/theme.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { BOOMERANG_RADIUS } from '../sim/balls/boomerang.ts';
import { getDefinition } from '../sim/definitions.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import type { BallState, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { ENTRIES, type Entry } from './entries.ts';
import { TIMELINES, type GalleryState } from './timelines.ts';

/** CSS px per world unit: a phone arena (about 340 px of court) and a desktop one (about 720). */
const PHONE = 340 / 1016;
const DESKTOP = 720 / 1016;
/** The picker and manual icons: 44 px across, the start-of-match state. */
const ICON = 44;

function canvasFor(cssSize: number): HTMLCanvasElement {
  const ratio = Math.min(window.devicePixelRatio || 1, theme.maxPixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cssSize * ratio);
  canvas.height = Math.round(cssSize * ratio);
  canvas.style.width = `${String(cssSize)}px`;
  canvas.style.height = `${String(cssSize)}px`;
  return canvas;
}

/** A world holding the ball at the origin in `state`, and an enemy far off to aim at. */
export function galleryWorld(
  id: string,
  state: GalleryState,
): { world: WorldState; ball: BallState } {
  const definition = getDefinition(BALL_LOOKUP, id);
  const base = createWorld(1, [definition, definition]);
  const [first, second] = base.balls;
  if (first === undefined || second === undefined) throw new Error('expected two balls');
  const angle = state.angle ?? -0.6;
  const ball: BallState = {
    ...first,
    position: { x: 0, y: 0 },
    velocity: { x: Math.cos(angle) * definition.speed, y: Math.sin(angle) * definition.speed },
    radius: state.radius ?? first.radius,
    abilityState: state.abilityState ?? definition.initialAbilityState,
  };
  const enemy: BallState = { ...second, position: { x: 800, y: -600 } };
  const projectiles =
    state.shotOut === true
      ? [
          {
            id: 'projectile-0',
            ownerId: ball.id,
            position: { x: 300, y: -200 },
            velocity: { x: 1, y: 0 },
            radius: BOOMERANG_RADIUS,
            damage: 0,
            ticksLeft: 1,
          },
        ]
      : [];
  return { world: { ...base, tick: state.tick, balls: [ball, enemy], projectiles }, ball };
}

/** Draws the ball in `state` with `design`, `unit` CSS px to a world unit, centred on the canvas. */
export function paint(
  canvas: HTMLCanvasElement,
  id: string,
  design: BallDesign,
  state: GalleryState,
  unit: number,
): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  const { world, ball } = galleryWorld(id, state);
  const definition = getDefinition(BALL_LOOKUP, id);
  const cssSize = canvas.width / Math.min(window.devicePixelRatio || 1, theme.maxPixelRatio);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = theme.arenaFill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = unit * (canvas.width / cssSize);
  ctx.setTransform(scale, 0, 0, scale, canvas.width / 2, canvas.height / 2);
  drawBall(ctx, world, ball, {
    color: ballColor(definition.color, false),
    isRepeat: false,
    flash: state.flash ?? 0,
    heal: 0,
    design,
    cssPixelsPerUnit: unit,
  });
}

interface Live {
  readonly id: string;
  readonly canvases: readonly (readonly [HTMLCanvasElement, BallDesign, number])[];
  readonly caption: HTMLElement;
}

function figure(label: string, canvas: HTMLCanvasElement): HTMLElement {
  const element = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = label;
  element.append(canvas, caption);
  return element;
}

function looksOf(entry: Entry): readonly (readonly [string, BallDesign])[] {
  return [['old', entry.old], ...entry.looks.map((look) => [look.label, look.design] as const)];
}

function card(entry: Entry): { element: HTMLElement; live: Live } {
  const definition = getDefinition(BALL_LOOKUP, entry.id);
  const element = document.createElement('section');
  element.className = 'ball';
  element.id = entry.id;
  const title = document.createElement('h2');
  title.textContent = definition.name;
  const status = document.createElement('p');
  status.className = 'status';
  status.textContent = entry.status;
  const whys = entry.looks.map((look) => {
    const why = document.createElement('p');
    why.className = 'why';
    why.textContent = look.why;
    return why;
  });
  const caption = document.createElement('p');
  caption.className = 'state';
  const canvases: [HTMLCanvasElement, BallDesign, number][] = [];
  const grid = document.createElement('div');
  grid.className = 'grid';
  const maxRadius = entry.id === 'titan' ? 90 : 55;
  for (const [size, unit] of [
    ['phone', PHONE],
    ['desktop', DESKTOP],
  ] as const) {
    const row = document.createElement('div');
    row.className = 'pair';
    for (const [label, design] of looksOf(entry)) {
      const canvas = canvasFor(Math.ceil(maxRadius * 2 * unit + 10));
      canvases.push([canvas, design, unit]);
      row.append(figure(`${label} · ${size}`, canvas));
    }
    grid.append(row);
  }
  // The icon: the start-of-match state, at the picker's size and detail.
  const icons = document.createElement('div');
  icons.className = 'pair';
  for (const [label, design] of looksOf(entry)) {
    const canvas = canvasFor(ICON);
    paint(canvas, entry.id, design, { caption: '', tick: 0 }, ICON / 2 / 1.12 / definition.radius);
    icons.append(figure(`${label} · icon`, canvas));
  }
  grid.append(icons);
  const links = document.createElement('p');
  links.className = 'links';
  const other = getDefinition(BALL_LOOKUP, entry.against);
  for (const look of entry.looks) {
    const fight = document.createElement('a');
    const query = look.query === undefined ? '' : `&${look.query}`;
    fight.href = `/?a=${entry.id}&b=${entry.against}&seed=7&v=${String(RULESET_VERSION)}${query}`;
    const named = entry.looks.length > 1 ? ` (${look.label})` : '';
    fight.textContent = `Free play${named}: ${definition.name} vs ${other.name} →`;
    links.append(fight);
  }
  const manual = document.createElement('a');
  manual.href = `/?view=manual&ball=${entry.id}`;
  manual.textContent = 'Manual entry →';
  links.append(manual);
  element.append(title, status, ...whys, caption, grid, links);
  return { element, live: { id: entry.id, canvases, caption } };
}

function start(): void {
  const root = document.getElementById('gallery');
  if (root === null) return;
  if (new URLSearchParams(window.location.search).has('strips')) {
    document.body.classList.add('strips');
    void import('./strips.ts').then(({ renderStrips }) => {
      renderStrips(root, ENTRIES, paint, canvasFor);
    });
    wireBenchLater();
    return;
  }
  const lives = ENTRIES.map((entry) => {
    const { element, live } = card(entry);
    root.append(element);
    return live;
  });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const began = performance.now();
  const frame = (now: number): void => {
    const tick = Math.floor(((now - began) / 1000) * 60);
    for (const live of lives) {
      const state = TIMELINES[live.id]?.(tick);
      if (state === undefined) continue;
      if (live.caption.textContent !== state.caption) live.caption.textContent = state.caption;
      const shown = reduced ? { ...state, flash: 0 } : state;
      for (const [canvas, design, unit] of live.canvases)
        paint(canvas, live.id, design, shown, unit);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  wireBenchLater();
}

function wireBenchLater(): void {
  void import('./bench.ts').then(({ wireBench }) => {
    wireBench(ENTRIES);
  });
}

start();
