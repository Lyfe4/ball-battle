// The shell (ADR 0081) wired to the page: the tab bar on the tab screens, and the Ranks tab
// (ranks.ts). Profile and Friends are the online mount's (profile.ts, friends-tab.ts); where a build
// has none of them, their routes are home. main.ts hands over how to move.
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
import { friendsTabLabel } from './friends-text.ts';
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';
import { writeSendParams } from '../app/online-url.ts';
import { createRanks } from './ranks.ts';

export type ShellScreensHost = Pick<Moves, 'go' | 'goHome' | 'backOrHome'>;

export interface ShellScreens {
  readonly handlers: { readonly [S in ShellView]: ScreenHandler<S> };
  /** Lays the shell out for the screen on show: Ranks, and the bar on a tab screen. */
  setVisible(screen: Screen): void;
  /** What waits on the player: the Friends tab's badge (ADR 0081). */
  waiting(count: number): void;
}

/** A tab's URL, written over the current one. */
function writeTab(params: URLSearchParams, tab: Tab): void {
  if (tab.screen === 'home') writeHomeParams(params);
  else if (tab.screen === 'manual') writeManualParams(params);
  else if (tab.screen === 'friends' || tab.screen === 'ranks') writeShellParams(params, tab.screen);
}

/** Ranks and the tab bar, wired: Back by the rules (ADR 0025), each button to its screen. */
export function mountShell(root: HTMLElement, host: ShellScreensHost): ShellScreens {
  // Ranks only in a build with accounts (previews, staging): production's bundle holds none of it.
  const ranks = ACCOUNTS_BUILD
    ? createRanks(root, {
        back: host.backOrHome,
        playFriend: () => {
          host.go((url) => {
            writeSendParams(url, 'reveal', 3);
          });
        },
      })
    : undefined;
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
  return {
    handlers: {
      ranks: {
        show: () => {
          if (ranks === undefined) host.goHome();
          else ranks.show();
        },
      },
      // Drawn by the online mount where the build has them, which replaces these; a build without
      // never routes here (their URLs open home), so these are only the safe way out.
      friends: { show: host.goHome },
      profile: { show: host.goHome },
    },
    waiting(count) {
      bar.badge('friends', count, friendsTabLabel(count));
    },
    setVisible(current) {
      ranks?.setVisible(current === 'ranks');
      // The bar follows the URL's screen key: the manual's index wears it, a ball's page doesn't.
      const route = parseRoute(new URLSearchParams(window.location.search), BALL_LOOKUP, false);
      bar.show(route.screen === current ? tabOf(screenKeyOf(route)) : undefined);
    },
  };
}
