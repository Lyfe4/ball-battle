// Online play on the page, as main.ts sees it (ADR 0052): the router's three online screens, what
// the arena tells a series each frame, and the page's layout. `mountOnline` builds it in a build
// with online play; `offlineMount` (online-off.ts) stands in without it, sending any online URL
// home. main.ts holds one or the other, so it never asks which build it is in again.
import type { Navigation } from '../app/navigation.ts';
import { writeShellParams, type Screen } from '../app/route.ts';
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
import type { InboxResponse } from '../api/friends.ts';
import { invitesMayShow, isFighting, type ScreenMoment } from '../app/screen-rules.ts';
import { createInboxWatch } from './inbox-watch.ts';
import { createRematchWatch, type RematchHomeBack } from './rematch-watch.ts';
import { createHomeBack } from '../ui/online/back-to-match.ts';
import { rematchBackWords } from '../ui/online/back-to-match-text.ts';
import type { PlayerResponse } from '../api/session.ts';
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';
import { callApi } from '../app/api.ts';
import { whoAmI } from '../app/who-am-i.ts';
import { createAvatars, type Avatars } from '../ui/online/account-button.ts';
import { TABS } from '../app/tabs.ts';

/** The screens a tab opens (tabs.ts), where the avatar shows. */
const TAB_SCREENS: ReadonlySet<string> = new Set(TABS.map((tab) => tab.screen));

/** How often home asks again while it shows a way back to a live match. */
const HOME_ASK_MS = 10_000;

export interface OnlineMount {
  readonly handlers: Pick<
    ScreenHandlers,
    'online' | 'challenge' | 'send' | 'start' | 'signin' | 'friends'
  > &
    Partial<Pick<ScreenHandlers, 'profile'>>;
  /** The avatars (accounts builds), for the shell to place on the tab screens and the rail. */
  readonly avatars: Pick<Avatars, 'head' | 'rail'> | undefined;
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
   * waits while fighting (`isFighting`, rematch-watch.ts); a friend's challenge waits through a
   * fight or a lineup pick (`invitesMayShow`, ADR 0081).
   */
  screenChanged(screen: Screen, now: ScreenMoment): void;
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
  /** What waits on the player, from the inbox (undefined: nothing, or not signed in). */
  waiting(inbox: InboxResponse | undefined): void;
}

export function mountOnline(context: MountContext): OnlineMount {
  // The HUD the online screens sit in (beside the offline ones), and its foot for the way out.
  const hud = getElement('hud-status', HTMLElement).parentElement ?? document.body;
  const foot = getElement('hud-speed', HTMLElement).parentElement ?? document.body;
  // A rematch asked while the player is elsewhere in the game reaches them there (rematch-watch.ts).
  let fighting = false;
  /** A friend's challenge may pop up (not over a fight or a lineup pick). */
  let calm = true;
  const rematchRoot = document.createElement('div');
  document.body.append(rematchRoot);
  /** Home's way back to a rematch waiting on this player, as the watch last said. */
  let rematchWaiting: RematchHomeBack | undefined;
  const rematchWatch = createRematchWatch(rematchRoot, BALL_LOOKUP, {
    storage: browserStorage,
    go: (write) => {
      context.go(write);
    },
    fighting: () => fighting,
    ownScreen: () => screens.play.endScreen() ?? screens.rematchShown(),
    seriesShown: () => screens.play.seriesShown(),
    backChanged: (back) => {
      rematchWaiting = back;
      showPlay();
    },
  });
  // Friends' challenges and status reach a signed-in account anywhere (ADR 0079 PR (d)): only in a
  // build with accounts.
  const inboxRoot = document.createElement('div');
  /** Until when (device time) the sender's lobby is known to wait: refreshed by each of its asks. */
  let lobbyWaiting = 0;
  const inboxWatch = ACCOUNTS_BUILD
    ? createInboxWatch(inboxRoot, BALL_LOOKUP, {
        open: (token) => screens.openInvite(token),
        calm: () => calm,
        // A rematch window or a lobby waiting: news is expected, read every 2 s (2026-11-23).
        expecting: () => rematchWatch.active() || lobbyWaiting > Date.now(),
        // One answer, three views (ADR 0081): the Friends tab's lists, its badge, Play's strip.
        inbox: (answer) => {
          screens.friendStatuses(answer?.friends ?? [], answer?.invites ?? []);
          context.waiting(answer);
        },
      })
    : undefined;
  const screens = createOnlineScreens(hud, foot, BALLS, BALL_LOOKUP, {
    ended: (view) => {
      rematchWatch.ended(view);
      inboxWatch?.quicken();
    },
    lobbyWaits: () => {
      // The lobby asks every 2 s while it shows; a little longer covers its next ask.
      lobbyWaiting = Date.now() + 5_000;
      inboxWatch?.quicken();
    },
    friendsChanged: () => {
      inboxWatch?.poke();
    },
    acceptInvite: (token) => inboxWatch?.accept(token) ?? Promise.resolve(),
    declineInvite: (token) => inboxWatch?.decline(token) ?? Promise.resolve(undefined),
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
        writeSendParams(url, 'reveal', 3);
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
  // The avatar on every tab screen (ADR 0081), in the header on a phone and atop the rail beside:
  // what `/me` says, read when a tab screen shows after a page load, Profile or sign-in, never
  // polled. It opens Profile; the shell places it.
  const openProfile = (): void => {
    context.go((url) => {
      writeShellParams(url, 'profile');
    });
  };
  const avatars = ACCOUNTS_BUILD ? createAvatars(openProfile) : undefined;
  /** Read again on the next tab screen: a sign-in, a log out or a new username may change it. */
  let whoStale = true;
  const askWho = async (): Promise<void> => {
    if (avatars === undefined || !whoStale) return;
    whoStale = false;
    avatars.show({ kind: 'unknown' });
    const who = await whoAmI(browserStorage, document.cookie, () =>
      callApi<PlayerResponse>('GET', 'me'),
    );
    // Not known (offline, failing): the face stays, and the next tab screen asks again.
    if (who.kind === 'unknown') whoStale = true;
    else inboxWatch?.signedIn(who.kind === 'account');
    avatars.show(who);
  };
  // Who this is is asked once the page loads, on whichever screen it opens (2026-11-23: a page
  // opened on the manual never read the inbox, so a friend's challenge waited for home).
  void askWho();
  const playRow = homeRoot.querySelector<HTMLElement>('.home-play-row');
  // "Back to your match" takes Play's place while a live match or lobby is on (ADR 0053), and is
  // asked about again every few seconds on home so it goes when the match ends. A rematch waiting
  // on this player does the same (2026-11-23), told by the rematch watch; a match comes first.
  const rematchBack = createHomeBack((back: RematchHomeBack) => {
    back.open();
  }, rematchBackWords);
  playRow?.before(screens.backToMatch.element, rematchBack.element);
  let matchShowing = false;
  function showPlay(): void {
    const rematchShowing = rematchBack.show(matchShowing ? null : (rematchWaiting ?? null));
    if (playRow !== null) playRow.hidden = matchShowing || rematchShowing;
  }
  let homeAsk: number | undefined;
  const askHome = async (): Promise<void> => {
    if (homeAsk !== undefined) window.clearTimeout(homeAsk);
    homeAsk = undefined;
    matchShowing = await screens.backToMatch.refresh();
    showPlay();
    if (matchShowing && !homeRoot.hidden) {
      homeAsk = window.setTimeout(() => void askHome(), HOME_ASK_MS);
    }
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
    handlers: {
      online: screens.online,
      challenge: screens.challenge,
      send: screens.send,
      start: screens.start,
      signin: screens.signin,
      friends: screens.friends,
      ...(screens.profile === undefined ? {} : { profile: screens.profile }),
    },
    avatars,
    // With accounts, everything about the player is on the account screen; settings are this
    // device's alone. Without, Forget me stays in settings (ADR 0078).
    settings: ACCOUNTS_BUILD ? {} : { online: screens.forgetMe },
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
      if (screen === 'signin' || screen === 'profile') whoStale = true;
      // Any tab screen may show the avatar, so any of them asks again once it is stale.
      else if (TAB_SCREENS.has(screen)) void askWho();
      screens.setVisible(screen);
    },
    homeShown: () => {
      void askHome();
    },
    isLive: () => screens.play.isLive(),
    liveRate: (playedMs) => screens.play.liveRate(playedMs),
    screenChanged: (screen, now) => {
      fighting = isFighting(screen, now);
      calm = invitesMayShow(screen, now);
      rematchWatch.refresh();
      inboxWatch?.refresh();
      inboxWatch?.quicken();
    },
    footLine: (onScreen, noSpeed) => {
      const live = onScreen && screens.play.isLive();
      liveLine.hidden = noSpeed || !live;
      if (!liveLine.hidden) showLine();
      return noSpeed || live;
    },
  };
}
