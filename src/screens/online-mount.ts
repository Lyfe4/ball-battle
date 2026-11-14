// Online play on the page, as main.ts sees it (ADR 0052): the router's three online screens, what
// the arena tells a series each frame, and the page's layout. `mountOnline` builds it in a build
// with online play; `offlineMount` (online-off.ts) stands in without it, sending any online URL
// home. main.ts holds one or the other, so it never asks which build it is in again.
import type { Navigation } from '../app/navigation.ts';
import type { Screen } from '../app/route.ts';
import type { ScreenHandlers } from '../app/router.ts';
import { writeModesParams } from '../app/route.ts';
import { browserStorage } from '../app/storage.ts';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import type { WorldState } from '../sim/types.ts';
import { getElement } from '../ui/dom.ts';
import type { SettingsHost } from '../ui/settings-menu.ts';
import type { SeriesPhase } from '../ui/series-panel.ts';
import { createOnlineScreens } from './online.ts';

export interface OnlineMount {
  readonly handlers: Pick<ScreenHandlers, 'online' | 'challenge' | 'send'>;
  /** Settings' online group, when there is one. */
  readonly settings: Pick<SettingsHost, 'online'>;
  settle(world: WorldState): void;
  update(world: WorldState, celebrated: boolean): void;
  /** The online series is on screen. */
  playing(): boolean;
  phase(): SeriesPhase | undefined;
  /** The health bars' labels for the online series on screen. */
  sides(): readonly string[] | undefined;
  setVisible(screen: Screen): void;
  /** Home was opened: "Your turn" asks again. */
  homeShown(): void;
}

export interface MountContext {
  readonly navigation: Navigation;
  go(write: (params: URLSearchParams) => void): void;
  replaceWith(write: (params: URLSearchParams) => void): void;
  goHome(): void;
  showWorld(world: WorldState, seed: number): void;
  worldsShown(): number;
  showControls(): void;
  redraw(): void;
}

export function mountOnline(context: MountContext): OnlineMount {
  // The HUD the online screens sit in (beside the offline ones), and its foot for the way out.
  const hud = getElement('hud-status', HTMLElement).parentElement ?? document.body;
  const foot = getElement('hud-speed', HTMLElement).parentElement ?? document.body;
  const screens = createOnlineScreens(hud, foot, BALLS, BALL_LOOKUP, {
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
    modes: () => {
      context.go(writeModesParams);
    },
    showWorld: (world, seed) => {
      context.showWorld(world, seed);
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
  getElement('home', HTMLElement).querySelector('.home-play-row')?.after(screens.yourTurn.element);
  return {
    handlers: { online: screens.online, challenge: screens.challenge, send: screens.send },
    settings: { online: screens.forgetMe },
    settle: (world) => {
      screens.play.settle(world);
    },
    update: (world, celebrated) => {
      screens.play.update(world, celebrated);
    },
    playing: () => screens.play.isPlaying(),
    phase: () => screens.play.phase(),
    sides: () => screens.play.sides(),
    setVisible: (screen) => {
      screens.setVisible(screen);
    },
    homeShown: () => {
      screens.yourTurn.refresh();
    },
  };
}
