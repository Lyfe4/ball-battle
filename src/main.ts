import './style.css';
import { screenKeyOf } from './app/history-rules.ts';
import { createMoves } from './app/moves.ts';
import { createNavigation } from './app/navigation.ts';
import { parseRoute, writeHomeParams, type Route } from './app/route.ts';
import { ONLINE_BUILD } from './app/online-build.ts';
import { createRouter } from './app/router.ts';
import { initialAppState, isSetupScreen, readyMomentOf, screenTitle } from './app/screen-rules.ts';
import { generateSeed } from './app/fresh-seed.ts';
import { readMode } from './app/series-url.ts';
import { loadSpeed, playbackSpeedFor, saveSpeed, type PlaybackSpeed } from './app/speed.ts';
import { browserStorage as storage } from './app/storage.ts';
import { createTips } from './app/tips.ts';
import { createArena } from './arena.ts';
import { createHomeController } from './screens/home.ts';
import { createBallLink, createManualScreen } from './screens/manual.ts';
import { createOutdatedController } from './screens/outdated.ts';
import { createQuickController } from './screens/quick.ts';
import { mountOnline } from './screens/online-mount.ts';
import { offlineMount } from './screens/online-off.ts';
import { createSeriesScreens } from './screens/series.ts';
import { BALL_LOOKUP, BALLS } from './sim/balls/index.ts';
import { getDefinition } from './sim/definitions.ts';
import type { WorldState } from './sim/types.ts';
import { createWorld } from './sim/world.ts';
import { createHud } from './ui/hud.ts';
import { getElement } from './ui/dom.ts';
import { createSpeedToggle } from './ui/speed-toggle.ts';
import { installSettings, refreshSettings } from './ui/settings-menu.ts';
import { createSoundSettings } from './ui/settings-sound.ts';
import { installSound } from './sound/sound.ts';
import { installSymbolTooltips } from './ui/symbol-tooltip.ts';
import { installFrameMeter } from './ui/frame-meter.ts';

// Sound waits for the first tap, then follows the remembered choice (sound.ts).
installSound(storage);
const stage = getElement('stage', HTMLElement);
// What each symbol means, on hover with a mouse or on keyboard focus (never on touch).
installSymbolTooltips();
// A diagnostic for a real phone: `?frames` shows the frame rate (ADR 0063 addendum).
installFrameMeter(new URL(window.location.href).searchParams);
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

function showCurrentRoute(): void {
  router.show(currentRoute());
}
const { go, replaceWith, goHome } = createMoves(navigation, showCurrentRoute);

const ballLink = createBallLink(go);

const home = createHomeController(getElement('home', HTMLElement), BALLS, BALL_LOOKUP, {
  showWorld,
  go,
  held: () => series.held(),
  resume: () => {
    seriesScreens.resume();
  },
  forget: () => {
    series.forget();
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
  },
);

const { setup: seriesSetup, play: series } = seriesScreens;

// Online play (ADR 0052), only in builds that have it: production holds none of it.
const online = ONLINE_BUILD
  ? mountOnline({
      navigation,
      go,
      replaceWith,
      goHome,
      showWorld,
      arena: () => arena,
      worldsShown: () => worldsShown,
      showControls,
      redraw: () => {
        arena.redraw();
      },
    })
  : offlineMount(() => {
      goHome('replace');
    });

const router = createRouter(
  {
    home: {
      show: () => {
        // An old Other modes link (ADR 0055) opens home: its address says so too.
        if (window.location.search !== '') navigation.replace(writeHomeParams);
        home.open();
        online.homeShown();
      },
      leave: () => {
        home.leave();
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
    ...online.handlers,
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
    // The trail on slow frames; `?smooth=off` (read once, at load) shows a fight without it, to
    // compare on a phone (ADR 0063 addendum).
    smooth: new URL(window.location.href).searchParams.get('smooth') !== 'off',
    // A live fight plays at 1x on both screens, whatever the toggle says (ADR 0053).
    // A live fight plays at 1x, gently catching up with the server's moment (ADR 0053, 0063).
    speed: () =>
      online.isLive()
        ? online.liveRate(arena.playedMs())
        : playbackSpeedFor(router.current(), state.speed),
    afterTicks: (world) => {
      series.settle(world);
      online.settle(world);
    },
    tips,
    moment: () =>
      readyMomentOf(router.current(), seriesOnScreen(), online.isLive(), home.isWaiting()),
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
      online.update(world, celebrated);
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
// A live match plays on the server's clock: settings never make it wait (ADR 0054).
const mayWait = () => !online.isLive();
const settingsHost = {
  tips,
  speed: () => state.speed,
  setSpeed,
  court: arena.court,
  mayWait,
  sound: createSoundSettings(),
};
installSettings({ ...settingsHost, ...online.settings });

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
const seriesOnScreen = () => router.current() === 'series' || router.current() === 'online';
/** The series on screen, offline or online, is being played. */
const seriesPlaying = () => (router.current() === 'online' ? online.playing() : series.isPlaying());
const isSetup = () => isSetupScreen(router.current(), seriesPlaying());

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
  const phase = screen === 'online' ? online.phase() : series.phase();
  const roundOver = seriesOnScreen() && phase !== undefined && phase !== 'playing';
  stage.toggleAttribute('data-round-over', roundOver);
  hudRoot.hidden = setup || screen === 'home' || roundOver;
  const noSpeed = setup || screen === 'home' || roundOver || (screen === 'match' && matchOver);
  // Live fights are 1x only (ADR 0053): a line takes the toggle's place.
  speedRoot.hidden = online.footLine(screen === 'online', noSpeed);
  series.setVisible(screen === 'series');
  online.setVisible(screen);
  hud.setSeriesMode(
    seriesOnScreen() && seriesPlaying(),
    screen === 'online' ? online.sides() : undefined,
  );
  // A series screen's title names its length (ADR 0048); its setup, its opponent (ADR 0055).
  const params = new URLSearchParams(window.location.search);
  const botSetup = screenKeyOf(parseRoute(params, BALL_LOOKUP, false)) === 'series-rules';
  document.title = screenTitle(screen, readMode(params.get('mode')), undefined, botSetup);
}

navigation.onChange(showCurrentRoute);

// Something is on the arena from the first frame: the link's match (its URL corrected if an id was
// invalid), or a match behind a setup screen, which keeps its own URL; home puts on its demo.
router.show(initialRoute);
