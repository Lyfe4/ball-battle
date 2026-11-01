import './style.css';
import { advanceClock } from './app/fixed-step.ts';
import { parseMatchup, writeMatchParams, type Matchup } from './app/matchup.ts';
import { generateSeed, parseSeed } from './app/seed.ts';
import { fitCanvasToContainer } from './render/canvas.ts';
import { drawWorld } from './render/draw.ts';
import { createEffects } from './render/effects.ts';
import { BALL_LOOKUP, BALLS } from './sim/balls/index.ts';
import { getDefinition } from './sim/definitions.ts';
import { step } from './sim/step.ts';
import { createWorld } from './sim/world.ts';
import { createHud } from './ui/hud.ts';
import { createPicker } from './ui/picker.ts';

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
const hudRoot = getElement('hud-status', HTMLDivElement);
const pickerForm = getElement('picker', HTMLFormElement);
const ctx = getContext2d(canvas);

const effects = createEffects();
const ballIds = BALLS.map((ball) => ball.id);

const params = new URL(window.location.href).searchParams;
let matchup = parseMatchup(params, ballIds);
let seed = parseSeed(params.get('seed')) ?? generateSeed();
let world = createMatchWorld(matchup, seed);
let accumulatorMs = 0;
let lastFrameMs: number | undefined;
let canvasPixels = 0;

function createMatchWorld(next: Matchup, nextSeed: number) {
  return createWorld(nextSeed, [
    getDefinition(BALL_LOOKUP, next.a),
    getDefinition(BALL_LOOKUP, next.b),
  ]);
}

const hud = createHud(hudRoot, BALL_LOOKUP, {
  onReplay: () => {
    startMatch(matchup, seed);
  },
  onNewMatch: () => {
    startMatch(matchup, generateSeed());
  },
});

const picker = createPicker(pickerForm, BALLS, (chosen) => {
  startMatch(chosen, generateSeed());
});

function render(nowMs: number): void {
  drawWorld(ctx, world, BALL_LOOKUP, canvasPixels, {
    flash: (ballId) => effects.flash(ballId, nowMs),
    heal: (ballId) => effects.heal(ballId, nowMs),
  });
  hud.update(world, seed);
}

/**
 * Starts (or restarts) a match. The matchup and seed are written to the URL, so reloading or
 * sharing the link replays the same match, and a link with an invalid id is corrected.
 */
function startMatch(nextMatchup: Matchup, nextSeed: number): void {
  matchup = nextMatchup;
  seed = nextSeed;
  world = createMatchWorld(matchup, seed);
  hud.setMatch(world);
  picker.show(matchup);
  effects.reset();
  accumulatorMs = 0;
  lastFrameMs = undefined;

  const url = new URL(window.location.href);
  writeMatchParams(url.searchParams, matchup, seed);
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
      const result = step(world, BALL_LOOKUP);
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

startMatch(matchup, seed);
requestAnimationFrame(frame);
