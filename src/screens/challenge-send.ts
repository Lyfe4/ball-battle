// Sending a live friend challenge (ADR 0052, 0080): from the vs Friend setup's Send challenge, or
// straight from the Play tab's Play against a friend (ADR 0081 addendum, Option B), whose rules are
// set already so it has no rules step. No lineup is sent (ADR 0080): the lobby with the link to
// share comes next. By turns (ADR 0085, where the build offers it), the setup's Send challenge
// opens the lineup first and the challenge goes with it. Kept apart from the challenge screens
// (online-challenge.ts), which show what this sends them to.
import { callApi, type ApiFailure } from '../app/api.ts';
import { saveFriendSetup, type FriendSetup } from '../app/modes.ts';
import { hasGuest, type DeviceStorage } from '../app/online-device.ts';
import { writeChallengeParams, writeSendParams } from '../app/online-url.ts';
import type { ChallengeInfo, ChallengeLink } from '../api/challenges.ts';
import type { Lineup } from '../sim/series.ts';
import type { SetupChoices } from '../ui/series/rules-step.ts';

/** Where a challenge is sent from (see `send`). */
type Via = 'setup' | 'play' | 'gate';

export interface SenderHost {
  readonly storage: DeviceStorage;
  go(write: (params: URLSearchParams) => void): void;
  replaceWith(write: (params: URLSearchParams) => void): void;
  /** On a device with no guest, asks the 16+ question, then does `then`: true when it asked. */
  askFirst(then: () => unknown): boolean;
  /** A failure as a notice in the screen's place, with `retry`. */
  failed(answer: ApiFailure, retry: () => Promise<unknown>): void;
  /** The link is made and its card read (if it could be): the lobby shows next. */
  sent(token: string, info: ChallengeInfo | undefined): void;
  /** By turns (ADR 0085): the lineup to send with it, on this screen. */
  lineupFirst(chosen: SetupChoices): void;
}

export interface Sender {
  /** The vs Friend setup's Send challenge (by turns, its lineup first). */
  send(chosen: SetupChoices): Promise<void>;
  /** A challenge by turns with its sender's lineup (ADR 0085). */
  sendTurns(chosen: SetupChoices, lineup: Lineup): Promise<void>;
  /** The Play tab's Play against a friend: no rules step. */
  playFriend(setup: FriendSetup): Promise<void>;
  /** The friend the next challenge is for (a friend row's Challenge), or none. */
  invite(friend: { readonly id: string; readonly name: string } | undefined): void;
  /** What Play left for the send screen to show (the 16+ question, or why it failed), once. */
  takeLeft(): (() => void) | undefined;
}

export function createSender(host: SenderHost): Sender {
  /** One id per challenge being sent, so a retry after a lost answer gets the same link. */
  let requestId = crypto.randomUUID();
  /** The friend the challenge being sent is for (ADR 0079 PR (d)), if any. */
  let inviting: { readonly id: string; readonly name: string } | undefined;
  let left: (() => void) | undefined;

  /** Play's own step on the send screen, in place of its rules step. */
  function leave(show: () => void, chosen: SetupChoices): void {
    left = show;
    host.go((url) => {
      writeSendParams(url, chosen.format, chosen.bestOf);
    });
  }

  /**
   * Sends the challenge, then the lobby. `via` is where from: the vs Friend setup (the lobby a step
   * on from it); the Play tab (the lobby a step on from home, or a failure shown on the send
   * screen); or the send screen Play opened for the 16+ question (the lobby in its place, so Back
   * from the lobby is home, never a rules step).
   */
  async function send(chosen: SetupChoices, via: Via, lineup?: Lineup): Promise<void> {
    if (host.askFirst(() => send(chosen, via === 'play' ? 'gate' : via, lineup))) return;
    // Live (ADR 0053): both players in the match until it ends. By turns, with the lineup.
    const body = {
      format: chosen.format,
      bestOf: chosen.bestOf,
      requestId,
      live: lineup === undefined,
      ...(lineup === undefined ? {} : { lineup }),
      ...(inviting === undefined ? {} : { friend: inviting.id }),
    };
    const answer = await callApi<ChallengeLink>('POST', 'challenges', body);
    if (!answer.ok) {
      const retry = () => send(chosen, via === 'play' ? 'gate' : via, lineup);
      // Home has no room for it: the send screen says what failed, with Try again there.
      if (via === 'play') {
        leave(() => {
          host.failed(answer, retry);
        }, chosen);
      } else host.failed(answer, retry);
      return;
    }
    // Each opponent's rules are remembered (ADR 0081): the friend's, as sent.
    saveFriendSetup(host.storage, chosen);
    const link = answer.body;
    if (link === undefined) return;
    requestId = crypto.randomUUID();
    inviting = undefined;
    // The sender's own card (the lobby) shares the link. It is read first, so the button stays
    // busy until the lobby can show.
    const card = await callApi<ChallengeInfo>('GET', `challenges/${link.token}`);
    host.sent(link.token, card.ok ? card.body : undefined);
    const write = (url: URLSearchParams) => {
      writeChallengeParams(url, link.token);
    };
    if (via === 'gate') host.replaceWith(write);
    else host.go(write);
  }

  return {
    send(chosen) {
      if (chosen.turns !== true) return send(chosen, 'setup');
      host.lineupFirst(chosen);
      return Promise.resolve();
    },
    sendTurns: (chosen, lineup) => send(chosen, 'setup', lineup),
    async playFriend(setup) {
      const chosen: SetupChoices = { ...setup, level: '' };
      // With a guest, sent from home: Play stays busy until the lobby can show.
      if (hasGuest(host.storage)) {
        await send(chosen, 'play');
        return;
      }
      // Without one, the send screen asks the 16+ question first; the lobby takes its place.
      leave(() => {
        if (!host.askFirst(() => send(chosen, 'gate'))) void send(chosen, 'gate');
      }, chosen);
    },
    invite(friend) {
      inviting = friend;
    },
    takeLeft() {
      const show = left;
      left = undefined;
      return show;
    },
  };
}
