import './style.css';
import { DEFAULT_MATCHUP, type Matchup } from './app/matchup.ts';
import {
  parseRoute,
  writeHomeParams,
  writeManualParams,
  writeMatchUrl,
  writePickParams,
  type Route,
  type Screen,
} from './app/route.ts';
import { generateSeed } from './app/seed.ts';
import { writeSeriesModeParams } from './app/series-url.ts';
import { loadSpeed, saveSpeed, type PlaybackSpeed } from './app/speed.ts';
import { createArena } from './arena.ts';
import { createHomeController } from './home-controller.ts';
import { createNavigation } from './navigation.ts';
import { createQuickController } from './quick-controller.ts';
import { createSeriesScreens } from './series-screens.ts';
import { BALL_LOOKUP, BALLS } from './sim/balls/index.ts';
import { getDefinition } from './sim/definitions.ts';
import type { WorldState } from './sim/types.ts';
import { createWorld } from './sim/world.ts';
import { createHud } from './ui/hud.ts';
import { createManual } from './ui/manual/manual.ts';
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
const hudRoot = getElement('hud-status', HTMLDivElement);
const speedRoot = getElement('hud-speed', HTMLDivElement);

const ballIds = BALLS.map((ball) => ball.id);
const navigation = createNavigation();
const currentRoute = (): Route => parseRoute(new URL(window.location.href).searchParams, ballIds);
const initialRoute = currentRoute();
let screen: Screen = initialRoute.screen;
let matchup: Matchup = 'matchup' in initialRoute ? initialRoute.matchup : DEFAULT_MATCHUP;
let seed = (initialRoute.screen === 'match' ? initialRoute.seed : undefined) ?? generateSeed();
// Remembered per viewer. Reading localStorage itself can throw, hence the getter.
const storage = () => window.localStorage;
let speed: PlaybackSpeed = loadSpeed(storage);

const TITLES: Readonly<Record<Screen, string>> = {
  home: 'BallBattle: an auto-battler of counters',
  pick: 'Quick match · BallBattle',
  match: 'Quick match · BallBattle',
  series: 'Best of 3 · BallBattle',
  manual: 'Ball manual · BallBattle',
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

/** Moves to the home screen: a new history entry, or in place of this one (a parent fallback). */
function goHome(how: 'push' | 'replace' = 'push'): void {
  navigation[how](writeHomeParams);
  showRoute(currentRoute());
}

const home = createHomeController(getElement('home', HTMLElement), BALLS, BALL_LOOKUP, {
  showWorld,
  play: (chosen) => {
    navigation.push((url) => {
      writePickParams(url, chosen);
    });
    screen = 'pick';
    home.leave();
    showControls();
    quick.open(chosen, 'start');
  },
  series: () => {
    navigation.push((url) => {
      writeSeriesModeParams(url);
    });
    showRoute(currentRoute());
  },
  manual: () => {
    navigation.push((url) => {
      writeManualParams(url);
    });
    showRoute(currentRoute());
  },
});

const manual = createManual(getElement('manual', HTMLElement), BALLS, {
  onBack: () => {
    navigation.back(() => {
      goHome('replace');
    });
  },
  onOpen: (ball, how) => {
    navigation[how]((url) => {
      writeManualParams(url, { ball });
    });
    showRoute(currentRoute());
  },
  onTry: (chosen) => {
    navigation.push((url) => {
      writePickParams(url, chosen);
    });
    showRoute(currentRoute());
  },
});

const quick = createQuickController(
  getElement('quick-setup', HTMLElement),
  getElement('match-actions', HTMLDivElement),
  BALLS,
  {
    navigation,
    showCurrentRoute: () => {
      showRoute(currentRoute());
    },
    matchup: () => matchup,
    goHome: (how) => {
      goHome(how);
    },
    started: () => {
      canvas.focus();
    },
  },
);

const { setup: seriesSetup, play: series } = createSeriesScreens(
  { setup: getElement('series-setup', HTMLElement), play: getElement('series', HTMLElement) },
  BALLS,
  BALL_LOOKUP,
  {
    navigation,
    showWorld,
    showCurrentRoute: () => {
      showRoute(currentRoute());
    },
    started: () => {
      screen = 'series';
      canvas.focus();
    },
    layoutChanged: showControls,
    exitToHome: () => {
      goHome('replace');
    },
  },
);

const arena = createArena(
  canvas,
  getElement('arena-container', HTMLDivElement),
  BALL_LOOKUP,
  createMatchWorld(matchup, seed),
  {
    // Nothing plays behind a setup screen, nor on home while the demo waits (reduced motion): it
    // holds the frame after its intro, so both balls show.
    isPaused: () => isSetup() || (screen === 'home' && home.isWaiting() && arena.introOver()),
    speed: () => speed,
    afterTicks: (world) => {
      series.settle(world);
    },
    drawn: (world, resultShown) => {
      hud.update(world, seed, resultShown);
      series.update(world, resultShown);
      if (screen === 'home') home.drawn(resultShown);
    },
  },
);

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

/** A setup screen is up (choosing balls, or setting up a series): no match is being watched. */
function isSetup(): boolean {
  return screen === 'pick' || screen === 'manual' || (screen === 'series' && !series.isPlaying());
}

/** Which controls show on the screen: home, a setup alone, or the match with its controls. */
function showControls(): void {
  const setup = isSetup();
  stage.toggleAttribute('data-setup', setup);
  stage.toggleAttribute('data-home', screen === 'home');
  stage.dataset['screen'] = screen;
  home.setVisible(screen === 'home');
  manual.setVisible(screen === 'manual');
  quick.setVisible(screen === 'pick' || screen === 'match' ? screen : 'other');
  seriesSetup.setVisible(screen === 'series' && setup);
  hudRoot.hidden = setup || screen === 'home';
  speedRoot.hidden = setup || screen === 'home';
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
  if (route.screen !== 'home') home.leave();
  if (route.screen !== 'series') series.leave();
  if (route.screen === 'home') {
    showControls();
    home.open();
    return;
  }
  if (route.screen === 'manual') {
    showControls();
    manual.show(route.ball);
    const ball = BALL_LOOKUP.get(route.ball ?? '');
    if (ball !== undefined) document.title = `${ball.name} · ${TITLES.manual}`;
    return;
  }
  if (route.screen === 'pick') {
    showControls();
    quick.open(route.matchup);
    return;
  }
  if (route.screen === 'match') {
    showControls();
    // Back from the setup to the match it covered: carry on with it rather than restarting.
    const same = route.matchup.a === matchup.a && route.matchup.b === matchup.b;
    if (from === 'pick' && same && route.seed === seed) return;
    startMatch(route.matchup, route.seed ?? generateSeed());
    return;
  }
  if (route.step === 'play') {
    if (route.link.setup !== undefined) {
      series.start(route.link.setup, true);
      return;
    }
    // Forward into a series the player left, or a reload mid-series: the bot's lineup is gone, so
    // set up again from the lineup.
    if (!series.isPlaying()) {
      navigation.replace((url) => {
        writeSeriesModeParams(url, route.link.format, 'lineup');
      });
      showRoute(currentRoute());
    }
    showControls();
    return;
  }
  series.leave();
  showControls();
  seriesSetup.show(route.step, route.link);
}

navigation.onChange(() => {
  showRoute(currentRoute());
});

// Something is on the arena from the first frame: the link's match (its URL corrected if an id was
// invalid), or a match behind a setup screen, which keeps its own URL; home puts on its demo.
if (initialRoute.screen === 'match') {
  startMatch(matchup, seed);
  showControls();
} else {
  showWorld(createMatchWorld(matchup, seed), seed);
  showRoute(initialRoute);
}
