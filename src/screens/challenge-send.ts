// Sending a friend challenge (ADR 0052, 0080), on the rules of Play's box (no rules step): from
// "Who do you want to play?"'s one button (ADR 0089 addendum of 2026-11-27: busy on that button,
// a failure said in the sheet), or Play against a friend for a guest, straight to the link (the
// 16+ question first on a device without a guest, a failure on the send screen). No lineup is sent
// live (ADR 0080): the waiting screen comes next. By turns (ADR 0085, where the build offers it)
// the lineup comes first, on the send screen, and the challenge goes with it. Kept apart from the
// challenge screens (online-challenge.ts), which show what this sends them to.
import { callApi, failureKindOf, type ApiFailure } from '../app/api.ts';
import { saveFriendSetup, type FriendSetup } from '../app/modes.ts';
import { hasGuest, type DeviceStorage } from '../app/online-device.ts';
import { writeChallengeParams, writeSendParams } from '../app/online-url.ts';
import type { ChallengeInfo, ChallengeLink } from '../api/challenges.ts';
import type { Lineup } from '../sim/series.ts';
import type { SetupChoices } from '../ui/series/rules-step.ts';
import { failureText } from './online-failure-text.ts';

/** Who a challenge is for: a friend by the friendship's id, with their name for the screens. */
export interface Invitee {
  readonly id: string;
  readonly name: string;
}

export interface SenderHost {
  readonly storage: DeviceStorage;
  go(write: (params: URLSearchParams) => void): void;
  replaceWith(write: (params: URLSearchParams) => void): void;
  /** On a device with no guest, asks the 16+ question, then does `then`: true when it asked. */
  askFirst(then: () => unknown): boolean;
  /** A failure as a notice in the screen's place, with `retry`. */
  failed(answer: ApiFailure, retry: () => Promise<unknown>): Promise<void>;
  /** The link is made and its card read (if it could be): the waiting screen shows next. */
  sent(token: string, info: ChallengeInfo | undefined): void;
  /** Crossed (the friend waited for you): their challenge was accepted; into its lineups. */
  intoStart(id: string): Promise<void>;
}

export interface Sender {
  /**
   * "Who do you want to play?"'s button: a live challenge to `friend` (or a link to anyone) on
   * `setup`. Calls `moving` just before the next screen shows; resolves with the line that says
   * why not, if it failed (the sheet says it, the pick kept for Try again).
   */
  sendNow(
    setup: FriendSetup,
    friend: Invitee | undefined,
    moving: () => void,
  ): Promise<string | undefined>;
  /** A challenge by turns with its sender's lineup (ADR 0085), to the friend `turnsWith` named. */
  sendTurns(chosen: SetupChoices, lineup: Lineup): Promise<void>;
  /**
   * A live challenge with no sheet: a guest's Play against a friend (a link), or the sheet's pick
   * on a device without a guest yet, the 16+ question first on the send screen.
   */
  playFriend(setup: FriendSetup, friend?: Invitee): Promise<void>;
  /** By turns with `friend` (the sheet's pick): the send screen opens its lineup next. */
  turnsWith(friend: Invitee): void;
  /** Leaving the challenge screens: a friend picked for by turns is forgotten. */
  forget(): void;
  /** Whether the send screen goes straight on to the lineup by turns: true once, then false. */
  turnsFirst(): boolean;
  /** What Play left for the send screen to show (the 16+ question, or why it failed), once. */
  takeLeft(): (() => void) | undefined;
}

/** One line for a failed send, in the game's words (`CHALLENGE_REFUSALS`). */
export function sendFailureLine(answer: ApiFailure): string {
  const reason = answer.kind === 'error' ? answer.message : undefined;
  const code = answer.kind === 'error' ? answer.code : undefined;
  const text = failureText(failureKindOf(answer), reason, code);
  return `${text.title}. ${text.body}`;
}

export function createSender(host: SenderHost): Sender {
  /** One id per challenge being sent, so a retry after a lost answer gets the same link. */
  let requestId = crypto.randomUUID();
  /** What `requestId` is for: a different pick is a different challenge, with its own id. */
  let sending: string | undefined;
  /** The friend the challenge being sent is for (ADR 0079 PR (d)), if any. */
  let inviting: Invitee | undefined;
  let left: (() => void) | undefined;
  let straightToLineup = false;

  /** The same pick again (a Try again) keeps its id; a new one gets its own. */
  function idFor(chosen: Pick<SetupChoices, 'format' | 'bestOf'>, live: boolean): string {
    const what = JSON.stringify([chosen.format, chosen.bestOf, live, inviting?.id ?? null]);
    if (sending !== what) requestId = crypto.randomUUID();
    sending = what;
    return requestId;
  }

  /** Done: the next challenge, even to the same friend on the same rules, is a new one. */
  function sent(chosen: SetupChoices): void {
    // Each opponent's rules are remembered (ADR 0081): the friend's, as sent.
    saveFriendSetup(host.storage, chosen);
    requestId = crypto.randomUUID();
    sending = undefined;
    inviting = undefined;
  }

  /** Play's own step on the send screen (the 16+ question, or a failure). */
  function leave(show: () => void, chosen: SetupChoices): void {
    left = show;
    host.go((url) => {
      writeSendParams(url, chosen.format, chosen.bestOf);
    });
  }

  /**
   * Sends the challenge, then the waiting screen. `via`: the Play tab (a step on from home, or a
   * failure shown on the send screen); the send screen Play opened for the 16+ question, or a
   * lineup by turns on it (the waiting screen in its place, so Back never returns to it).
   */
  async function send(chosen: SetupChoices, via: 'play' | 'gate', lineup?: Lineup): Promise<void> {
    if (host.askFirst(() => send(chosen, via, lineup))) return;
    // Live (ADR 0053): both players in the match until it ends. By turns, with the lineup.
    const body = {
      format: chosen.format,
      bestOf: chosen.bestOf,
      requestId: idFor(chosen, lineup === undefined),
      live: lineup === undefined,
      ...(lineup === undefined ? {} : { lineup }),
      ...(inviting === undefined ? {} : { friend: inviting.id }),
    };
    const answer = await callApi<ChallengeLink>('POST', 'challenges', body);
    if (!answer.ok) {
      const retry = () => send(chosen, 'gate', lineup);
      // Home has no room for it: the send screen says what failed, with Try again there.
      if (via === 'play') {
        leave(() => {
          void host.failed(answer, retry);
        }, chosen);
      } else await host.failed(answer, retry);
      return;
    }
    sent(chosen);
    const link = answer.body;
    if (link === undefined) return;
    if (link.startId !== undefined) {
      await host.intoStart(link.startId);
      return;
    }
    // The sender's own card (the waiting screen) is read first, so Play stays busy until it shows.
    const card = await callApi<ChallengeInfo>('GET', `challenges/${link.token}`);
    host.sent(link.token, card.ok ? card.body : undefined);
    const write = (url: URLSearchParams) => {
      writeChallengeParams(url, link.token);
    };
    if (via === 'gate') host.replaceWith(write);
    else host.go(write);
  }

  async function playFriend(setup: FriendSetup, friend?: Invitee): Promise<void> {
    const chosen: SetupChoices = { ...setup, level: '', turns: false };
    inviting = friend;
    // With a guest, sent from home: Play stays busy until the waiting screen can show.
    if (hasGuest(host.storage)) {
      await send(chosen, 'play');
      return;
    }
    // Without one, the send screen asks the 16+ question first; the waiting screen takes its place.
    leave(() => {
      if (!host.askFirst(() => send(chosen, 'gate'))) void send(chosen, 'gate');
    }, chosen);
  }

  return {
    async sendNow(setup, friend, moving) {
      const chosen: SetupChoices = { ...setup, level: '', turns: false };
      // No guest on this device yet: the 16+ question first, on the send screen.
      if (!hasGuest(host.storage)) {
        moving();
        await playFriend(setup, friend);
        return undefined;
      }
      inviting = friend;
      const body = {
        format: chosen.format,
        bestOf: chosen.bestOf,
        requestId: idFor(chosen, true),
        live: true,
        ...(friend === undefined ? {} : { friend: friend.id }),
      };
      const answer = await callApi<ChallengeLink>('POST', 'challenges', body);
      if (!answer.ok) {
        // The guest's session is gone (a cleared cookie): the 16+ question again, on its screen.
        if (answer.kind === 'error' && answer.code === 'unauthenticated') {
          moving();
          await playFriend(setup, friend);
          return undefined;
        }
        return sendFailureLine(answer);
      }
      sent(chosen);
      const link = answer.body;
      if (link === undefined) return undefined;
      // Crossed: the friend was waiting for you, so theirs was accepted: both pick lineups now.
      if (link.startId !== undefined) {
        moving();
        await host.intoStart(link.startId);
        return undefined;
      }
      // The waiting screen's card, read first so it shows complete (the button stays busy).
      const card = await callApi<ChallengeInfo>('GET', `challenges/${link.token}`);
      moving();
      host.sent(link.token, card.ok ? card.body : undefined);
      host.go((url) => {
        writeChallengeParams(url, link.token);
      });
      return undefined;
    },
    sendTurns: (chosen, lineup) => send(chosen, 'gate', lineup),
    playFriend,
    turnsWith(friend) {
      inviting = friend;
      straightToLineup = true;
    },
    forget() {
      inviting = undefined;
      straightToLineup = false;
    },
    turnsFirst() {
      const first = straightToLineup;
      straightToLineup = false;
      return first;
    },
    takeLeft() {
      const show = left;
      left = undefined;
      return show;
    },
  };
}
