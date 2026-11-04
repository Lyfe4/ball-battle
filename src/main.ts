import './style.css';
import { parseMatchup, writeMatchParams, type Matchup } from './app/matchup.ts';
import { advanceFrame, startPlayback, type Playback } from './app/playback.ts';
import { isClockBusy } from './app/presentation-clock.ts';
import { generateSeed, parseSeed } from './app/seed.ts';
import { fitCanvasToContainer } from './render/canvas.ts';
import { drawWorld } from './render/draw.ts';
import { createEffects } from './render/effects.ts';
import { feelOf, wallBounces } from './render/impact.ts';
import { introLook } from './render/motion.ts';
import { theme } from './render/theme.ts';
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
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const params = new URL(window.location.href).searchParams;
let matchup = parseMatchup(params, ballIds);
let seed = parseSeed(params.get('seed')) ?? generateSeed();
let playback: Playback = startPlayback(createMatchWorld(matchup, seed), theme.introMs);
let lastFrameMs: number | undefined;
let canvasView = { canvasPixels: 0, cssPixels: 0 };

function createMatchWorld(next: Matchup, nextSeed: number) {
  return createWorld(nextSeed, [
    getDefinition(BALL_LOOKUP, next.a),
    getDefinition(BALL_LOOKUP, next.b),
  ]);
}

function applyReducedMotion(): void {
  effects.setReducedMotion(reducedMotionQuery.matches);
}
applyReducedMotion();
reducedMotionQuery.addEventListener('change', applyReducedMotion);

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

/** Draws the current world with every effect at the current effect time. */
function render(): void {
  const { world, effectMs: now } = playback;
  const reduced = reducedMotionQuery.matches;
  drawWorld(ctx, world, BALL_LOOKUP, canvasView, {
    flash: (ballId) => effects.flash(ballId, now),
    heal: (ballId) => effects.heal(ballId, now),
    sparks: effects.sparks(now),
    strikes: effects.strikes(now),
    shake: effects.shake(now),
    squash: (ballId) => effects.squash(ballId, now),
    ghost: (ballId, health) => effects.ghost(ballId, health, now),
    particles: effects.particles(now),
    knockouts: effects.knockouts(now),
    winner: effects.winner(now),
    intro: (index) => introLook(index, now, reduced),
    healReduced: (ballId) => effects.healReduced(ballId, now),
    reducedMotion: reduced,
  });
  hud.update(world, seed, effects.resultVisible(now));
}

/**
 * Starts (or restarts) a match. The matchup and seed are written to the URL, so reloading or
 * sharing the link replays the same match, and a link with an invalid id is corrected.
 */
function startMatch(nextMatchup: Matchup, nextSeed: number): void {
  matchup = nextMatchup;
  seed = nextSeed;
  playback = startPlayback(createMatchWorld(matchup, seed), theme.introMs);
  hud.setMatch(playback.world);
  picker.show(matchup);
  effects.reset();
  lastFrameMs = undefined;

  const url = new URL(window.location.href);
  writeMatchParams(url.searchParams, matchup, seed);
  window.history.replaceState(null, '', url);
  render();
}

fitCanvasToContainer(canvas, container, (size) => {
  canvasView = { canvasPixels: size.pixels, cssPixels: size.cssPixels };
  render();
});

function frame(nowMs: number): void {
  // The match pauses while the ball picker is open, like a hidden tab: no time passes, so it
  // carries on exactly where it stopped when the picker closes, whether or not a pick changed (a
  // new pick only takes effect on Start match).
  if (picker.isOpen()) {
    lastFrameMs = undefined;
    requestAnimationFrame(frame);
    return;
  }
  if (lastFrameMs !== undefined) {
    const wasBusy = isClockBusy(playback.clock);
    const outcome = advanceFrame(
      playback,
      nowMs - lastFrameMs,
      (world) => step(world, BALL_LOOKUP),
      ({ result }) => feelOf(result.events, reducedMotionQuery.matches),
    );
    playback = outcome.playback;
    for (const { previous, result } of outcome.ticks) {
      effects.apply(result.events, playback.effectMs);
      effects.bounced(wallBounces(previous, result.world), playback.effectMs);
    }
    // Keep drawing while the intro, a hit-stop or slow-mo runs, and after the match ends while
    // effects (the knockout sequence, the final flash) play out.
    const busy = wasBusy || isClockBusy(playback.clock);
    if (outcome.ticks.length > 0 || busy || effects.isActive(playback.effectMs)) render();
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
