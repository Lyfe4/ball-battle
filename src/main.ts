import './style.css';
import { parseMatchup, writeMatchParams, type Matchup } from './app/matchup.ts';
import { generateSeed, parseSeed } from './app/seed.ts';
import { clearSeriesParams, parseSeriesParams } from './app/series-url.ts';
import { loadSpeed, saveSpeed, type PlaybackSpeed } from './app/speed.ts';
import { createArena } from './arena.ts';
import { createSeriesController } from './series-controller.ts';
import { BALL_LOOKUP, BALLS } from './sim/balls/index.ts';
import { getDefinition } from './sim/definitions.ts';
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

const canvas = getElement('arena', HTMLCanvasElement);
const container = getElement('arena-container', HTMLDivElement);
const hudRoot = getElement('hud-status', HTMLDivElement);
const pickerForm = getElement('picker', HTMLFormElement);
const speedRoot = getElement('hud-speed', HTMLDivElement);
const modeRoot = getElement('mode-toggle', HTMLDivElement);
const lineupRoot = getElement('lineup', HTMLElement);
const seriesRoot = getElement('series', HTMLElement);

const ballIds = BALLS.map((ball) => ball.id);

const params = new URL(window.location.href).searchParams;
const seriesLink = parseSeriesParams(params, ballIds);
type Mode = 'quick' | 'series';
let mode: Mode = seriesLink === undefined ? 'quick' : 'series';
let matchup = parseMatchup(params, ballIds);
let seed = parseSeed(params.get('seed')) ?? generateSeed();
// Remembered per viewer. Reading localStorage itself can throw, hence the getter.
const storage = () => window.localStorage;
let speed: PlaybackSpeed = loadSpeed(storage);

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
      hud.setMatch(arena.world());
      arena.redraw();
    },
  },
);

const arena = createArena(canvas, container, BALL_LOOKUP, createMatchWorld(matchup, seed), {
  // The match pauses while the ball picker is open, whether or not a pick changed (a new pick only
  // takes effect on Start match).
  isPaused: () => picker.isOpen() || series.isOpen(),
  speed: () => speed,
  afterTicks: (world) => {
    series.settle(world);
  },
  drawn: (world, resultShown) => {
    hud.update(world, seed, resultShown);
    series.update(world, resultShown);
  },
});

createSpeedToggle(speedRoot, speed, (next) => {
  speed = next;
  saveSpeed(storage, next);
});

/** Puts a new world on screen: playback, effects and the HUD start over. */
function showWorld(world: WorldState, shownSeed: number): void {
  seed = shownSeed;
  hud.setMatch(world);
  arena.show(world);
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

startMatch(matchup, seed);
if (seriesLink?.setup !== undefined) series.start(seriesLink.setup, true);
else if (mode === 'series') series.showBuilder(seriesLink?.lineup, seriesLink?.format);
else showControls();
