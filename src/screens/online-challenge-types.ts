// What the friend challenge screens (online-challenge.ts) need from the page, and what they offer
// it: kept apart so the screens' file holds only their behaviour.
import type { CurrentMatch } from '../api/live.ts';
import type { FriendSetup } from '../app/modes.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import type { BestOf, Format } from '../sim/series.ts';

export interface ChallengeHost {
  /** Moves by the Back rules (ADR 0025). */
  go(write: (params: URLSearchParams) => void): void;
  /** Shows another screen in place of this entry. */
  replaceWith(write: (params: URLSearchParams) => void): void;
  /** Rewrites this entry's URL without showing it again. */
  rewrite(write: (params: URLSearchParams) => void): void;
  /** In-app Back, or `toParent` when there is no history to go back to. */
  back(toParent: () => void): void;
  home(): void;
  /** The vs Friend setup, where challenges are sent from (ADR 0055). */
  friend(): void;
  readonly storage: DeviceStorage;
  /** Reads series `id` so its screen shows complete on arrival (ADR 0054). */
  primeSeries(id: string): Promise<void>;
  /** Goes to the player's live match or lobby, read first. */
  toMatch(match: CurrentMatch): Promise<void>;
  /** The sender's lobby waits for the friend (each of its asks): news is expected. */
  readonly lobbyWaits?: () => void;
}

export interface ChallengeScreens {
  setVisible(visible: boolean): void;
  /** A friend's link: its card (Accept), or the sender's lobby. */
  showChallenge(token: string): void;
  /** Sending a challenge: the vs Friend setup, which sends it (ADR 0080). */
  showSend(format: Format, bestOf: BestOf): void;
  /**
   * The Play tab's Play against a friend (ADR 0081 addendum): sent on `setup` with no rules step,
   * straight to the link to share; the 16+ question first on a device without a guest.
   */
  playFriend(setup: FriendSetup): Promise<void>;
  /** The lineups picked together once a challenge or rematch is agreed (ADR 0080). */
  showStart(id: string): void;
  /** The ended series whose rematch's lineups show now, if any: it asks for itself. */
  rematchShown(): string | undefined;
  /** The page is visible again: a waiting lobby asks now. */
  resumed(): void;
  /**
   * Challenge a friend from the Friends section (ADR 0079 PR (d)): the vs Friend setup, and the
   * challenge sent goes to their inbox too. Kept until it is sent or the player
   * leaves these screens. `turns` (Take turns in the friend's sheet, ADR 0085, 0086): by turns,
   * straight to its lineup on the friend's rules as last chosen.
   */
  challengeFriend(friend: { readonly id: string; readonly name: string }, turns?: boolean): void;
  /**
   * A friend's challenge accepted from the incoming banner (PR (d)): accepted at once, then straight
   * to the lineups picked together (or its card, if it was taken or stopped meanwhile). By turns
   * (`live` false, ADR 0085), its card's screen, which opens its lineup once read.
   */
  openInvite(token: string, live?: boolean): Promise<void>;
}
