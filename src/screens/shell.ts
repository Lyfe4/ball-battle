// The shell (ADR 0081) wired to the page: the tab bar on the tab screens, and the Ranks placeholder
// until its own pull request. Profile and Friends are the online mount's (profile.ts,
// friends-tab.ts); where a build has none, their routes are home. main.ts hands over how to move.
import type { Moves } from '../app/moves.ts';
import {
  parseRoute,
  writeHomeParams,
  writeManualParams,
  writeShellParams,
  type Screen,
  type ShellView,
} from '../app/route.ts';
import type { ScreenHandler } from '../app/router.ts';
import { screenKeyOf } from '../app/history-rules.ts';
import { tabOf, TABS, type Tab } from '../app/tabs.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { createTabBar } from '../ui/tab-bar.ts';
import { createShellPlaceholder } from './shell-placeholder.ts';
import { PLACEHOLDER_VIEWS, type PlaceholderView } from './shell-placeholder-text.ts';

export type ShellScreensHost = Pick<Moves, 'go' | 'goHome' | 'backOrHome'>;

export interface ShellScreens {
  readonly handlers: { readonly [S in ShellView]: ScreenHandler<S> };
  /** Lays the shell out for the screen on show: its placeholder, and the bar on a tab screen. */
  setVisible(screen: Screen): void;
}

/** A tab's URL, written over the current one. */
function writeTab(params: URLSearchParams, tab: Tab): void {
  if (tab.screen === 'home') writeHomeParams(params);
  else if (tab.screen === 'manual') writeManualParams(params);
  else if (tab.screen === 'friends' || tab.screen === 'ranks') writeShellParams(params, tab.screen);
}

/** The placeholder and the tab bar, wired: Back by the rules (ADR 0025), each button to its screen. */
export function mountShell(root: HTMLElement, host: ShellScreensHost): ShellScreens {
  const screen = createShellPlaceholder(root, {
    back: host.backOrHome,
    // Its one way on is Play.
    open: () => {
      host.goHome();
    },
  });
  const bar = createTabBar(
    TABS,
    (tab) => {
      const url = new URL(window.location.href);
      writeTab(url.searchParams, tab);
      return url.href;
    },
    (tab) => {
      host.go((url) => {
        writeTab(url, tab);
      });
    },
  );
  document.body.append(bar.element);
  const handler = (view: PlaceholderView) => ({
    show: () => {
      screen.show(view);
    },
  });
  return {
    handlers: {
      ranks: handler('ranks'),
      // Drawn by the online mount where the build has them, which replaces these; a build without
      // never routes here (their URLs open home), so these are only the safe way out.
      friends: { show: host.goHome },
      profile: { show: host.goHome },
    },
    setVisible(current) {
      screen.setVisible(PLACEHOLDER_VIEWS.some((view) => view === current));
      // The bar follows the URL's screen key: the manual's index wears it, a ball's page doesn't.
      const route = parseRoute(new URLSearchParams(window.location.search), BALL_LOOKUP, false);
      bar.show(route.screen === current ? tabOf(screenKeyOf(route)) : undefined);
    },
  };
}
