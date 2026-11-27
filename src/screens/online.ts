// Online play's screens wired to the page (ADR 0052): an online series, a friend's challenge,
// sending one, home's "Back to your match" and settings' "Forget me". main.ts creates this only in a build
// with online play (`ONLINE_BUILD`), so a production build holds none of it. Its parts of the page
// are added here, beside the offline screens' own.
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';
import type { Navigation } from '../app/navigation.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import type { ScreenHandler } from '../app/router.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { createForgetMe, type ForgetMe } from '../ui/online/forget-me.ts';
import type { InboxResponse } from '../api/friends.ts';
import type { SeriesView } from '../api/series.ts';
import { writeMatchParams, type MatchPlace } from './current-match.ts';
import { createBackToGame, createHomeBack, type HomeBack } from './home-back.ts';
import { createChallengeScreens } from './online-challenge.ts';
import { forgetMeHost } from './forget-me-host.ts';
import { createOnlinePlay, type OnlinePlay } from './online-play.ts';
import {
  loadFriendSetup,
  saveFriendSetup,
  savePlayOpponent,
  type FriendSetup,
} from '../app/modes.ts';
import { writeSignInParams } from '../app/online-url.ts';
import { writeShellParams } from '../app/route.ts';
import { createFriendsTab } from './friends-tab.ts';
import { createProfileScreens } from './profile-screens.ts';
import { pickerFor } from './friend-pick-flow.ts';
import { createOnlineRoots } from './online-roots.ts';
import type { WhoPreset } from '../ui/online/who-sheet.ts';
import { createSignIn } from './sign-in.ts';
import type { WhoSource } from '../app/who-source.ts';
import { createPrimer } from './online-prime.ts';

export interface OnlineHost {
  readonly navigation: Navigation;
  go(write: (params: URLSearchParams) => void): void;
  replaceWith(write: (params: URLSearchParams) => void): void;
  home(): void;
  /** Play in place of this screen (an old link that leads there). */
  homeInstead(): void;
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
  /** The end screen's rematch moved: a friend's challenge waiting behind it may now show. */
  readonly rematchMoved?: () => void;
  /** The friends changed on the account screen: the inbox reads now (ADR 0079 PR (d)). */
  readonly friendsChanged?: () => void;
  /** Accept and No thanks on a friend's challenge in the Friends tab (the inbox's, ADR 0081). */
  readonly acceptInvite?: (token: string) => Promise<void>;
  readonly declineInvite?: (token: string) => Promise<string | undefined>;
  /** The sender's lobby waits for the friend: the inbox reads quickly meanwhile. */
  readonly lobbyWaits?: () => void;
  /** The sender cancelled their waiting challenge: home's way back to it goes at once. */
  readonly lobbyGone?: () => void;
}

export interface OnlineScreens {
  readonly online: ScreenHandler<'online'>;
  readonly challenge: ScreenHandler<'challenge'>;
  readonly send: ScreenHandler<'send'>;
  readonly start: ScreenHandler<'start'>;
  readonly signin: ScreenHandler<'signin'>;
  /** Profile (ADR 0081), in accounts builds; elsewhere the shell's route sends it home. */
  readonly profile?: ScreenHandler<'profile'>;
  /** All matches (ADR 0089), opened from Profile: accounts builds only, as Profile. */
  readonly matches?: ScreenHandler<'matches'>;
  /** The Friends tab (ADR 0081): every online build. */
  readonly friends: ScreenHandler<'friends'>;
  readonly play: OnlinePlay;
  /** Home's "Back to your match" (ADR 0053) and what Play's place shows meanwhile. */
  readonly backToMatch: HomeBack;
  readonly forgetMe: ForgetMe;
  /** Shows the online screen parts for `screen` and hides the rest. */
  setVisible(screen: string): void;
  /** The inbox's friends and open challenges, for the Friends tab's lists (ADR 0081). */
  friendStatuses(inbox: InboxResponse | undefined): void;
  /** A friend's challenge accepted from the incoming banner: its lineups, read first. */
  openInvite(token: string, live: boolean): Promise<void>;
  /**
   * The Play tab's Play against a friend: signed in, "Who do you want to play?" (ADR 0089 addendum
   * of 2026-11-27); else straight to the link to share (ADR 0081 addendum).
   */
  playFriend(setup: FriendSetup): Promise<void>;
  /** Whether Play against a friend asks who (an account is signed in). */
  asksWho(): boolean;
  /** The ended series whose rematch's lineups show now, if any (ADR 0080). */
  rematchShown(): string | undefined;
  /** Play shows (a visit, Back): "Who do you want to play?" closes. */
  homeShown(): void;
}

export function createOnlineScreens(
  hud: HTMLElement,
  foot: HTMLElement,
  balls: readonly BallDefinition[],
  lookup: DefinitionLookup,
  host: OnlineHost,
): OnlineScreens {
  const roots = createOnlineRoots(hud, foot);
  const { challengeNotice, challengeLoading, lineupRoot, seriesNotice, seriesLoading } = roots;
  const { panel, signInNotice, signInLoading, profileNotice, profileLoading } = roots;
  const { matchesRoot, friendsRoot, exit } = roots;

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
  const backToMatch = createHomeBack(host.storage, toMatch);
  const backToGame = createBackToGame(toMatch);
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
      back: (toParent) => {
        host.navigation.back(toParent);
      },
      home,
      friend: () => {
        friendPath(undefined);
      },
      friendPath: (rules) => {
        // Saved first: Play draws its box as it shows.
        saveFriendSetup(host.storage, { ...loadFriendSetup(host.storage), ...rules });
        savePlayOpponent(host.storage, 'friend');
        host.homeInstead();
        // Already on Play: a guest presses Play there.
        friendPath(undefined, () => undefined);
      },
      storage: host.storage,
      primeSeries: (id) => primer.series(id),
      toMatch,
      ...(host.lobbyWaits === undefined ? {} : { lobbyWaits: host.lobbyWaits }),
      lobbyGone: () => {
        backToMatch.gone();
        host.lobbyGone?.();
      },
      // The picker is made just below; a waiting screen asks for this only after.
      ...(ACCOUNTS_BUILD ? { lobbyAfter: (card) => picker?.lobbyAfter(card) } : {}),
    },
  );

  // One vs Friend path (ADR 0089 and its addendum): who to play, in a build with accounts.
  const picker = ACCOUNTS_BUILD ? pickerFor(challenges, { ...host, backToGame }) : undefined;

  /**
   * Every way to play a friend outside Play's own button: Play's box is vs Friend from now on;
   * signed in, "Who do you want to play?" (`preset` picked); else Play, where Play sends the link
   * (`guest` overrides that: the Friends tab's link card sends it at once).
   */
  function friendPath(preset: WhoPreset, guest?: () => unknown): void {
    savePlayOpponent(host.storage, 'friend');
    const otherwise: () => unknown = guest ?? home;
    if (picker === undefined) void otherwise();
    else void picker.open(preset, otherwise);
  }

  // Back from another app (a share sheet, a chat): a waiting lobby asks at once.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') challenges.resumed();
  });

  const startAfresh = () => {
    window.location.assign('/');
  };
  // Who the player is, for the screens that ask: the device and the one `/me` (ADR 0087).
  const player = { storage: host.storage, who: host.who };
  /** In-app Back: the previous screen, else Play. */
  const backHome = () => {
    host.navigation.back(home);
  };
  // The account screen exists only in a build with accounts (ADR 0079): production with vs Friend
  // on and accounts off holds none of its code (`scripts/check-bundle.ts`), and its route is home
  // there (`parseOnlineRoute`).
  const signIn = ACCOUNTS_BUILD
    ? createSignIn(
        { notice: signInNotice, loading: signInLoading },
        {
          ...player,
          back: backHome,
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

  // Profile and All matches (ADR 0081, 0089), as the sign-in screen: only in a build with accounts.
  const accountScreens = ACCOUNTS_BUILD
    ? createProfileScreens(
        { notice: profileNotice, loading: profileLoading, matches: matchesRoot },
        {
          ...player,
          navigation: host.navigation,
          go: (write) => {
            host.go(write);
          },
          lookup,
          back: backHome,
          home,
          openSeries: (id) => toMatch({ kind: 'series', id }),
        },
      )
    : undefined;

  const friendsTab = createFriendsTab(friendsRoot, {
    ...player,
    cookies: () => document.cookie,
    back: backHome,
    // The one path with the link picked; a guest sends it at once, as Play does for them.
    sendLink: () => {
      friendPath({ link: true }, () => challenges.playFriend(loadFriendSetup(host.storage)));
    },
    signIn: () => {
      host.go(writeSignInParams);
    },
    // The one path with that friend picked (ADR 0089 addendum of 2026-11-27).
    challenge: (friend) => {
      friendPath({ friend: friend.id });
    },
    ...(host.friendsChanged === undefined ? {} : { changed: host.friendsChanged }),
    ...(host.acceptInvite === undefined ? {} : { acceptInvite: host.acceptInvite }),
    ...(host.declineInvite === undefined ? {} : { declineInvite: host.declineInvite }),
    openSeries: (id) => toMatch({ kind: 'series', id }),
    backToGame,
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
    ...(accountScreens === undefined
      ? {}
      : { profile: accountScreens.profile, matches: accountScreens.matches }),
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
      accountScreens?.setVisible(screen);
      challenges.setVisible(screen === 'challenge' || screen === 'send' || screen === 'start');
      play.setVisible(screen === 'online');
    },
    friendStatuses(inbox) {
      if (inbox !== undefined) picker?.statuses(inbox.friends, inbox.invites);
      // First: a request or friend the list hasn't drawn reads it again (before the merge below).
      if (inbox !== undefined) friendsTab.heard(inbox.requests, inbox.friends);
      friendsTab.statuses(inbox?.friends ?? []);
      friendsTab.invites(inbox?.invites ?? [], inbox?.turns ?? [], inbox?.games, inbox?.endings);
    },
    openInvite: (token, live) => challenges.openInvite(token, live),
    playFriend: (setup) => picker?.play(setup) ?? challenges.playFriend(setup),
    asksWho: () => picker?.asksWho() ?? false,
    rematchShown: () => challenges.rematchShown(),
    homeShown: () => picker?.close(),
  };
}
