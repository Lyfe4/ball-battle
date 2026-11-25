// Online play's screens wired to the page (ADR 0052): an online series, a friend's challenge,
// sending one, home's "Back to your match" and settings' "Forget me". main.ts creates this only in a build
// with online play (`ONLINE_BUILD`), so a production build holds none of it. Its parts of the page
// are added here, beside the offline screens' own.
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';
import type { Navigation } from '../app/navigation.ts';
import { hasGuest, type DeviceStorage } from '../app/online-device.ts';
import type { ScreenHandler } from '../app/router.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { element } from '../ui/dom.ts';
import { createBackToMatch } from '../ui/online/back-to-match.ts';
import { createForgetMe, type ForgetMe } from '../ui/online/forget-me.ts';
import type { InboxResponse } from '../api/friends.ts';
import type { SeriesView } from '../api/series.ts';
import { currentMatch, writeMatchParams, type MatchPlace } from './current-match.ts';
import { createChallengeScreens } from './online-challenge.ts';
import { forgetMeHost } from './forget-me-host.ts';
import { logOut } from './log-out.ts';
import { createOnlinePlay, type OnlinePlay } from './online-play.ts';
import { loadFriendSetup, type FriendSetup } from '../app/modes.ts';
import { writeSendParams, writeSignInParams } from '../app/online-url.ts';
import { writeShellParams } from '../app/route.ts';
import { createFriendsTab } from './friends-tab.ts';
import { createProfile } from './profile.ts';
import { createSignIn } from './sign-in.ts';
import type { WhoSource } from '../app/who-source.ts';
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
  /** Who this device plays as (who-source.ts): one `/me` for the avatar and the screens. */
  readonly who: WhoSource;
  /** A live series ended on this device: a rematch of it reaches the player anywhere. */
  readonly ended?: (view: SeriesView) => void;
  /** The friends changed on the account screen: the inbox reads now (ADR 0079 PR (d)). */
  readonly friendsChanged?: () => void;
  /** Accept and No thanks on a friend's challenge in the Friends tab (the inbox's, ADR 0081). */
  readonly acceptInvite?: (token: string) => Promise<void>;
  readonly declineInvite?: (token: string) => Promise<string | undefined>;
  /** The sender's lobby waits for the friend: the inbox reads quickly meanwhile. */
  readonly lobbyWaits?: () => void;
}

export interface OnlineScreens {
  readonly online: ScreenHandler<'online'>;
  readonly challenge: ScreenHandler<'challenge'>;
  readonly send: ScreenHandler<'send'>;
  readonly start: ScreenHandler<'start'>;
  readonly signin: ScreenHandler<'signin'>;
  /** Profile (ADR 0081), in accounts builds; elsewhere the shell's route sends it home. */
  readonly profile?: ScreenHandler<'profile'>;
  /** The Friends tab (ADR 0081): every online build. */
  readonly friends: ScreenHandler<'friends'>;
  readonly play: OnlinePlay;
  /** Home's "Back to your match" (ADR 0053); `refresh` asks the server, true when one shows. */
  readonly backToMatch: { readonly element: HTMLElement; refresh(): Promise<boolean> };
  readonly forgetMe: ForgetMe;
  /** Shows the online screen parts for `screen` and hides the rest. */
  setVisible(screen: string): void;
  /** The inbox's friends and open challenges, for the Friends tab's lists (ADR 0081). */
  friendStatuses(inbox: InboxResponse | undefined): void;
  /** A friend's challenge accepted from the floating card: its lineups, read first. */
  openInvite(token: string, live: boolean): Promise<void>;
  /** The Play tab's Play against a friend: straight to the link to share (ADR 0081 addendum). */
  playFriend(setup: FriendSetup): Promise<void>;
  /** The ended series whose rematch's lineups show now, if any (ADR 0080). */
  rematchShown(): string | undefined;
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
  const profileNotice = section('online-profile', 'Profile');
  const profileLoading = section('online-profile-loading', 'Profile');
  const friendsRoot = section('online-friends', 'Friends');
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
    profileNotice,
    profileLoading,
    friendsRoot,
  ]) {
    hud.insertBefore(node, status);
  }
  foot.append(exit);

  const home = () => {
    host.home();
  };
  // Moving into a series reads it first, so its screen shows complete (ADR 0054).
  const primer = createPrimer();
  const toMatch = async (match: MatchPlace): Promise<void> => {
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
  // Who the player is, for the screens that ask: the device and the one `/me` (ADR 0087).
  const player = { storage: host.storage, who: host.who };
  // The account screen exists only in a build with accounts (ADR 0079): production with vs Friend
  // on and accounts off holds none of its code (`scripts/check-bundle.ts`), and its route is home
  // there (`parseOnlineRoute`).
  const signIn = ACCOUNTS_BUILD
    ? createSignIn(
        { notice: signInNotice, loading: signInLoading },
        {
          ...player,
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
          // A guest's Forget me on the ways in; Log out and Delete account are Profile's (ADR 0081).
          forget: () => forgetMeHost(host.storage, startAfresh).forget(),
          // Signed in, the player lands on the Friends tab (ADR 0081).
          landed: () => {
            host.go((url) => {
              writeShellParams(url, 'friends');
            });
          },
        },
      )
    : undefined;

  // Profile (ADR 0081), as the sign-in screen: only in a build with accounts.
  const profile = ACCOUNTS_BUILD
    ? createProfile(
        { notice: profileNotice, loading: profileLoading },
        {
          ...player,
          back: () => {
            host.navigation.back(home);
          },
          home,
          signIn: () => {
            host.go(writeSignInParams);
          },
          cookies: () => document.cookie,
          logOut: () => logOut(host.storage, startAfresh),
          forget: () => forgetMeHost(host.storage, startAfresh).forget(),
        },
      )
    : undefined;

  const friendsTab = createFriendsTab(friendsRoot, {
    ...player,
    cookies: () => document.cookie,
    back: () => {
      host.navigation.back(home);
    },
    // The vs Friend setup, on the friend's rules as last chosen here (ADR 0081 addendum).
    sendLink: () => {
      const { format, bestOf } = loadFriendSetup(host.storage);
      host.go((url) => {
        writeSendParams(url, format, bestOf);
      });
    },
    signIn: () => {
      host.go(writeSignInParams);
    },
    challenge: (friend, turns) => {
      challenges.challengeFriend(friend, turns);
    },
    ...(host.friendsChanged === undefined ? {} : { changed: host.friendsChanged }),
    ...(host.acceptInvite === undefined ? {} : { acceptInvite: host.acceptInvite }),
    ...(host.declineInvite === undefined ? {} : { declineInvite: host.declineInvite }),
    openSeries: (id) => toMatch({ kind: 'series', id }),
  });

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
        challenges.showChallenge(route.token);
      },
    },
    send: {
      show: (route) => {
        challenges.showSend(route.format, route.bestOf);
      },
    },
    start: {
      show: (route) => {
        challenges.showStart(route.id);
      },
    },
    signin: {
      show: (route) => {
        signIn?.show(route.google);
      },
    },
    ...(profile === undefined
      ? {}
      : {
          profile: {
            show: () => {
              profile.show();
            },
          },
        }),
    friends: {
      show: () => {
        friendsTab.show();
      },
    },
    play,
    backToMatch,
    forgetMe,
    setVisible(screen) {
      friendsTab.setVisible(screen === 'friends');
      signIn?.setVisible(screen === 'signin');
      profile?.setVisible(screen === 'profile');
      challenges.setVisible(screen === 'challenge' || screen === 'send' || screen === 'start');
      play.setVisible(screen === 'online');
    },
    friendStatuses(inbox) {
      friendsTab.statuses(inbox?.friends ?? []);
      friendsTab.invites(inbox?.invites ?? [], inbox?.turns ?? []);
    },
    openInvite: (token, live) => challenges.openInvite(token, live),
    playFriend: (setup) => challenges.playFriend(setup),
    rematchShown: () => challenges.rematchShown(),
  };
}
