// Online play on the page, as main.ts sees it (ADR 0052): the router's three online screens, what
// the arena tells a series each frame, and the page's layout. `mountOnline` builds it in a build
// with online play, in a chunk of its own that `lazyOnline` (online-lazy.ts) loads and stands in
// for until it comes; `offlineMount` (online-off.ts) stands in without it, sending any online URL
// home. main.ts holds one or the other, so it never asks which build it is in again.
import { askMe } from './who-ask.ts';
import type { Navigation } from '../app/navigation.ts';
import type { Screen } from '../app/route.ts';
import type { ScreenHandlers } from '../app/router.ts';
import type { FriendSetup } from '../app/modes.ts';
import { browserStorage } from '../app/storage.ts';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import type { Arena } from '../arena.ts';
import type { Side } from '../sim/series.ts';
import type { WorldState } from '../sim/types.ts';
import { getElement } from '../ui/dom.ts';
import type { SettingsHost } from '../ui/settings-menu.ts';
import type { SeriesPhase } from '../ui/series-panel.ts';
import { createOnlineScreens } from './online.ts';
import type { InboxResponse } from '../api/friends.ts';
import { invitesMayShow, isFighting, type ScreenMoment } from '../app/screen-rules.ts';
import { createInboxWatch } from './inbox-watch.ts';
import { leftLine, takeLeft } from '../app/left-match.ts';
import { createIncomingBanner } from '../ui/online/incoming-banner.ts';
import { createRematchWatch, type RematchHomeBack } from './rematch-watch.ts';
import { createHomeBack } from '../ui/online/back-to-match.ts';
import { rematchBackWords } from '../ui/online/back-to-match-text.ts';
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';
import { visitCache } from '../app/visit-cache.ts';
import { createWhoSource } from '../app/who-source.ts';
import type { Avatars } from '../ui/online/account-button.ts';
import { TABS } from '../app/tabs.ts';
import type { HomePlay } from '../app/home-play-state.ts';
import { showPlayRow } from '../ui/online/play-waiting.ts';

/** The screens a tab opens (tabs.ts), where the avatar shows. */
const TAB_SCREENS: ReadonlySet<string> = new Set(TABS.map((tab) => tab.screen));

/** How often home asks again while it shows a way back to a live match. */
const HOME_ASK_MS = 10_000;

export interface OnlineMount {
  readonly handlers: Pick<
    ScreenHandlers,
    'online' | 'challenge' | 'send' | 'start' | 'signin' | 'friends'
  > &
    Partial<Pick<ScreenHandlers, 'profile' | 'matches'>>;
  /** The avatar (accounts builds), for the shell to place in the tab screens' lead slot. */
  readonly avatars: Pick<Avatars, 'head'> | undefined;
  /** Settings' online group, when there is one. */
  readonly settings: Pick<SettingsHost, 'online'>;
  /**
   * Undefined when `screen` can show now; else it shows once this resolves (online-lazy.ts: an
   * online screen waits for online play's code, or for it to fail).
   */
  ready(screen: Screen): Promise<void> | undefined;
  settle(world: WorldState): void;
  update(world: WorldState, celebrated: boolean): void;
  /** The online series is on screen. */
  playing(): boolean;
  /** The arena holds one of its rounds (OnlinePlay.roundOnArena). */
  roundOnArena(): boolean;
  phase(): SeriesPhase | undefined;
  /**
   * The online series' screen is a task's, not a fight's (tabs.ts): it shows a notice or its
   * skeleton in the series' place, or a series by turns between its fights, in the page frame
   * (turns-frame.ts).
   */
  noticeShown(): boolean;
  /** The health bars' labels for the online series on screen. */
  sides(): readonly string[] | undefined;
  /** The player's side of the online series on screen. */
  yourSide(): Side | undefined;
  setVisible(screen: Screen): void;
  /** Home was opened: "Back to your match" asks again. */
  homeShown(): void;
  /**
   * The Play tab's Play against a friend: signed in, "Who do you want to play?" (ADR 0089 addendum
   * of 2026-11-27); else straight to the link to share (ADR 0081 addendum).
   */
  playFriend(setup: FriendSetup): Promise<void>;
  /** Whether Play against a friend asks who (an account is signed in). */
  asksWho(): boolean;
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
  goHome(how?: 'go' | 'replace'): void;
  showWorld(world: WorldState, seed: number): void;
  /** The arena, for a live round's start, countdown and a fight already under way (ADR 0053). */
  arena(): Pick<Arena, 'release' | 'countdown' | 'showAt'>;
  worldsShown(): number;
  showControls(): void;
  redraw(): void;
  /** What waits on the player, from the inbox (undefined: nothing, or not signed in). */
  waiting(inbox: InboxResponse | undefined): void;
  /** The avatar (accounts builds), made by the stand-in so it shows from the first frame. */
  readonly avatars: Avatars | undefined;
}

export function mountOnline(context: MountContext): OnlineMount {
  // The HUD the online screens sit in (beside the offline ones), and its foot for the way out.
  const hud = getElement('hud-status', HTMLElement).parentElement ?? document.body;
  const foot = getElement('hud-speed', HTMLElement).parentElement ?? document.body;
  // A rematch asked while the player is elsewhere in the game reaches them there (rematch-watch.ts).
  let fighting = false;
  /** A friend's challenge may pop up (not over a fight or a lineup pick). */
  let calm = true;
  /** The screen on show, as last changed. */
  let onScreen: Screen | undefined;
  const rematchRoot = document.createElement('div');
  document.body.append(rematchRoot);
  /** Home's way back to a rematch waiting on this player, as the watch last said. */
  let rematchWaiting: RematchHomeBack | undefined;
  const rematchWatch = createRematchWatch(rematchRoot, {
    storage: browserStorage,
    go: (write) => {
      context.go(write);
    },
    fighting: () => fighting,
    ownScreen: () => screens.play.endScreen() ?? screens.rematchShown(),
    seriesShown: () => screens.play.seriesShown(),
    endingTold: (id) => screens.play.rematch.told(id),
    waitingFor: () => screens.waitingFor(),
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
    ? createInboxWatch(inboxRoot, {
        open: (token, live) => screens.openInvite(token, live),
        // One banner at a time: the end screen's rematch question first, then the challenge.
        calm: () => calm && !screens.play.rematch.holds(),
        waitingFor: () => screens.waitingFor(),
        onFriends: () => onScreen === 'friends',
        badge: () =>
          document.querySelector<HTMLElement>('.tab-bar-tab[data-tab="friends"] .tab-bar-badge') ??
          undefined,
        // A rematch window or a lobby waiting: news is expected, read every 2 s (2026-11-23).
        expecting: () => rematchWatch.active() || lobbyWaiting > Date.now(),
        // One answer, two views (ADR 0081, 0086): the Friends tab's lists and its badge.
        inbox: (answer) => {
          screens.friendStatuses(answer);
          context.waiting(answer);
        },
      })
    : undefined;
  // One `/me` for the avatar and the screens, kept for the visit (ADR 0087).
  const whoSource = createWhoSource(askMe, visitCache);
  const screens = createOnlineScreens(hud, foot, BALLS, BALL_LOOKUP, {
    who: whoSource,
    ended: (view) => {
      rematchWatch.ended(view);
      inboxWatch?.quicken();
    },
    rematchMoved: () => {
      inboxWatch?.refresh();
    },
    lobbyWaits: () => {
      // The lobby asks every 2 s while it shows; a little longer covers its next ask.
      lobbyWaiting = Date.now() + 5_000;
      inboxWatch?.quicken();
    },
    // Cancelled here: Play in "Back to your lobby"'s place at once (ADR 0089 addendum).
    lobbyGone: () => {
      homePlay = { kind: 'play' };
      showPlay();
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
    homeInstead: () => {
      context.goHome('replace');
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
  const { avatars } = context;
  /** Read again on the next tab screen: a sign-in, a log out or a new username may change it. */
  let whoStale = true;
  const askWho = async (): Promise<void> => {
    if (avatars === undefined || !whoStale) return;
    whoStale = false;
    avatars.show({ kind: 'unknown' });
    const who = await whoSource.ask();
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
  // In Play's place, over its row (home.css): the place keeps its height whichever shows.
  playRow?.after(screens.backToMatch.element, rematchBack.element);
  /** Play's place: Play, the way back to a live match, or Play waiting for the server to say. */
  let homePlay: HomePlay = screens.backToMatch.arrive();
  function showPlay(): void {
    const rematchShowing = rematchBack.show(
      homePlay.kind === 'play' ? (rematchWaiting ?? null) : null,
    );
    if (playRow === null) return;
    const covered = homePlay.kind === 'back' || rematchShowing;
    showPlayRow(playRow, covered ? 'covered' : homePlay.kind === 'waiting' ? 'waiting' : 'play');
  }
  // From the first frame of a page opened on Play: never a Play the server hasn't vouched for.
  showPlay();
  let homeAsk: number | undefined;
  const askHome = async (): Promise<void> => {
    if (homeAsk !== undefined) window.clearTimeout(homeAsk);
    homeAsk = undefined;
    homePlay = await screens.backToMatch.refresh();
    showPlay();
    if (homePlay.kind === 'back' && !homeRoot.hidden) {
      // A lobby shown is asked about again just after it would stop (ADR 0089 addendum): "Back
      // to your lobby" never outlives it.
      const stops = screens.backToMatch.stopsInMs();
      const next = stops === undefined ? HOME_ASK_MS : Math.min(HOME_ASK_MS, stops + 500);
      homeAsk = window.setTimeout(() => void askHome(), next);
    }
  };
  const leftRoot = document.createElement('div');
  document.body.append(leftRoot);
  const leftNews = createIncomingBanner(leftRoot, 'Match', {
    accept: () => Promise.resolve(),
    decline: () => Promise.resolve(),
    dismiss: () => {
      leftNews.show(undefined);
    },
    later: () => undefined,
  });
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
      ...(screens.matches === undefined ? {} : { matches: screens.matches }),
    },
    avatars,
    // Settings' Forget me (an online build without accounts, ADR 0078) is the stand-in's: settings
    // are made before this code comes (online-lazy.ts).
    settings: {},
    ready: () => undefined,
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
    noticeShown: () => screens.play.framed(),
    sides: () => screens.play.sides(),
    yourSide: () => screens.play.yourSide(),
    setVisible: (screen) => {
      if (screen === 'signin' || screen === 'profile') whoStale = true;
      // Any tab screen may show the avatar, so any of them asks again once it is stale.
      else if (TAB_SCREENS.has(screen)) void askWho();
      screens.setVisible(screen);
    },
    homeShown: () => {
      // Arriving on Play (a visit, Back) closes "Who do you want to play?", as What to play.
      screens.homeShown();
      // A match this page knows of shows its way back at once; else Play waits for the answer.
      homePlay = screens.backToMatch.arrive();
      showPlay();
      void askHome();
      // Just left a live match: said once, on the banner's look, with OK (ADR 0086).
      const they = takeLeft();
      if (they !== undefined) {
        leftNews.show({ who: they, title: leftLine(they), line: '', answers: 'ok' });
      }
    },
    playFriend: (setup) => screens.playFriend(setup),
    asksWho: () => screens.asksWho(),
    isLive: () => screens.play.isLive(),
    liveRate: (playedMs) => screens.play.liveRate(playedMs),
    screenChanged: (screen, now) => {
      onScreen = screen;
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
