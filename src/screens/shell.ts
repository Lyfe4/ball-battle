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
import { shellOf, tabOf, TABS, type Tab } from '../app/tabs.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { createTabBar } from '../ui/tab-bar.ts';
import { friendsTabLabel } from './friends-text.ts';
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';
import { writeSendParams } from '../app/online-url.ts';
import { loadFriendSetup } from '../app/modes.ts';
import { browserStorage } from '../app/storage.ts';
import { createRanks } from './ranks.ts';

export type ShellScreensHost = Pick<Moves, 'go' | 'goHome' | 'backOrHome'>;

export interface ShellScreens {
  readonly handlers: { readonly [S in ShellView]: ScreenHandler<S> };
  /**
   * Lays the shell out for the screen on show: Ranks, and the bar on a tab screen. `notice` when a
   * fight's screen shows a notice in its fight's place (`shellOf`).
   */
  setVisible(screen: Screen, notice?: boolean): void;
  /** What waits on the player: the Friends tab's badge (ADR 0081). */
  waiting(count: number): void;
  /**
   * The avatar (accounts builds, ADR 0081, 0087): top right in whichever tab screen's header shows
   * (the row of its `data-tab-head` slot), before the `?` and gear, and leaves with the tab.
   */
  holdAvatars(avatars: { readonly head: HTMLElement }): void;
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
        // The one vs Friend path (ADR 0089 addendum of 2026-11-27) on Play's box's rules: the
        // send screen's link leads there (Play, and "Who do you want to play?" signed in).
        playFriend: () => {
          const { format, bestOf } = loadFriendSetup(browserStorage);
          host.go((url) => {
            writeSendParams(url, format, bestOf);
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
  let headAvatar: HTMLElement | undefined;
  /**
   * The avatar into the tab's header row, just before its `?` and gear (ADR 0087 addendum of
   * 2026-11-26), or out of the page where no tab shows.
   */
  const placeAvatar = (tab: Tab['id'] | undefined): void => {
    if (headAvatar === undefined) return;
    const lead = tab === undefined ? null : document.querySelector(`[data-tab-head="${tab}"]`);
    const row = lead?.parentElement;
    const tools = row?.querySelector(':scope > .symbol-legend-toggle, :scope > .settings-toggle');
    if (tools === null || tools === undefined) headAvatar.remove();
    else if (tools.previousElementSibling !== headAvatar) tools.before(headAvatar);
  };
  let shown: Tab['id'] | undefined;
  /** The last tab shown: a screen browsed or tasked to from it keeps it lit (ADR 0087). */
  let opener: Tab['id'] | undefined;
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
      matches: { show: host.goHome },
    },
    holdAvatars(avatars) {
      headAvatar = avatars.head;
      placeAvatar(shown);
    },
    waiting(count) {
      bar.badge('friends', count, friendsTabLabel(count));
    },
    setVisible(current, notice = false) {
      ranks?.setVisible(current === 'ranks');
      // The shell follows the URL's screen key: the manual's index is a tab, a ball's page is
      // browsed to from it (its tab lit even from a link), a setup is a task, a lineup a fight.
      const route = parseRoute(new URLSearchParams(window.location.search), BALL_LOOKUP, false);
      const key = route.screen === current ? screenKeyOf(route) : undefined;
      const kind = key === undefined ? 'fight' : shellOf(key, TABS, notice);
      shown = key === undefined ? undefined : tabOf(key);
      if (shown !== undefined) opener = shown;
      else if (key === 'manual-entry') opener = 'balls';
      bar.show(kind, kind === 'fight' ? undefined : opener);
      placeAvatar(shown);
    },
  };
}
