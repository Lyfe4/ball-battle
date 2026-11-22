// The inbox reaching a signed-in player anywhere in the game (ADR 0079, PR (d)), from the page's
// first screen, whichever it is. It reads `/me/inbox` on the poll's time (inbox-poll.ts: every 30 s
// while visible, with friends; every 2 s while something is expected) and:
//
// - a friend's live challenge shows as the rematch's floating card (one look, ADR 0070): who and
//   what, Accept straight to the lineup and No thanks, on any calm screen and never over a fight,
//   where it waits until the fight is over;
// - the friends' status goes to the Friends section, if it shows.
//
// The link the sender shares still works without any of this: the card only saves a message.
import type { FriendEntry, InboxResponse, Invite } from '../api/friends.ts';
import { callApi } from '../app/api.ts';
import { createInboxPoll } from '../app/inbox-poll.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { createRematchNotice } from '../ui/online/rematch-notice.ts';
import { failureLine } from './online-failure-text.ts';
import { failureKindOf } from '../app/api.ts';
import { inviteLine } from './friends-text.ts';

export interface InboxWatchHost {
  /** Accept: the challenge's lineup, read first (its button stays busy until then). */
  open(token: string): Promise<void>;
  /** A fight is on screen: nothing may cover it, so the card waits. */
  fighting(): boolean;
  /** The friends' status, as each answer brings it. */
  friends(friends: readonly FriendEntry[]): void;
  /** Something is expected (a rematch window, a lobby waiting): the inbox reads every 2 s. */
  expecting(): boolean;
}

export interface InboxWatch {
  /** Signed in to an account (true) or not: the poll starts or stops. */
  signedIn(account: boolean): void;
  /** The friends changed here (a request sent or answered): read now. */
  poke(): void;
  /** The screen changed (a fight started or ended): shown or held. */
  refresh(): void;
  /** Something may be expected now: the next read comes within 2 s (inbox-poll.ts). */
  quicken(): void;
}

export function createInboxWatch(
  root: HTMLElement,
  lookup: DefinitionLookup,
  host: InboxWatchHost,
): InboxWatch {
  let invite: Invite | undefined;
  /** Invites answered here (No thanks, or Accept), by token: never shown again. */
  const answered = new Set<string>();
  let failure: string | undefined;

  const card = createRematchNotice(
    root,
    lookup,
    {
      accept: () => {
        const taken = invite;
        if (taken === undefined) return Promise.resolve();
        answered.add(taken.token);
        return host.open(taken.token).then(() => {
          invite = undefined;
          render();
        });
      },
      decline: async () => {
        const said = invite;
        if (said === undefined) return;
        const answer = await callApi<unknown>('POST', `challenges/${said.token}/decline`, {});
        if (!answer.ok && !(answer.kind === 'error' && answer.status < 500)) {
          failure = failureLine(failureKindOf(answer));
          render();
          return;
        }
        answered.add(said.token);
        invite = undefined;
        failure = undefined;
        render();
      },
      dismiss: () => {
        invite = undefined;
        render();
      },
    },
    'Challenge',
  );

  function render(): void {
    const calm = !host.fighting();
    const said =
      calm && invite !== undefined
        ? { kind: 'invite' as const, line: inviteLine(invite) }
        : undefined;
    // The card joins the page the first time it has something to say: a page with no challenge
    // holds one floating card of this look, the rematch's.
    if (said !== undefined && !root.isConnected) document.body.append(root);
    card.show(said, failure);
  }

  async function read(): Promise<boolean> {
    const answer = await callApi<InboxResponse>('GET', 'me/inbox');
    if (!answer.ok || answer.body === undefined) return true;
    const inbox = answer.body;
    host.friends(inbox.friends);
    // The newest invite not answered here; one the sender stopped is gone from the answer.
    const next = inbox.invites.find((one) => !answered.has(one.token));
    if (next?.token !== invite?.token) failure = undefined;
    invite = next;
    render();
    return inbox.friends.length > 0 || inbox.requests > 0 || inbox.invites.length > 0;
  }

  const poll = createInboxPoll({
    read,
    hidden: () => document.hidden,
    expecting: () => host.expecting(),
    setTimer: (run, ms) => window.setTimeout(run, ms),
    clearTimer: (id) => {
      window.clearTimeout(id);
    },
  });
  document.addEventListener('visibilitychange', () => {
    poll.visibility();
  });

  return {
    signedIn(account) {
      if (account) poll.start();
      else {
        poll.stop();
        invite = undefined;
        render();
      }
    },
    poke() {
      poll.poke();
    },
    refresh: render,
    quicken() {
      poll.quicken();
    },
  };
}
