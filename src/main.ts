import './style.css';
import { advanceClock } from './app/fixed-step.ts';
import { generateSeed, parseSeed } from './app/seed.ts';
import { fitCanvasToContainer } from './render/canvas.ts';
import { drawWorld } from './render/draw.ts';
import { createEffects } from './render/effects.ts';
import { speedster } from './sim/balls/speedster.ts';
import { vampire } from './sim/balls/vampire.ts';
import { indexDefinitions } from './sim/definitions.ts';
import { step } from './sim/step.ts';
import { createWorld } from './sim/world.ts';
import { createHud } from './ui/hud.ts';

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}`);
  }
  return element;
}

function getContext2d(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = target.getContext('2d');
  if (context === null) {
    throw new Error('Canvas 2D is not supported in this browser');
  }
  return context;
}

const canvas = getElement('arena', HTMLCanvasElement);
const container = getElement('arena-container', HTMLDivElement);
const hudRoot = getElement('hud', HTMLElement);
const ctx = getContext2d(canvas);

const definitions = [speedster, vampire];
const definitionsById = indexDefinitions(definitions);
const effects = createEffects();

let seed = parseSeed(new URL(window.location.href).searchParams.get('seed')) ?? generateSeed();
let world = createWorld(seed, definitions);
let accumulatorMs = 0;
let lastFrameMs: number | undefined;
let canvasPixels = 0;

const hud = createHud(hudRoot, world, definitionsById, {
  onReplay: () => {
    startMatch(seed);
  },
  onNewMatch: () => {
    startMatch(generateSeed());
  },
});

function render(nowMs: number): void {
  drawWorld(ctx, world, definitionsById, canvasPixels, {
    flash: (ballId) => effects.flash(ballId, nowMs),
  });
  hud.update(world, seed);
}

/**
 * Starts (or restarts) a match from a seed. The seed is written to the URL so reloading or
 * sharing the link replays the same match.
 */
function startMatch(nextSeed: number): void {
  seed = nextSeed;
  world = createWorld(seed, definitions);
  effects.reset();
  accumulatorMs = 0;
  lastFrameMs = undefined;

  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  window.history.replaceState(null, '', url);
  render(performance.now());
}

fitCanvasToContainer(canvas, container, (size) => {
  canvasPixels = size.pixels;
  render(performance.now());
});

function frame(nowMs: number): void {
  if (lastFrameMs !== undefined) {
    const advance = advanceClock(accumulatorMs, nowMs - lastFrameMs);
    accumulatorMs = advance.accumulatorMs;
    for (let i = 0; i < advance.ticks; i++) {
      const result = step(world, definitionsById);
      world = result.world;
      effects.apply(result.events, nowMs);
    }
    // Keep drawing after the match ends while effects (like the final hit's flash) fade out.
    if (advance.ticks > 0 || effects.isActive(nowMs)) render(nowMs);
  }
  lastFrameMs = nowMs;
  requestAnimationFrame(frame);
}

// Browsers pause requestAnimationFrame in hidden tabs. Restart timing on return so the match
// picks up where it paused instead of counting the time away.
document.addEventListener('visibilitychange', () => {
  lastFrameMs = undefined;
});

startMatch(seed);
requestAnimationFrame(frame);
