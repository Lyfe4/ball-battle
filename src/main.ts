import './style.css';
import { DEFAULT_MATCHUP, writeMatchParams, type Matchup } from './app/matchup.ts';
import { parseRoute, type Route } from './app/route.ts';
import { generateSeed } from './app/seed.ts';
import { clearSeriesParams, writeSeriesModeParams } from './app/series-url.ts';
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

const currentRoute = (): Route => parseRoute(new URL(window.location.href).searchParams, ballIds);
const initialRoute = currentRoute();
type Mode = 'quick' | 'series';
let mode: Mode = initialRoute.screen === 'series' ? 'series' : 'quick';
let matchup: Matchup = initialRoute.screen === 'match' ? initialRoute.matchup : DEFAULT_MATCHUP;
let seed = (initialRoute.screen === 'match' ? initialRoute.seed : undefined) ?? generateSeed();
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

/** Rewrites the URL of the screen on show (a new seed, a format), adding no history entry. */
function replaceUrl(write: (params: URLSearchParams) => void): void {
  const url = new URL(window.location.href);
  write(url.searchParams);
  window.history.replaceState(null, '', url);
}

/** Moves to another screen: a history entry, so Back returns. The same URL again adds nothing. */
function pushUrl(write: (params: URLSearchParams) => void): void {
  const url = new URL(window.location.href);
  write(url.searchParams);
  if (url.href !== window.location.href) window.history.pushState(null, '', url);
}

/** Which controls show for the mode: the picker, the lineup builder or the scoreboard. */
function showControls(): void {
  pickerForm.hidden = mode !== 'quick';
  series.setVisible(mode === 'series');
  hud.setSeriesMode(series.isPlaying());
}

function setMode(next: Mode): void {
  pushUrl((url) => {
    if (next === 'series') writeSeriesModeParams(url);
    else clearSeriesParams(url);
  });
  showMode(next);
}

function showMode(next: Mode): void {
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

/** Opens the screen a URL asks for: on load (for a series), and on Back and Forward. */
function showRoute(route: Route): void {
  series.leave();
  mode = route.screen === 'series' ? 'series' : 'quick';
  modeToggle.select(mode);
  if (route.screen === 'match') {
    showControls();
    startMatch(route.matchup, route.seed ?? generateSeed());
  } else if (route.link.setup !== undefined) {
    series.start(route.link.setup, true);
  } else {
    series.showBuilder(route.link.lineup, route.link.format);
  }
}

window.addEventListener('popstate', () => {
  showRoute(currentRoute());
});

// The link's match, or a quick match behind the series setup, is on the arena from the start.
startMatch(matchup, seed);
if (initialRoute.screen === 'series') showRoute(initialRoute);
else showControls();
