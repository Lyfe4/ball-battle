import './style.css';
import { screenKeyOf } from './app/history-rules.ts';
import { createNavigation } from './app/navigation.ts';
import {
  parseRoute,
  writeHomeParams,
  writeManualParams,
  writeModesParams,
  type Route,
} from './app/route.ts';
import { writeMainModeParams } from './app/modes.ts';
import { createRouter } from './app/router.ts';
import { initialAppState, isSetupScreen, screenTitle } from './app/screen-rules.ts';
import { generateSeed } from './app/fresh-seed.ts';
import { readMode } from './app/series-url.ts';
import { loadSpeed, playbackSpeedFor, saveSpeed, type PlaybackSpeed } from './app/speed.ts';
import { browserStorage as storage } from './app/storage.ts';
import { createTips } from './app/tips.ts';
import { createArena } from './arena.ts';
import { createHomeController } from './screens/home.ts';
import { createBallLink, createManualScreen } from './screens/manual.ts';
import { createModesScreen } from './screens/modes.ts';
import { createOutdatedController } from './screens/outdated.ts';
import { createQuickController } from './screens/quick.ts';
import { createSeriesScreens } from './screens/series.ts';
import { BALL_LOOKUP, BALLS } from './sim/balls/index.ts';
import { getDefinition } from './sim/definitions.ts';
import type { WorldState } from './sim/types.ts';
import { createWorld } from './sim/world.ts';
import { createHud } from './ui/hud.ts';
import { getElement } from './ui/dom.ts';
import { createSpeedToggle } from './ui/speed-toggle.ts';
import { installSettings, refreshSettings } from './ui/settings-menu.ts';
import { installSymbolTooltips } from './ui/symbol-tooltip.ts';

const stage = getElement('stage', HTMLElement);
// What each symbol means, on hover with a mouse or on keyboard focus (never on touch).
installSymbolTooltips();
const canvas = getElement('arena', HTMLCanvasElement);
const hudRoot = getElement('hud-status', HTMLDivElement);
const speedRoot = getElement('hud-speed', HTMLDivElement);

// Which screen a URL is on, for the Back rules (ADR 0025); no series replay is needed for that.
const navigation = createNavigation(window, (url) =>
  screenKeyOf(parseRoute(url.searchParams, BALL_LOOKUP, false)),
);
const currentRoute = (): Route =>
  parseRoute(new URL(window.location.href).searchParams, BALL_LOOKUP);
const initialRoute = currentRoute();
const state = initialAppState(initialRoute, loadSpeed(storage), generateSeed);
const tips = createTips(storage);
/** The match on the arena has ended and its result is showing. */
let matchOver = false;

const hud = createHud(hudRoot, BALL_LOOKUP, {
  onReplay: () => {
    quick.startMatch(state.matchup, state.seed);
  },
  onNewMatch: () => {
    quick.startMatch(state.matchup, generateSeed());
  },
});

/**
 * Moves to the screen `write` describes by the Back rules (ADR 0025) and shows it: at once, or once
 * the browser has gone back to it.
 */
function go(write: (params: URLSearchParams) => void): void {
  if (navigation.go(write) !== 'return') showCurrentRoute();
}

/** Shows another screen in place of this entry: the parent a Back falls back to. */
function replaceWith(write: (params: URLSearchParams) => void): void {
  navigation.replace(write);
  showCurrentRoute();
}

function showCurrentRoute(): void {
  router.show(currentRoute());
}

/** Moves to the home screen, or puts it in place of this entry (a parent fallback). */
function goHome(how: 'go' | 'replace' = 'go'): void {
  if (how === 'replace') replaceWith(writeHomeParams);
  else go(writeHomeParams);
}

const ballLink = createBallLink(go);

const home = createHomeController(getElement('home', HTMLElement), BALLS, BALL_LOOKUP, {
  showWorld,
  play: () => {
    go(writeMainModeParams);
  },
  modes: () => {
    go(writeModesParams);
  },
  held: () => series.held(),
  resume: () => {
    seriesScreens.resume();
  },
  newSeries: () => {
    series.forget();
    go(writeMainModeParams);
  },
  manual: () => {
    go((url) => {
      writeManualParams(url);
    });
  },
});

const manual = createManualScreen(getElement('manual', HTMLElement), BALLS, {
  go,
  back: () => {
    navigation.back(() => {
      goHome('replace');
    });
  },
});

const modes = createModesScreen(getElement('modes', HTMLElement), {
  go,
  back: () => {
    navigation.back(() => {
      goHome('replace');
    });
  },
  freePlay: () => home.demo(),
});

const outdated = createOutdatedController(getElement('outdated', HTMLElement), {
  navigation,
  showCurrentRoute,
  goHome,
});

const quick = createQuickController(
  getElement('quick-setup', HTMLElement),
  getElement('match-actions', HTMLDivElement),
  BALLS,
  BALL_LOOKUP,
  {
    navigation,
    go,
    state,
    showWorld,
    goHome,
    started: () => {
      arena.focus();
    },
    ballLink,
  },
);

const seriesScreens = createSeriesScreens(
  {
    setup: getElement('series-setup', HTMLElement),
    play: {
      panel: getElement('series', HTMLElement),
      exit: getElement('series-exit', HTMLElement),
    },
  },
  BALLS,
  BALL_LOOKUP,
  {
    navigation,
    go,
    replaceWith,
    showWorld,
    showFinished: (world, seed) => {
      showWorld(world, seed, true);
    },
    storage,
    worldsShown: () => worldsShown,
    started: () => {
      arena.focus();
    },
    layoutChanged: showControls,
    redraw: () => {
      arena.redraw();
    },
    exitToHome: () => {
      goHome('replace');
    },
    exitToModes: () => {
      replaceWith(writeModesParams);
    },
  },
);

const { setup: seriesSetup, play: series } = seriesScreens;

const router = createRouter(
  {
    home: {
      show: () => {
        home.open();
      },
      leave: () => {
        home.leave();
      },
    },
    modes: {
      show: () => {
        modes.show();
      },
    },
    manual: {
      show: (route) => {
        manual.show(route.ball, route.chart);
        const ball = BALL_LOOKUP.get(route.ball ?? '');
        if (ball !== undefined) document.title = screenTitle('manual', undefined, ball.name);
      },
    },
    pick: {
      show: (route) => {
        quick.open(route.matchup);
      },
    },
    outdated: {
      show: (route) => {
        outdated.show(route);
      },
    },
    match: {
      show: (route, from) => {
        quick.showMatch(route, from);
      },
    },
    series: seriesScreens.screen,
  },
  initialRoute.screen,
  showControls,
);

const arena = createArena(
  canvas,
  getElement('arena-container', HTMLDivElement),
  BALL_LOOKUP,
  createWorld(state.seed, [
    getDefinition(BALL_LOOKUP, state.matchup.a),
    getDefinition(BALL_LOOKUP, state.matchup.b),
  ]),
  {
    // Nothing plays behind a setup screen, nor on home while the demo waits (reduced motion): it
    // holds the frame after its intro, so both balls show.
    isPaused: () =>
      isSetup() || (router.current() === 'home' && home.isWaiting() && arena.introOver()),
    speed: () => playbackSpeedFor(router.current(), state.speed),
    afterTicks: (world) => {
      series.settle(world);
    },
    tips,
    moment: () =>
      router.current() === 'home' ? 'demo' : router.current() === 'series' ? 'series' : 'quick',
    drawn: (world, resultShown, celebrated) => {
      hud.update(world, resultShown);
      // A finished Free play match has no use for speed: it makes way (ADR 0039).
      const over = world.match.status === 'finished' && resultShown;
      if (over !== matchOver) {
        matchOver = over;
        showControls();
      }
      // The round screen waits for the Winner sticker's moment (ADR 0033).
      series.update(world, celebrated);
      if (router.current() === 'home') home.drawn(resultShown);
    },
  },
);

/** One remembered speed: the in-fight buttons and the settings menu both show and change it. */
function setSpeed(next: PlaybackSpeed): void {
  state.speed = next;
  saveSpeed(storage, next);
  speedToggle.select(next);
  refreshSettings();
}
const speedToggle = createSpeedToggle(speedRoot, state.speed, setSpeed);
installSettings({ tips, speed: () => state.speed, setSpeed, court: arena.court });

/** Every world put on the arena so far: a held series checks whether its match is still there. */
let worldsShown = 0;

/**
 * Puts a new world on screen: playback, effects and the HUD start over. `finished` shows a match
 * that has already ended as it ended, with no intro or Fight! (a round's result after a reload).
 */
function showWorld(world: WorldState, shownSeed: number, finished = false): void {
  worldsShown += 1;
  state.seed = shownSeed;
  hud.setMatch(world);
  arena.show(world, finished);
}

/** A setup screen is up (choosing balls, or setting up a series): no match is being watched. */
const isSetup = () => isSetupScreen(router.current(), series.isPlaying());

/** Which controls show on the screen: home, a setup alone, or the match with its controls. */
function showControls(): void {
  const screen = router.current();
  const setup = isSetup();
  stage.toggleAttribute('data-setup', setup);
  stage.toggleAttribute('data-home', screen === 'home');
  stage.dataset['screen'] = screen;
  home.setVisible(screen === 'home');
  manual.setVisible(screen === 'manual');
  modes.setVisible(screen === 'modes');
  outdated.setVisible(screen === 'outdated');
  quick.setVisible(screen === 'pick' || screen === 'match' ? screen : 'other');
  seriesSetup.setVisible(screen === 'series' && setup);
  // Between series rounds and at the end the arena, health and speed make way for the round
  // screen (ADR 0025): the track and the result say what they would.
  const roundOver =
    screen === 'series' && series.phase() !== undefined && series.phase() !== 'playing';
  stage.toggleAttribute('data-round-over', roundOver);
  hudRoot.hidden = setup || screen === 'home' || roundOver;
  speedRoot.hidden = setup || screen === 'home' || roundOver || (screen === 'match' && matchOver);
  series.setVisible(screen === 'series');
  hud.setSeriesMode(series.isPlaying());
  // A series screen's title names its length (ADR 0048).
  document.title = screenTitle(
    screen,
    readMode(new URLSearchParams(window.location.search).get('mode')),
  );
}

navigation.onChange(showCurrentRoute);

// Something is on the arena from the first frame: the link's match (its URL corrected if an id was
// invalid), or a match behind a setup screen, which keeps its own URL; home puts on its demo.
router.show(initialRoute);
