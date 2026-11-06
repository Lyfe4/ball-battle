import './style.css';
import { screenKeyOf } from './app/history-rules.ts';
import { createNavigation } from './app/navigation.ts';
import {
  parseRoute,
  writeHomeParams,
  writeManualParams,
  writePickParams,
  type Route,
  type Screen,
} from './app/route.ts';
import { createRouter } from './app/router.ts';
import { initialAppState, seriesRound } from './app/screen-rules.ts';
import { generateSeed } from './app/seed.ts';
import { writeSeriesModeParams } from './app/series-url.ts';
import { loadSpeed, playbackSpeedFor, saveSpeed } from './app/speed.ts';
import { createTips } from './app/tips.ts';
import { createArena } from './arena.ts';
import { createHomeController } from './home-controller.ts';
import { createBallLink, createManualScreen } from './manual-screen.ts';
import { createOutdatedController } from './outdated-screen.ts';
import { createQuickController } from './quick-controller.ts';
import { createSeriesScreens } from './series-screens.ts';
import { BALL_LOOKUP, BALLS } from './sim/balls/index.ts';
import { getDefinition } from './sim/definitions.ts';
import type { WorldState } from './sim/types.ts';
import { createWorld } from './sim/world.ts';
import { createHud } from './ui/hud.ts';
import { createSpeedToggle } from './ui/speed-toggle.ts';
import { installLegendTips } from './ui/symbol-legend.ts';
import { installSymbolTooltips } from './ui/symbol-tooltip.ts';

function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}`);
  }
  return found;
}

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
// Remembered per viewer. Reading localStorage itself can throw, hence the getter.
const storage = () => window.localStorage;
const state = initialAppState(initialRoute, loadSpeed(storage), generateSeed);
const tips = createTips(storage);
installLegendTips(tips);

const TITLES: Readonly<Record<Screen, string>> = {
  home: 'BallBattle: build a lineup, watch it fight',
  pick: 'Free play · BallBattle',
  match: 'Free play · BallBattle',
  series: 'Best of 3 · BallBattle',
  manual: 'Ball manual · BallBattle',
  outdated: 'Link from another version · BallBattle',
};

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
  play: (chosen) => {
    // The setup opens with Start focused, ready for the pair just watched.
    go((url) => {
      writePickParams(url, chosen);
    });
    quick.open(chosen, 'start');
  },
  series: () => {
    go((url) => {
      writeSeriesModeParams(url);
    });
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
      canvas.focus();
    },
    ballLink,
  },
);

const { setup: seriesSetup, play: series } = createSeriesScreens(
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
    worldsShown: () => worldsShown,
    started: () => {
      canvas.focus();
    },
    layoutChanged: showControls,
    redraw: () => {
      arena.redraw();
    },
    exitToHome: () => {
      goHome('replace');
    },
  },
);

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
    manual: {
      show: (route) => {
        manual.show(route.ball, route.chart);
        const ball = BALL_LOOKUP.get(route.ball ?? '');
        if (ball !== undefined) document.title = `${ball.name} · ${TITLES.manual}`;
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
    series: {
      show: (route) => {
        if (route.step !== 'play') {
          // Back (or Leave) keeps an undecided series to resume, with every choice made.
          series.hold();
          showControls();
          seriesSetup.show(route.step, route.link);
          return;
        }
        const round = seriesRound(route.link, series.hasSeries());
        if (round === 'carry on') {
          series.resume();
        } else if (round === 'lineup') {
          navigation.replace((url) => {
            writeSeriesModeParams(url, route.link.format, 'lineup');
          });
          showCurrentRoute();
        } else {
          series.start(round.replay, true);
        }
      },
      leave: () => {
        series.hold();
      },
    },
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
    teaching: () => router.current() !== 'home',
    drawn: (world, resultShown, celebrated) => {
      hud.update(world, resultShown);
      // The round screen waits for the Winner sticker's moment (ADR 0033).
      series.update(world, celebrated);
      if (router.current() === 'home') home.drawn(resultShown);
    },
  },
);

createSpeedToggle(speedRoot, state.speed, (next) => {
  state.speed = next;
  saveSpeed(storage, next);
});

/** Every world put on the arena so far: a held series checks whether its match is still there. */
let worldsShown = 0;

/** Puts a new world on screen: playback, effects and the HUD start over. */
function showWorld(world: WorldState, shownSeed: number): void {
  worldsShown += 1;
  state.seed = shownSeed;
  hud.setMatch(world);
  arena.show(world);
}

/** A setup screen is up (choosing balls, or setting up a series): no match is being watched. */
function isSetup(): boolean {
  const screen = router.current();
  if (screen === 'series') return !series.isPlaying();
  return screen === 'pick' || screen === 'manual' || screen === 'outdated';
}

/** Which controls show on the screen: home, a setup alone, or the match with its controls. */
function showControls(): void {
  const screen = router.current();
  const setup = isSetup();
  stage.toggleAttribute('data-setup', setup);
  stage.toggleAttribute('data-home', screen === 'home');
  stage.dataset['screen'] = screen;
  home.setVisible(screen === 'home');
  manual.setVisible(screen === 'manual');
  outdated.setVisible(screen === 'outdated');
  quick.setVisible(screen === 'pick' || screen === 'match' ? screen : 'other');
  seriesSetup.setVisible(screen === 'series' && setup);
  // Between series rounds and at the end the arena, health and speed make way for the round
  // screen (ADR 0025): the track and the result say what they would.
  const roundOver =
    screen === 'series' && series.phase() !== undefined && series.phase() !== 'playing';
  stage.toggleAttribute('data-round-over', roundOver);
  hudRoot.hidden = setup || screen === 'home' || roundOver;
  speedRoot.hidden = setup || screen === 'home' || roundOver;
  series.setVisible(screen === 'series');
  hud.setSeriesMode(series.isPlaying());
  document.title = TITLES[screen];
}

navigation.onChange(showCurrentRoute);

// Something is on the arena from the first frame: the link's match (its URL corrected if an id was
// invalid), or a match behind a setup screen, which keeps its own URL; home puts on its demo.
router.show(initialRoute);
