// What the friend challenge screens (online-challenge.ts) need from the page, and what they offer
// it: kept apart so the screens' file holds only their behaviour.
import type { CurrentMatch } from '../api/live.ts';
import type { ChallengeInfo } from '../api/challenges.ts';
import type { FriendSetup } from '../app/modes.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import type { BestOf, Format } from '../sim/series.ts';
import type { Invitee } from './challenge-send.ts';

export interface ChallengeHost {
  /** Moves by the Back rules (ADR 0025). */
  go(write: (params: URLSearchParams) => void): void;
  /** Shows another screen in place of this entry. */
  replaceWith(write: (params: URLSearchParams) => void): void;
  /** In-app Back, or `toParent` when there is no history to go back to. */
  back(toParent: () => void): void;
  home(): void;
  /** Challenge a friend: the one vs Friend path (ADR 0089 addendum of 2026-11-27). */
  readonly friend: () => void;
  /**
   * An old link to the vs Friend setup (`?view=send`): Play with the box on vs Friend and these
   * rules, in its place, and "Who do you want to play?" signed in. Nothing is sent.
   */
  friendPath(rules: { readonly format: Format; readonly bestOf: BestOf }): void;
  readonly storage: DeviceStorage;
  /** Reads series `id` so its screen shows complete on arrival (ADR 0054). */
  primeSeries(id: string): Promise<void>;
  /** Goes to the player's live match or lobby, read first. */
  toMatch(match: CurrentMatch): Promise<void>;
  /** The sender's waiting screen waits for the friend (each of its asks): news is expected. */
  readonly lobbyWaits?: () => void;
  /** What a guest's waiting link shows after it: how to challenge friends by name (ADR 0089). */
  readonly lobbyAfter?: (card: ChallengeInfo) => HTMLElement | undefined;
}

export interface ChallengeScreens {
  setVisible(visible: boolean): void;
  /** A friend's link: its card (Accept), or the sender's waiting screen. */
  showChallenge(token: string): void;
  /**
   * The send screen: Play's own step (the 16+ question, a failure), a lineup by turns to send, or
   * an old link to the vs Friend setup (the one path instead).
   */
  showSend(format: Format, bestOf: BestOf): void;
  /**
   * "Who do you want to play?"'s button: a live challenge to `friend` (or a link). Calls `moving`
   * just before the next screen shows; resolves with why not, if it failed.
   */
  sendNow(
    setup: FriendSetup,
    friend: Invitee | undefined,
    moving: () => void,
  ): Promise<string | undefined>;
  /** By turns with `friend` on `setup` (the sheet's pick): its lineup first (ADR 0085). */
  turnsWith(friend: Invitee, setup: FriendSetup): void;
  /**
   * A guest's Play against a friend (ADR 0081 addendum): a link sent on `setup`, straight to the
   * waiting screen; the 16+ question first on a device without a guest.
   */
  playFriend(setup: FriendSetup): Promise<void>;
  /** The lineups picked together once a challenge or rematch is agreed (ADR 0080). */
  showStart(id: string): void;
  /** The ended series whose rematch's lineups show now, if any: it asks for itself. */
  rematchShown(): string | undefined;
  /** The page is visible again: a waiting screen asks now. */
  resumed(): void;
  /**
   * A friend's challenge accepted from the incoming banner (PR (d)): accepted at once, then straight
   * to the lineups picked together (or its card, if it was taken or stopped meanwhile). By turns
   * (`live` false, ADR 0085), its card's screen, which opens its lineup once read.
   */
  openInvite(token: string, live?: boolean): Promise<void>;
}
