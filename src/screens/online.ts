// Online play's screens wired to the page (ADR 0052): an online series, a friend's challenge,
// sending one, home's "Back to your match" and settings' "Forget me". main.ts creates this only in a build
// with online play (`ONLINE_BUILD`), so a production build holds none of it. Its parts of the page
// are added here, beside the offline screens' own.
import type { Navigation } from '../app/navigation.ts';
import { hasGuest, type DeviceStorage } from '../app/online-device.ts';
import type { ScreenHandler } from '../app/router.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { element } from '../ui/dom.ts';
import { createBackToMatch } from '../ui/online/back-to-match.ts';
import { createForgetMe, type ForgetMe } from '../ui/online/forget-me.ts';
import type { FriendEntry } from '../api/friends.ts';
import type { CurrentMatch } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import { currentMatch, writeMatchParams } from './current-match.ts';
import { createChallengeScreens } from './online-challenge.ts';
import { forgetMeHost } from './forget-me-host.ts';
import { logOut } from './log-out.ts';
import { createOnlinePlay, type OnlinePlay } from './online-play.ts';
import { createSignIn } from './sign-in.ts';
import { createPrimer } from './online-prime.ts';

export interface OnlineHost {
  readonly navigation: Navigation;
  go(write: (params: URLSearchParams) => void): void;
  replaceWith(write: (params: URLSearchParams) => void): void;
  home(): void;
  /** The vs Friend setup: where a challenge is sent from (ADR 0055). */
  friend(): void;
  showWorld(world: WorldState, seed: number): void;
  /** A live round held on its countdown, or already `elapsedMs` under way (ADR 0053). */
  holdLive(world: WorldState, seed: number): void;
  showLiveAt(world: WorldState, seed: number, elapsedMs: number): void;
  /** Starts the held match at its server time. */
  release(): void;
  countdown(text: string | undefined): void;
  worldsShown(): number;
  layoutChanged(): void;
  redraw(): void;
  readonly storage: DeviceStorage;
  /** A live series ended on this device: a rematch of it reaches the player anywhere. */
  readonly ended?: (view: SeriesView) => void;
  /** The friends changed on the account screen: the inbox reads now (ADR 0079 PR (d)). */
  readonly friendsChanged?: () => void;
  /** The sender's lobby waits for the friend: the inbox reads quickly meanwhile. */
  readonly lobbyWaits?: () => void;
}

export interface OnlineScreens {
  readonly online: ScreenHandler<'online'>;
  readonly challenge: ScreenHandler<'challenge'>;
  readonly send: ScreenHandler<'send'>;
  readonly signin: ScreenHandler<'signin'>;
  readonly play: OnlinePlay;
  /** Home's "Back to your match" (ADR 0053); `refresh` asks the server, true when one shows. */
  readonly backToMatch: { readonly element: HTMLElement; refresh(): Promise<boolean> };
  readonly forgetMe: ForgetMe;
  /** Shows the online screen parts for `screen` and hides the rest. */
  setVisible(screen: string): void;
  /** The friends' status from the inbox, for the account screen's Friends section. */
  friendStatuses(friends: readonly FriendEntry[]): void;
  /** A friend's challenge accepted from the floating card: its lineup, read first. */
  openInvite(token: string): Promise<void>;
}

export function createOnlineScreens(
  hud: HTMLElement,
  foot: HTMLElement,
  balls: readonly BallDefinition[],
  lookup: DefinitionLookup,
  host: OnlineHost,
): OnlineScreens {
  const section = (id: string, label: string) => {
    const node = element('section', '');
    node.id = id;
    node.setAttribute('aria-label', label);
    node.hidden = true;
    return node;
  };
  const challengeNotice = section('online-challenge', 'Challenge');
  const challengeLoading = section('online-challenge-loading', 'Challenge');
  const lineupRoot = section('online-lineup', 'Your lineup');
  const seriesNotice = section('online-series-notice', 'Online series');
  const seriesLoading = section('online-series-loading', 'Online series');
  const panel = section('online-series', 'Online series');
  const signInNotice = section('online-signin', 'Sign in');
  const signInLoading = section('online-signin-loading', 'Sign in');
  const exit = element('div', 'series-exit');
  exit.hidden = true;
  // Beside the offline screens: before the health bars, and the way out under them.
  const status = hud.querySelector('#hud-status');
  for (const node of [
    challengeNotice,
    challengeLoading,
    lineupRoot,
    seriesNotice,
    seriesLoading,
    panel,
    signInNotice,
    signInLoading,
  ]) {
    hud.insertBefore(node, status);
  }
  foot.append(exit);

  const home = () => {
    host.home();
  };
  // Moving into a series reads it first, so its screen shows complete (ADR 0054).
  const primer = createPrimer();
  const toMatch = async (match: CurrentMatch): Promise<void> => {
    if (match.kind === 'series') await primer.series(match.id);
    host.go((url) => {
      writeMatchParams(url, match);
    });
  };
  const play = createOnlinePlay(
    { panel, exit, notice: seriesNotice, loading: seriesLoading },
    lookup,
    {
      ...host,
      home,
      primed: (id) => primer.takeSeries(id),
      primeSeries: (id) => primer.series(id),
    },
  );
  const challenges = createChallengeScreens(
    { notice: challengeNotice, lineup: lineupRoot, loading: challengeLoading },
    balls,
    {
      go: (write) => {
        host.go(write);
      },
      replaceWith: (write) => {
        host.replaceWith(write);
      },
      rewrite: (write) => {
        host.navigation.replace(write);
      },
      back: (toParent) => {
        host.navigation.back(toParent);
      },
      home,
      friend: () => {
        host.friend();
      },
      storage: host.storage,
      primeSeries: (id) => primer.series(id),
      toMatch,
      ...(host.lobbyWaits === undefined ? {} : { lobbyWaits: host.lobbyWaits }),
    },
  );

  const back = createBackToMatch(toMatch);
  const backToMatch = {
    element: back.element,
    /** Asks for the player's live match, only on a device that has played online. */
    async refresh(): Promise<boolean> {
      if (!hasGuest(host.storage)) return back.show(null);
      const match = await currentMatch();
      // Unknown (offline, a failure): keep what shows; the next ask may know.
      return match === undefined ? !back.element.hidden : back.show(match);
    },
  };

  // Back from another app (a share sheet, a chat): a waiting lobby asks at once.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') challenges.resumed();
  });

  const startAfresh = () => {
    window.location.assign('/');
  };
  const signIn = createSignIn(
    { notice: signInNotice, loading: signInLoading },
    {
      storage: host.storage,
      back: () => {
        host.navigation.back(home);
      },
      home,
      rewrite: (write) => {
        host.navigation.replace(write);
      },
      toMatch,
      leaveFor: (url) => {
        window.location.assign(url);
      },
      userAgent: navigator.userAgent,
      cookies: () => document.cookie,
      // The account screen is the one place for the player (ADR 0079 addendum of 2026-11-22).
      logOut: () => logOut(host.storage, startAfresh),
      forget: () => forgetMeHost(host.storage, startAfresh).forget(),
      challenge: (friend) => {
        challenges.challengeFriend(friend);
      },
      ...(host.friendsChanged === undefined ? {} : { friendsChanged: host.friendsChanged }),
    },
  );

  // Settings' Forget me, in an online build without accounts (no account screen there).
  const forgetMe = createForgetMe(forgetMeHost(host.storage, startAfresh));

  return {
    online: {
      show: (route) => {
        play.open(route.series);
      },
      leave: () => {
        play.leave();
      },
    },
    challenge: {
      show: (route) => {
        challenges.showChallenge(route.token, route.step);
      },
    },
    send: {
      show: (route) => {
        challenges.showSend(route.format, route.bestOf, route.step, route.rematch);
      },
    },
    signin: {
      show: (route) => {
        signIn.show(route.google);
      },
    },
    play,
    backToMatch,
    forgetMe,
    setVisible(screen) {
      signIn.setVisible(screen === 'signin');
      challenges.setVisible(screen === 'challenge' || screen === 'send');
      play.setVisible(screen === 'online');
    },
    friendStatuses(friends) {
      signIn.statuses(friends);
    },
    openInvite: (token) => challenges.openInvite(token),
  };
}
