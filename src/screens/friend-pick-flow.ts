// The one vs Friend path (ADR 0089 and its addendum of 2026-11-27), accounts builds only. Signed
// in, every way to play a friend opens "Who do you want to play?" (who-sheet.ts) on Play's box's
// rules: Play against a friend, a friend's Challenge on the Friends tab (that friend picked), the
// Friends tab's link card (the link picked), and "Challenge a friend" on a challenge's card. Nothing
// is sent until its one button is tapped; Play never goes straight to anyone, though the friend
// last picked is listed first. A guest, or an account whose `/me` isn't known, goes straight to the
// link as before, and its waiting screen says how to challenge friends instead (sign in). Who is a
// friend and online is the inbox's list (no read of its own).
import type { FriendEntry, Invite } from '../api/friends.ts';
import { loadFriendPick, saveFriendPick } from '../app/friend-pick.ts';
import { loadFriendSetup, type FriendSetup } from '../app/modes.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import { writeSignInParams } from '../app/online-url.ts';
import { writeShellParams } from '../app/route.ts';
import { TURNS_BUILD } from '../app/turns-build.ts';
import type { WhoSource } from '../app/who-source.ts';
import { element } from '../ui/dom.ts';
import { createWhoSheet, type WhoPreset } from '../ui/online/who-sheet.ts';
import type { ChallengeInfo } from '../api/challenges.ts';
import type { ChallengeScreens } from './online-challenge-types.ts';
import { waitsForAnyone } from './online-challenge-text.ts';
import { SIGN_IN, SIGN_IN_LINE } from './who-text.ts';
import { inGameWith } from './friends-text.ts';
import { knownLive } from '../app/live-memory.ts';

export interface FriendPicker {
  /** Play against a friend, on the box's rules: who first, signed in; else the link. */
  play(setup: FriendSetup): Promise<void>;
  /**
   * Any other way in, on the box's rules (`preset`: a friend's Challenge, the link card): the
   * sheet, signed in; else `guest` (the caller's way for someone not signed in).
   */
  open(preset: WhoPreset, guest: () => unknown): Promise<void>;
  /** Whether Play asks who (an account is signed in, as this visit knows). */
  asksWho(): boolean;
  /** The inbox's friends and their status, and its friends' live challenges waiting for you. */
  statuses(friends: readonly FriendEntry[], invites?: readonly Invite[]): void;
  /** What a guest's waiting link shows after it: how to challenge friends by name. */
  lobbyAfter(card: ChallengeInfo): HTMLElement | undefined;
  close(): void;
}

export function pickerFor(
  challenges: Pick<ChallengeScreens, 'playFriend' | 'sendNow' | 'turnsWith'>,
  host: {
    readonly storage: DeviceStorage;
    readonly who: WhoSource;
    go(write: (params: URLSearchParams) => void): void;
    /** Back to the live game the player is in; false when there is none any more. */
    backToGame(): Promise<boolean>;
  },
): FriendPicker {
  let friends: readonly FriendEntry[] | undefined;
  /** The account signed in on this device, as this visit knows it (undefined: not an account). */
  const owner = (): string | undefined => {
    const who = host.who.known();
    return who?.kind === 'account' ? (who.username ?? 'account') : undefined;
  };
  const remember = (friend: FriendEntry, turns: boolean): void => {
    const signedIn = owner();
    // Listed first next time (never gone to straight away).
    if (signedIn !== undefined) {
      saveFriendPick(host.storage, { owner: signedIn, id: friend.id, name: friend.name, turns });
    }
  };

  const sheet = createWhoSheet({
    turns: TURNS_BUILD,
    send: async (pick, setup, moving) => {
      if (pick.kind === 'link') return challenges.sendNow(setup, undefined, moving);
      remember(pick.friend, pick.how === 'turns');
      if (pick.how === 'live') return challenges.sendNow(setup, pick.friend, moving);
      // By turns: its lineup first; the challenge goes with it.
      moving();
      challenges.turnsWith(pick.friend, setup);
      return undefined;
    },
    addFriend: () => {
      host.go((url) => {
        writeShellParams(url, 'friends');
      });
    },
    inGame: () => inGameWith(friends ?? [], knownLive()),
    backToGame: () => host.backToGame(),
  });

  /** Signed in as an account: asked of `/me` (shared, once a visit) only when not known yet. */
  async function signedIn(): Promise<boolean> {
    if (owner() !== undefined) return true;
    return (await host.who.ask()).kind === 'account';
  }

  function openSheet(preset: WhoPreset): void {
    const last = loadFriendPick(host.storage, owner());
    sheet.open(friends, loadFriendSetup(host.storage), preset, last?.id);
  }

  return {
    async play(setup) {
      // Not signed in: the link, as before; its waiting screen says how to sign in.
      if (!(await signedIn())) return challenges.playFriend(setup);
      openSheet(undefined);
    },
    async open(preset, guest) {
      if (!(await signedIn())) {
        await guest();
        return;
      }
      openSheet(preset);
    },
    asksWho: () => owner() !== undefined,
    statuses(next, invites = []) {
      friends = next;
      const waiting = invites.flatMap((one) =>
        one.live && one.friend !== undefined ? [one.friend] : [],
      );
      sheet.update(next, new Set(waiting));
    },
    lobbyAfter(card) {
      if (!waitsForAnyone(card) || owner() !== undefined) return undefined;
      // A guest (or unknown): one line, how to challenge friends by name.
      const line = element('p', 'who-lobby-line');
      const sign = element('button', 'text-link who-lobby-sign-in', SIGN_IN);
      sign.type = 'button';
      sign.setAttribute('aria-label', `${SIGN_IN} ${SIGN_IN_LINE}`);
      sign.addEventListener('click', () => {
        host.go(writeSignInParams);
      });
      line.append(sign, ` ${SIGN_IN_LINE}`);
      return line;
    },
    close() {
      sheet.close();
    },
  };
}
