import './style.css';
import { advanceClock } from './app/fixed-step.ts';
import { generateSeed, parseSeed } from './app/seed.ts';
import { fitCanvasToContainer } from './render/canvas.ts';
import { drawWorld } from './render/draw.ts';
import { createEffects } from './render/effects.ts';
import { blue } from './sim/balls/blue.ts';
import { red } from './sim/balls/red.ts';
import { indexDefinitions } from './sim/definitions.ts';
import { step } from './sim/step.ts';
import { createWorld } from './sim/world.ts';

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}`);
  }
  return element;
}

const canvas = getElement('arena', HTMLCanvasElement);
const container = getElement('arena-container', HTMLDivElement);
const seedLabel = getElement('seed', HTMLParagraphElement);
const ctx = canvas.getContext('2d');
if (ctx === null) {
  throw new Error('Canvas 2D is not supported in this browser');
}

// The seed is written back to the URL so reloading or sharing the link replays the same match.
const url = new URL(window.location.href);
const seed = parseSeed(url.searchParams.get('seed')) ?? generateSeed();
url.searchParams.set('seed', String(seed));
window.history.replaceState(null, '', url);
seedLabel.textContent = `Seed ${seed}`;

const definitions = [red, blue];
const definitionsById = indexDefinitions(definitions);
let world = createWorld(seed, definitions);

const effects = createEffects();

let canvasPixels = 0;
const render = (nowMs: number): void => {
  drawWorld(ctx, world, definitionsById, canvasPixels, {
    flash: (ballId) => effects.flash(ballId, nowMs),
  });
};

fitCanvasToContainer(canvas, container, (size) => {
  canvasPixels = size.pixels;
  render(performance.now());
});

let accumulatorMs = 0;
let lastFrameMs: number | undefined;

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

requestAnimationFrame(frame);
