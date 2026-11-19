// Online play on the page, as main.ts sees it (ADR 0052): the router's three online screens, what
// the arena tells a series each frame, and the page's layout. `mountOnline` builds it in a build
// with online play; `offlineMount` (online-off.ts) stands in without it, sending any online URL
// home. main.ts holds one or the other, so it never asks which build it is in again.
import type { Navigation } from '../app/navigation.ts';
import type { Screen } from '../app/route.ts';
import type { ScreenHandlers } from '../app/router.ts';
import { writeSendParams } from '../app/online-url.ts';
import { browserStorage } from '../app/storage.ts';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import type { Arena } from '../arena.ts';
import type { WorldState } from '../sim/types.ts';
import { getElement } from '../ui/dom.ts';
import type { SettingsHost } from '../ui/settings-menu.ts';
import type { SeriesPhase } from '../ui/series-panel.ts';
import { createOnlineScreens } from './online.ts';
import { createRematchWatch } from './rematch-watch.ts';

/** How often home asks again while it shows a way back to a live match. */
const HOME_ASK_MS = 10_000;

export interface OnlineMount {
  readonly handlers: Pick<ScreenHandlers, 'online' | 'challenge' | 'send'>;
  /** Settings' online group, when there is one. */
  readonly settings: Pick<SettingsHost, 'online'>;
  settle(world: WorldState): void;
  update(world: WorldState, celebrated: boolean): void;
  /** The online series is on screen. */
  playing(): boolean;
  /** The arena holds one of its rounds (OnlinePlay.roundOnArena). */
  roundOnArena(): boolean;
  phase(): SeriesPhase | undefined;
  /** The health bars' labels for the online series on screen. */
  sides(): readonly string[] | undefined;
  setVisible(screen: Screen): void;
  /** Home was opened: "Back to your match" asks again. */
  homeShown(): void;
  /** A live match is on screen: its fights play at 1x and the speed toggle makes way (ADR 0053). */
  isLive(): boolean;
  /** A live fight's rate: 1, or a little off while it catches up with the server (ADR 0063). */
  liveRate(playedMs: number): number;
  /**
   * The screen changed (another screen, a fight started or ended): a rematch notice may show, or
   * waits while `fighting` (rematch-watch.ts).
   */
  screenChanged(fighting: boolean): void;
  /**
   * The line under a live fight, where the speed toggle sits: shown on the online screen when a
   * live match is on and the toggle would show (`noSpeed` false). True when the toggle hides.
   */
  footLine(onScreen: boolean, noSpeed: boolean): boolean;
}

export interface MountContext {
  readonly navigation: Navigation;
  go(write: (params: URLSearchParams) => void): void;
  replaceWith(write: (params: URLSearchParams) => void): void;
  goHome(): void;
  showWorld(world: WorldState, seed: number): void;
  /** The arena, for a live round's start, countdown and a fight already under way (ADR 0053). */
  arena(): Pick<Arena, 'release' | 'countdown' | 'showAt'>;
  worldsShown(): number;
  showControls(): void;
  redraw(): void;
}

export function mountOnline(context: MountContext): OnlineMount {
  // The HUD the online screens sit in (beside the offline ones), and its foot for the way out.
  const hud = getElement('hud-status', HTMLElement).parentElement ?? document.body;
  const foot = getElement('hud-speed', HTMLElement).parentElement ?? document.body;
  // A rematch asked while the player is elsewhere in the game reaches them there (rematch-watch.ts).
  let fighting = false;
  const rematchRoot = document.createElement('div');
  document.body.append(rematchRoot);
  const rematchWatch = createRematchWatch(rematchRoot, BALL_LOOKUP, {
    storage: browserStorage,
    go: (write) => {
      context.go(write);
    },
    fighting: () => fighting,
    endScreen: () => screens.play.endScreen(),
  });
  const screens = createOnlineScreens(hud, foot, BALLS, BALL_LOOKUP, {
    ended: (view) => {
      rematchWatch.ended(view);
    },
    navigation: context.navigation,
    go: (write) => {
      context.go(write);
    },
    replaceWith: (write) => {
      context.replaceWith(write);
    },
    home: () => {
      context.goHome();
    },
    friend: () => {
      context.go((url) => {
        writeSendParams(url, 'reveal', 3, 'setup');
      });
    },
    showWorld: (world, seed) => {
      context.showWorld(world, seed);
    },
    holdLive: (world, seed) => {
      context.showWorld(world, seed);
    },
    // Put on screen as any round (the HUD, the seed), then played on to where it has got to.
    showLiveAt: (world, seed, elapsedMs) => {
      context.showWorld(world, seed);
      context.arena().showAt(world, elapsedMs);
    },
    release: () => {
      context.arena().release();
    },
    countdown: (text) => {
      context.arena().countdown(text);
    },
    worldsShown: () => context.worldsShown(),
    layoutChanged: () => {
      context.showControls();
    },
    redraw: () => {
      context.redraw();
    },
    storage: browserStorage,
  });
  const homeRoot = getElement('home', HTMLElement);
  const playRow = homeRoot.querySelector<HTMLElement>('.home-play-row');
  // "Back to your match" takes Play's place while a live match or lobby is on (ADR 0053), and is
  // asked about again every few seconds on home so it goes when the match ends.
  playRow?.before(screens.backToMatch.element);
  let homeAsk: number | undefined;
  const askHome = async (): Promise<void> => {
    if (homeAsk !== undefined) window.clearTimeout(homeAsk);
    homeAsk = undefined;
    const showing = await screens.backToMatch.refresh();
    if (playRow !== null) playRow.hidden = showing;
    if (showing && !homeRoot.hidden) homeAsk = window.setTimeout(() => void askHome(), HOME_ASK_MS);
  };
  // A live fight's line, where the speed toggle sits (it makes way: live fights are 1x only).
  const liveLine = document.createElement('p');
  liveLine.className = 'live-line';
  liveLine.setAttribute('role', 'status');
  liveLine.hidden = true;
  foot.append(liveLine);
  const showLine = () => {
    const text = screens.play.footLine() ?? '';
    if (liveLine.textContent !== text) liveLine.textContent = text;
  };
  return {
    handlers: { online: screens.online, challenge: screens.challenge, send: screens.send },
    settings: { online: screens.forgetMe },
    settle: (world) => {
      screens.play.settle(world);
    },
    update: (world, celebrated) => {
      screens.play.update(world, celebrated);
      if (!liveLine.hidden) showLine();
    },
    playing: () => screens.play.isPlaying(),
    roundOnArena: () => screens.play.roundOnArena(),
    phase: () => screens.play.phase(),
    sides: () => screens.play.sides(),
    setVisible: (screen) => {
      screens.setVisible(screen);
    },
    homeShown: () => {
      void askHome();
    },
    isLive: () => screens.play.isLive(),
    liveRate: (playedMs) => screens.play.liveRate(playedMs),
    screenChanged: (now) => {
      fighting = now;
      rematchWatch.refresh();
    },
    footLine: (onScreen, noSpeed) => {
      const live = onScreen && screens.play.isLive();
      liveLine.hidden = noSpeed || !live;
      if (!liveLine.hidden) showLine();
      return noSpeed || live;
    },
  };
}
