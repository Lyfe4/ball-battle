import './style.css';
import { parseMatchup, writeMatchParams, type Matchup } from './app/matchup.ts';
import { advanceFrame, interpolationAlpha, startPlayback, type Playback } from './app/playback.ts';
import { isClockBusy } from './app/presentation-clock.ts';
import { generateSeed, parseSeed } from './app/seed.ts';
import { clearSeriesParams, parseSeriesParams } from './app/series-url.ts';
import { loadSpeed, saveSpeed, scaleFrame, type PlaybackSpeed } from './app/speed.ts';
import { fitCanvasToContainer } from './render/canvas.ts';
import { drawWorld } from './render/draw.ts';
import { createEffects } from './render/effects.ts';
import { feelOf, wallBounces } from './render/impact.ts';
import { interpolateWorld } from './render/interpolate.ts';
import { introLook } from './render/motion.ts';
import { theme } from './render/theme.ts';
import { createSeriesController } from './series-controller.ts';
import { BALL_LOOKUP, BALLS } from './sim/balls/index.ts';
import { getDefinition } from './sim/definitions.ts';
import { step } from './sim/step.ts';
import type { WorldState } from './sim/types.ts';
import { createWorld } from './sim/world.ts';
import { createHud } from './ui/hud.ts';
import { createPicker } from './ui/picker.ts';
import { createSegmented } from './ui/segmented.ts';
import { createSpeedToggle } from './ui/speed-toggle.ts';

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
const speedRoot = getElement('hud-speed', HTMLDivElement);
const modeRoot = getElement('mode-toggle', HTMLDivElement);
const lineupRoot = getElement('lineup', HTMLElement);
const seriesRoot = getElement('series', HTMLElement);
const ctx = getContext2d(canvas);

const effects = createEffects();
const ballIds = BALLS.map((ball) => ball.id);
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const params = new URL(window.location.href).searchParams;
const seriesLink = parseSeriesParams(params, ballIds);
type Mode = 'quick' | 'series';
let mode: Mode = seriesLink === undefined ? 'quick' : 'series';
let matchup = parseMatchup(params, ballIds);
let seed = parseSeed(params.get('seed')) ?? generateSeed();
let playback: Playback = startPlayback(createMatchWorld(matchup, seed), theme.introMs);
let lastFrameMs: number | undefined;
let canvasView = { canvasPixels: 0, cssPixels: 0 };
// Remembered per viewer. Reading localStorage itself can throw, hence the getter.
const storage = () => window.localStorage;
let speed: PlaybackSpeed = loadSpeed(storage);

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

const modeToggle = createSegmented<Mode>(
  modeRoot,
  'mode-toggle',
  'Mode',
  [
    { value: 'quick', text: 'Quick match' },
    { value: 'series', text: 'Best of 3' },
  ],
  mode,
  (next) => {
    setMode(next);
  },
);

const series = createSeriesController(
  { lineup: lineupRoot, series: seriesRoot },
  BALLS,
  BALL_LOOKUP,
  {
    showWorld,
    replaceUrl,
    layoutChanged: showControls,
    redraw: () => {
      hud.setMatch(playback.world);
      render();
    },
  },
);

createSpeedToggle(speedRoot, speed, (next) => {
  speed = next;
  saveSpeed(storage, next);
});

/**
 * Draws the world between the last two ticks (so motion is smooth at any refresh rate) with every
 * effect at the current effect time. The HUD shows the sim's own latest world.
 */
function render(): void {
  const { world, effectMs: now } = playback;
  const reduced = reducedMotionQuery.matches;
  const drawn = interpolateWorld(playback.previous, world, interpolationAlpha(playback));
  drawWorld(ctx, drawn, BALL_LOOKUP, canvasView, {
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
  const resultShown = effects.resultVisible(now);
  hud.update(world, seed, resultShown);
  series.update(world, resultShown);
}

/** Puts a new world on screen: playback, effects and the HUD start over. */
function showWorld(world: WorldState, shownSeed: number): void {
  seed = shownSeed;
  playback = startPlayback(world, theme.introMs);
  hud.setMatch(playback.world);
  effects.reset();
  lastFrameMs = undefined;
  render();
}

function replaceUrl(write: (params: URLSearchParams) => void): void {
  const url = new URL(window.location.href);
  write(url.searchParams);
  window.history.replaceState(null, '', url);
}

/** Which controls show for the mode: the picker, the lineup builder or the scoreboard. */
function showControls(): void {
  pickerForm.hidden = mode !== 'quick';
  series.setVisible(mode === 'series');
  hud.setSeriesMode(series.isPlaying());
}

function setMode(next: Mode): void {
  mode = next;
  modeToggle.select(next);
  series.leave();
  if (next === 'quick') {
    showControls();
    startMatch(matchup, generateSeed());
  } else {
    series.showBuilder(undefined);
  }
}

/**
 * Starts (or restarts) a match. The matchup and seed are written to the URL, so reloading or
 * sharing the link replays the same match, and a link with an invalid id is corrected.
 */
function startMatch(nextMatchup: Matchup, nextSeed: number): void {
  matchup = nextMatchup;
  picker.show(matchup);
  replaceUrl((url) => {
    clearSeriesParams(url);
    writeMatchParams(url, matchup, nextSeed);
  });
  showWorld(createMatchWorld(matchup, nextSeed), nextSeed);
}

fitCanvasToContainer(canvas, container, (size) => {
  canvasView = { canvasPixels: size.pixels, cssPixels: size.cssPixels };
  render();
});

function frame(nowMs: number): void {
  // The match pauses while the ball picker is open, like a hidden tab: no time passes, so it
  // carries on exactly where it stopped when the picker closes, whether or not a pick changed (a
  // new pick only takes effect on Start match).
  if (picker.isOpen() || series.isOpen()) {
    lastFrameMs = undefined;
    requestAnimationFrame(frame);
    return;
  }
  if (lastFrameMs !== undefined) {
    const wasBusy = isClockBusy(playback.clock);
    const resultWasShown = effects.resultVisible(playback.effectMs);
    const outcome = advanceFrame(
      playback,
      scaleFrame(nowMs - lastFrameMs, speed),
      (world) => step(world, BALL_LOOKUP),
      ({ result }) => feelOf(result.events, reducedMotionQuery.matches),
    );
    playback = outcome.playback;
    for (const { previous, result } of outcome.ticks) {
      effects.apply(result.events, playback.effectMs);
      effects.bounced(wallBounces(previous, result.world), playback.effectMs);
    }
    series.settle(playback.world);
    // Draw every frame while the match runs (balls move between ticks), while the intro, a
    // hit-stop or slow-mo runs, after the match ends while effects (the knockout sequence, the
    // final flash) play out, and on the frame the result appears: its delay outlasts every effect,
    // so without this the result (and its buttons) would wait for some unrelated redraw.
    const running = playback.world.match.status === 'running';
    const busy = wasBusy || isClockBusy(playback.clock);
    const resultAppeared = effects.resultVisible(playback.effectMs) !== resultWasShown;
    if (
      running ||
      outcome.ticks.length > 0 ||
      busy ||
      resultAppeared ||
      effects.isActive(playback.effectMs)
    ) {
      render();
    }
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
if (seriesLink?.setup !== undefined) series.start(seriesLink.setup, true);
else if (mode === 'series') series.showBuilder(seriesLink?.lineup, seriesLink?.format);
else showControls();
requestAnimationFrame(frame);
