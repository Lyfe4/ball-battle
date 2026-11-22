// What the friend challenge screens (online-challenge.ts) need from the page, and what they offer
// it: kept apart so the screens' file holds only their behaviour.
import type { CurrentMatch } from '../api/live.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import type { SendStep } from '../app/online-url.ts';
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
  /** A friend's link: its card, or the lineup that accepts it. */
  showChallenge(token: string, step: 'card' | 'lineup'): void;
  /** Sending a challenge: the vs Friend setup, or the lineup for it (or for a rematch). */
  showSend(format: Format, bestOf: BestOf, step: SendStep, rematch?: string): void;
  /** The page is visible again: a waiting lobby asks now. */
  resumed(): void;
  /**
   * Challenge a friend from the Friends section (ADR 0079 PR (d)): the vs Friend setup, then the
   * lineup, and the challenge sent goes to their inbox too. Kept until it is sent or the player
   * leaves these screens.
   */
  challengeFriend(friend: { readonly id: string; readonly name: string }): void;
  /**
   * A friend's challenge accepted from the floating card (PR (d)): read first, then straight to
   * its lineup (or its card, if it was taken or stopped meanwhile).
   */
  openInvite(token: string): Promise<void>;
}
