// The inbox reaching a signed-in player anywhere in the game (ADR 0079, PR (d); ADR 0081), from the
// page's first screen, whichever it is. It reads `/me/inbox` on the poll's time (inbox-poll.ts:
// every 30 s while visible, with friends; every 2 s while something is expected) and hands the
// whole answer, less what was answered here, to its host: the Friends tab's badge, the Play tab's
// status strip and the Friends tab's lists are three views of it. And:
//
// - a friend's live challenge pops up as the rematch's floating card (one look, ADR 0070): who and
//   what, Accept straight to the lineup and No thanks, only where `calm` says (never over a fight
//   or a lineup pick: it waits until the match is over);
// - ignored, it folds back into the badge: closed, or after 20 s without an answer, it goes and
//   doesn't come back for that challenge on this page; the challenge stays in Waiting for you.
//
// The link the sender shares still works without any of this: the card only saves a message.
//
// Signed in, it wants the page's poke socket (ADR 0082, `pokes.ts`): an `inbox` poke reads at once,
// and while the socket is up the poll keeps only a 120 s safety read (inbox-poll.ts).
import type { InboxResponse, Invite } from '../api/friends.ts';
import { callApi, failureKindOf } from '../app/api.ts';
import { createInboxPoll } from '../app/inbox-poll.ts';
import { pokes } from '../app/pokes.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { createRematchNotice } from '../ui/online/rematch-notice.ts';
import { inviteLine } from './friends-text.ts';
import { failureLine } from './online-failure-text.ts';

/** How long a challenge's card waits for an answer before it folds into the badge (ADR 0081). */
export const INVITE_FOLD_MS = 20_000;

export interface InboxWatchHost {
  /** Accept: the challenge's lineup, read first (its button stays busy until then). */
  open(token: string): Promise<void>;
  /** Whether a challenge may pop up now: not over a fight or a lineup pick (`invitesMayShow`). */
  calm(): boolean;
  /** The inbox as it stands here (undefined: signed out, nothing to show). */
  inbox(answer: InboxResponse | undefined): void;
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
  /** Accept a challenge from the Friends tab: its lineup, as the card's Accept. */
  accept(token: string): Promise<void>;
  /** No thanks, from the Friends tab: undefined when said, else the line that says why not. */
  decline(token: string): Promise<string | undefined>;
}

export function createInboxWatch(
  root: HTMLElement,
  lookup: DefinitionLookup,
  host: InboxWatchHost,
  foldMs = INVITE_FOLD_MS,
): InboxWatch {
  let last: InboxResponse | undefined;
  /** Invites answered here (No thanks, or Accept), by token: never shown again. */
  const answered = new Set<string>();
  /** Invites whose card was closed or ignored, by token: in the badge, never popped up again. */
  const folded = new Set<string>();
  let failure: string | undefined;
  /** The challenge whose card shows now, and its fold timer. */
  let showing: string | undefined;
  let fold: number | undefined;

  const open = (): readonly Invite[] =>
    last === undefined ? [] : last.invites.filter((one) => !answered.has(one.token));
  /** The newest challenge that may still pop up. */
  const popping = (): Invite | undefined => open().find((one) => !folded.has(one.token));

  function tell(): void {
    host.inbox(last === undefined ? undefined : { ...last, invites: open() });
  }

  function foldNow(token: string): void {
    folded.add(token);
    render();
  }

  const card = createRematchNotice(
    root,
    lookup,
    {
      accept: () => {
        const taken = popping();
        if (taken === undefined) return Promise.resolve();
        return accept(taken.token);
      },
      decline: async () => {
        const said = popping();
        if (said === undefined) return;
        failure = await decline(said.token);
        render();
      },
      dismiss: () => {
        const closed = popping();
        if (closed !== undefined) foldNow(closed.token);
      },
    },
    'Challenge',
  );

  function render(): void {
    const invite = host.calm() ? popping() : undefined;
    const said =
      invite === undefined ? undefined : { kind: 'invite' as const, line: inviteLine(invite) };
    // Ignored for 20 s from when it first shows, it folds back into the badge.
    if (invite?.token !== showing) {
      if (fold !== undefined) window.clearTimeout(fold);
      fold = undefined;
      showing = invite?.token;
      if (invite !== undefined) {
        const token = invite.token;
        fold = window.setTimeout(() => {
          foldNow(token);
        }, foldMs);
      }
    }
    // The card joins the page the first time it has something to say: a page with no challenge
    // holds one floating card of this look, the rematch's.
    if (said !== undefined && !root.isConnected) document.body.append(root);
    card.show(said, invite === undefined ? undefined : failure);
  }

  async function accept(token: string): Promise<void> {
    answered.add(token);
    await host.open(token);
    tell();
    render();
  }

  async function decline(token: string): Promise<string | undefined> {
    const answer = await callApi<unknown>('POST', `challenges/${token}/decline`, {});
    if (!answer.ok && !(answer.kind === 'error' && answer.status < 500)) {
      return failureLine(failureKindOf(answer));
    }
    answered.add(token);
    tell();
    render();
    return undefined;
  }

  async function read(): Promise<boolean> {
    const answer = await callApi<InboxResponse>('GET', 'me/inbox');
    if (!answer.ok || answer.body === undefined) return true;
    const inbox = answer.body;
    // One the sender stopped is gone from the answer, and its failure with it.
    if (popping()?.token !== inbox.invites.find((one) => !answered.has(one.token))?.token) {
      failure = undefined;
    }
    last = inbox;
    tell();
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
  pokes?.listen({
    onPoke: (event) => {
      if (event === 'inbox') poll.poke();
    },
    onState: (up) => {
      poll.socket(up);
    },
  });
  /** Lets the poke socket go: set while signed in. */
  let release: (() => void) | undefined;

  return {
    signedIn(account) {
      if (account) {
        // Asked again after a sign-in or a switch: the player, and so the topic, may be new.
        if (release === undefined) release = pokes?.want();
        else pokes?.refresh();
        poll.start();
      } else {
        release?.();
        release = undefined;
        poll.stop();
        last = undefined;
        tell();
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
    accept,
    decline,
  };
}
