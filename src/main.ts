import './style.css';
import { DEFAULT_MATCHUP, writeMatchParams, type Matchup } from './app/matchup.ts';
import { clearView, parseRoute, writePickParams, type Route, type Screen } from './app/route.ts';
import { generateSeed } from './app/seed.ts';
import { clearSeriesParams, writeSeriesModeParams } from './app/series-url.ts';
import { loadSpeed, saveSpeed, type PlaybackSpeed } from './app/speed.ts';
import { createArena } from './arena.ts';
import { createNavigation } from './navigation.ts';
import { createSeriesController } from './series-controller.ts';
import { BALL_LOOKUP, BALLS } from './sim/balls/index.ts';
import { getDefinition } from './sim/definitions.ts';
import type { WorldState } from './sim/types.ts';
import { createWorld } from './sim/world.ts';
import { element } from './ui/dom.ts';
import { createHud } from './ui/hud.ts';
import { createQuickSetup } from './ui/quick-setup.ts';
import { createSegmented } from './ui/segmented.ts';
import { createSpeedToggle } from './ui/speed-toggle.ts';

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}`);
  }
  return found;
}

const stage = getElement('stage', HTMLElement);
const canvas = getElement('arena', HTMLCanvasElement);
const container = getElement('arena-container', HTMLDivElement);
const hudRoot = getElement('hud-status', HTMLDivElement);
const quickSetupRoot = getElement('quick-setup', HTMLElement);
const matchActions = getElement('match-actions', HTMLDivElement);
const speedRoot = getElement('hud-speed', HTMLDivElement);
const modeRoot = getElement('mode-toggle', HTMLDivElement);
const lineupRoot = getElement('lineup', HTMLElement);
const seriesRoot = getElement('series', HTMLElement);

const ballIds = BALLS.map((ball) => ball.id);
const navigation = createNavigation();
const currentRoute = (): Route => parseRoute(new URL(window.location.href).searchParams, ballIds);
const initialRoute = currentRoute();
type Mode = 'quick' | 'series';
let screen: Screen = initialRoute.screen;
let matchup: Matchup = initialRoute.screen === 'series' ? DEFAULT_MATCHUP : initialRoute.matchup;
let seed = (initialRoute.screen === 'match' ? initialRoute.seed : undefined) ?? generateSeed();
// Remembered per viewer. Reading localStorage itself can throw, hence the getter.
const storage = () => window.localStorage;
let speed: PlaybackSpeed = loadSpeed(storage);

const TITLES: Readonly<Record<Screen, string>> = {
  pick: 'Quick match · BallBattle',
  match: 'BallBattle',
  series: 'Best of 3 · BallBattle',
};

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

const quickSetup = createQuickSetup(quickSetupRoot, BALLS, {
  onStart: (chosen) => {
    navigation.push((url) => {
      writeMatchUrl(url, chosen, generateSeed());
    });
    showRoute(currentRoute());
    canvas.focus();
  },
  onChange: (chosen) => {
    navigation.replace((url) => {
      writePickParams(url, chosen);
    });
  },
  // A visitor who arrived on the setup from a link goes back to a match of the balls shown.
  onBack: () => {
    navigation.back(() => {
      navigation.replace((url) => {
        writeMatchUrl(url, matchup, generateSeed());
      });
      showRoute(currentRoute());
    });
  },
});

const changeBalls = element('button', 'hud-button', 'Change balls');
changeBalls.type = 'button';
changeBalls.addEventListener('click', () => {
  navigation.push((url) => {
    writePickParams(url, matchup);
  });
  showRoute(currentRoute());
});
matchActions.append(changeBalls);

const modeToggle = createSegmented<Mode>(
  modeRoot,
  'mode-toggle',
  'Mode',
  [
    { value: 'quick', text: 'Quick match' },
    { value: 'series', text: 'Best of 3' },
  ],
  screen === 'series' ? 'series' : 'quick',
  (next) => {
    navigation.push((url) => {
      if (next === 'series') writeSeriesModeParams(url);
      else writeMatchUrl(url, matchup, generateSeed());
    });
    showRoute(currentRoute());
  },
);

const series = createSeriesController(
  { lineup: lineupRoot, series: seriesRoot },
  BALLS,
  BALL_LOOKUP,
  {
    showWorld,
    replaceUrl: (write) => {
      navigation.replace(write);
    },
    layoutChanged: showControls,
    redraw: () => {
      hud.setMatch(arena.world());
      arena.redraw();
    },
  },
);

const arena = createArena(canvas, container, BALL_LOOKUP, createMatchWorld(matchup, seed), {
  // The match waits while it is covered: during the quick-match setup and while the lineup dialog
  // is open. It carries on where it stopped.
  isPaused: () => screen === 'pick' || series.isOpen(),
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

function writeMatchUrl(url: URLSearchParams, next: Matchup, nextSeed: number): void {
  clearView(url);
  clearSeriesParams(url);
  writeMatchParams(url, next, nextSeed);
}

/** Which controls show on the screen: the setup alone, or the match with its controls. */
function showControls(): void {
  const setup = screen === 'pick';
  stage.toggleAttribute('data-setup', setup);
  quickSetup.setVisible(setup);
  modeRoot.hidden = setup;
  hudRoot.hidden = setup;
  speedRoot.hidden = setup;
  matchActions.hidden = screen !== 'match';
  series.setVisible(screen === 'series');
  hud.setSeriesMode(series.isPlaying());
  document.title = TITLES[screen];
}

/**
 * Starts (or restarts) a match. The matchup and seed are written to the URL, so reloading or
 * sharing the link replays the same match, and a link with an invalid id is corrected.
 */
function startMatch(nextMatchup: Matchup, nextSeed: number): void {
  matchup = nextMatchup;
  navigation.replace((url) => {
    writeMatchUrl(url, matchup, nextSeed);
  });
  showWorld(createMatchWorld(matchup, nextSeed), nextSeed);
}

/** Opens the screen a URL asks for: on load, after the app moves screens, and on Back and Forward. */
function showRoute(route: Route): void {
  const from = screen;
  screen = route.screen;
  modeToggle.select(screen === 'series' ? 'series' : 'quick');
  if (route.screen === 'pick') {
    series.leave();
    showControls();
    quickSetup.open(route.matchup);
    return;
  }
  if (route.screen === 'match') {
    series.leave();
    showControls();
    // Back from the setup to the match it covered: carry on with it rather than restarting.
    const same = route.matchup.a === matchup.a && route.matchup.b === matchup.b;
    if (from === 'pick' && same && route.seed === seed) return;
    startMatch(route.matchup, route.seed ?? generateSeed());
    return;
  }
  series.leave();
  if (route.link.setup !== undefined) series.start(route.link.setup, true);
  else series.showBuilder(route.link.lineup, route.link.format);
}

navigation.onChange(() => {
  showRoute(currentRoute());
});

// Something is on the arena from the first frame: the link's match (its URL corrected if an id was
// invalid), or a quick match behind a setup screen, which keeps its own URL.
if (initialRoute.screen === 'match') {
  startMatch(matchup, seed);
  showControls();
} else {
  showWorld(createMatchWorld(matchup, seed), seed);
  showRoute(initialRoute);
}
