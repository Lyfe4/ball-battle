// One vs Friend path (ADR 0089, B1), accounts builds only: what Play against a friend does. Signed
// in, Play goes straight to the friend last picked while that can work (playableFriend), else opens
// "Who do you want to play?" (who-sheet.ts); picking there starts the match and is remembered, so
// the Play box says "vs Robin · Live · Best of 3 · Reveal". A guest, or an account whose `/me` isn't
// known, goes straight to the link as before, and its lobby says how to challenge friends instead
// (sign in) or offers the online friends (an account). Who is a friend and online is the inbox's
// list (no read of its own).
import type { FriendEntry } from '../api/friends.ts';
import {
  loadFriendPick,
  playableFriend,
  saveFriendPick,
  type FriendPick,
} from '../app/friend-pick.ts';
import { loadFriendSetup, type FriendSetup } from '../app/modes.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import { TURNS_BUILD } from '../app/turns-build.ts';
import type { WhoSource } from '../app/who-source.ts';
import { writeSignInParams } from '../app/online-url.ts';
import { writeShellParams } from '../app/route.ts';
import { element } from '../ui/dom.ts';
import { personRow } from '../ui/online/person-row.ts';
import { createWhoSheet } from '../ui/online/who-sheet.ts';
import { FRIEND_GROUPS } from './friends-text.ts';
import type { ChallengeScreens } from './online-challenge-types.ts';
import { waitsForAnyone } from './online-challenge-text.ts';
import type { ChallengeInfo } from '../api/challenges.ts';
import {
  friendBox,
  OR_A_FRIEND,
  OTHERS_SHOWN,
  SIGN_IN,
  SIGN_IN_LINE,
  type FriendBox,
} from './who-text.ts';

export interface FriendPickHost {
  readonly storage: DeviceStorage;
  readonly who: WhoSource;
  /** A live match by a link to anyone, on `setup` (the lobby with the link). */
  readonly link: (setup: FriendSetup) => Promise<void>;
  /** A live challenge sent to `friend` on `setup`, straight to their lobby. */
  readonly live: (friend: FriendEntry, setup: FriendSetup) => Promise<void>;
  /** By turns with `friend`: its lineup first (ADR 0085). */
  readonly turns: (friend: FriendEntry) => void;
  /** The Friends tab, to add a friend. */
  readonly friendsTab: () => void;
  readonly signIn: () => void;
}

export interface FriendPicker {
  /** Play against a friend, on the box's rules. */
  play(setup: FriendSetup): Promise<void>;
  /** "Who do you want to play?", from What to play's "Play someone else". */
  choose(): void;
  /** The box over Play with a friend remembered, if it can go straight to them. */
  box(setup: FriendSetup): FriendBox | undefined;
  /** The inbox's friends and their status. */
  statuses(friends: readonly FriendEntry[]): void;
  /** What the lobby of a link to anyone shows after the link: friends to challenge instead. */
  lobbyAfter(
    card: ChallengeInfo,
    swap: (friend: FriendEntry) => Promise<void>,
  ): HTMLElement | undefined;
  close(): void;
}

const FRIENDS_GROUP = FRIEND_GROUPS.find((group) => group.key === 'friends') ?? {
  key: 'friends',
  title: 'Friends',
};

export function createFriendPicker(host: FriendPickHost): FriendPicker {
  let friends: readonly FriendEntry[] | undefined;
  /** The account signed in on this device, as this visit knows it (undefined: not an account). */
  const owner = (): string | undefined => {
    const who = host.who.known();
    return who?.kind === 'account' ? (who.username ?? 'account') : undefined;
  };
  const pickOf = (): FriendPick | undefined => {
    const signedIn = owner();
    return signedIn === undefined ? undefined : loadFriendPick(host.storage, signedIn);
  };
  const remember = (friend: FriendEntry, turns: boolean): void => {
    const signedIn = owner();
    if (signedIn === undefined) return;
    // The box says it when Play shows again (home.open reads it).
    saveFriendPick(host.storage, { owner: signedIn, id: friend.id, name: friend.name, turns });
  };

  const startLive = (friend: FriendEntry): Promise<void> => {
    remember(friend, false);
    return host.live(friend, loadFriendSetup(host.storage));
  };
  const startTurns = (friend: FriendEntry): void => {
    remember(friend, true);
    host.turns(friend);
  };
  const sheet = createWhoSheet({
    challenge: (friend) => {
      void startLive(friend);
    },
    turns: TURNS_BUILD ? startTurns : undefined,
    anyone: () => {
      void host.link(loadFriendSetup(host.storage));
    },
    addFriend: host.friendsTab,
  });

  return {
    async play(setup) {
      // Not signed in (or not known to be): the link, as before; its lobby says how to sign in.
      if (owner() === undefined) {
        const who = await host.who.ask();
        if (who.kind !== 'account') return host.link(setup);
      }
      const friend = playableFriend(pickOf(), friends, TURNS_BUILD);
      if (friend === undefined) {
        sheet.open(friends, setup);
        return;
      }
      if (pickOf()?.turns === true) startTurns(friend);
      else await startLive(friend);
    },
    choose() {
      sheet.open(friends, loadFriendSetup(host.storage));
    },
    box(setup) {
      // Drawn before `/me` answers on a visit: the pick this device holds, unless someone else is in.
      const who = host.who.known();
      if (who !== undefined && who.kind !== 'account' && who.kind !== 'unknown') return undefined;
      const pick = loadFriendPick(host.storage, owner());
      if (pick === undefined) return undefined;
      // The inbox's name for them (a new username), else the one remembered.
      const name = friends?.find((one) => one.id === pick.id)?.name ?? pick.name;
      return friendBox(name, pick.turns, setup);
    },
    statuses(next) {
      friends = next;
      sheet.update(next);
    },
    lobbyAfter(card, swap) {
      if (!waitsForAnyone(card)) return undefined;
      if (owner() === undefined) {
        // A guest (or unknown): one line, the link straight away as before.
        const line = element('p', 'who-lobby-line');
        const sign = element('button', 'text-link who-lobby-sign-in', SIGN_IN);
        sign.type = 'button';
        sign.setAttribute('aria-label', `${SIGN_IN} ${SIGN_IN_LINE}`);
        sign.addEventListener('click', host.signIn);
        line.append(sign, ` ${SIGN_IN_LINE}`);
        return line;
      }
      const online = (friends ?? []).filter((friend) => friend.status === 'online');
      if (online.length === 0) return undefined;
      const section = element('section', 'who-lobby');
      const list = element('ul', 'friends-list');
      for (const friend of online.slice(0, OTHERS_SHOWN)) {
        list.append(
          personRow(FRIENDS_GROUP, friend, {
            waiting: false,
            open: () => {
              void swap(friend);
            },
            made: () => () => Promise.resolve(false),
            challenge: (chosen) => {
              remember(chosen, false);
              void swap(chosen);
            },
          }),
        );
      }
      section.append(element('h2', 'friends-group-title', OR_A_FRIEND), list);
      return section;
    },
    close() {
      sheet.close();
    },
  };
}

/** The picker on the challenge screens: links, live challenges and by turns go through them. */
export function pickerFor(
  challenges: Pick<ChallengeScreens, 'playFriend' | 'challengeFriend'>,
  host: {
    readonly storage: DeviceStorage;
    readonly who: WhoSource;
    go(write: (params: URLSearchParams) => void): void;
  },
): FriendPicker {
  return createFriendPicker({
    storage: host.storage,
    who: host.who,
    link: (setup) => challenges.playFriend(setup),
    live: (friend, setup) => challenges.playFriend(setup, friend),
    turns: (friend) => {
      challenges.challengeFriend(friend, true);
    },
    friendsTab: () => {
      host.go((url) => {
        writeShellParams(url, 'friends');
      });
    },
    signIn: () => {
      host.go(writeSignInParams);
    },
  });
}
