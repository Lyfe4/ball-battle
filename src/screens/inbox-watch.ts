// The inbox reaching a signed-in player anywhere in the game (ADR 0079, PR (d); ADR 0081), from the
// page's first screen, whichever it is. It reads `/me/inbox` on the poll's time (inbox-poll.ts:
// every 30 s while visible, with friends; every 2 s while something is expected) and hands the
// whole answer, less what was answered here, to its host: the Friends tab's badge and its lists
// are two views of it. And (ADR 0086):
//
// - a friend's live challenge arrives as the incoming banner (one look with a rematch's): who and
//   what, Accept straight to the lineup and No thanks, only where `calm` says (never over a fight
//   or a lineup pick: it waits until the match is over); while it shows, the badge doesn't count it
//   too (one place for each piece of news);
// - ignored, it folds into the badge: the × (Later), or 20 s of the page being seen without an
//   answer, and it doesn't come back for that challenge on this page; it waits in Friends;
// - on the Friends tab there is no banner: its row in Waiting for you lights up (friends-section);
// - the sender stopping (cancelled, or their lobby went stale) while it shows turns it into "Alex
//   stopped waiting" with OK.
//
// The link the sender shares still works without any of this: the banner only saves a message.
//
// Signed in, it wants the page's poke socket (ADR 0082, `pokes.ts`): an `inbox` poke reads at once,
// and while the socket is up the poll keeps only a 120 s safety read (inbox-poll.ts).
import type { InboxResponse, Invite } from '../api/friends.ts';
import { callApi, failureKindOf } from '../app/api.ts';
import { createInboxPoll } from '../app/inbox-poll.ts';
import { pokes } from '../app/pokes.ts';
import { createIncomingBanner } from '../ui/online/incoming-banner.ts';
import { challengeIncoming, stoppedIncoming } from './incoming-text.ts';
import { failureLine } from './online-failure-text.ts';

/** How long a challenge's banner waits, while the page is seen, before it folds (ADR 0086). */
export const INVITE_FOLD_MS = 20_000;
/** The banner's bar is redrawn this often while it waits. */
const TICK_MS = 250;

export interface InboxWatchHost {
  /**
   * Accept: the challenge's lineup, read first (its button stays busy until then). By turns
   * (`live` false, ADR 0085), its card's screen, which opens its lineup.
   */
  open(token: string, live: boolean): Promise<void>;
  /** Whether a challenge may pop up now: not over a fight or a lineup pick (`invitesMayShow`). */
  calm(): boolean;
  /** The Friends tab shows: no banner, its row lights instead (ADR 0086). */
  onFriends(): boolean;
  /** The Friends tab's badge, where a folded banner lands (undefined: not on screen). */
  badge(): HTMLElement | undefined;
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
  host: InboxWatchHost,
  foldMs = INVITE_FOLD_MS,
): InboxWatch {
  let last: InboxResponse | undefined;
  /** Invites answered here (No thanks, or Accept), by token: never shown again. */
  const answered = new Set<string>();
  /** Invites whose card was closed or ignored, by token: in the badge, never popped up again. */
  const folded = new Set<string>();
  let failure: string | undefined;
  /** The challenge on the banner now. */
  let showing: Invite | undefined;
  /** Its time seen so far (ms), and since when it is being seen (undefined: the page is hidden). */
  let seenMs = 0;
  let seenSince: number | undefined;
  let ticking: number | undefined;
  /** The sender who stopped waiting while their banner showed: said until OK. */
  let stopped: string | undefined;
  /** What the host was last told, so an unchanged answer isn't handed on again. */
  let told: { inbox: InboxResponse | undefined; invites: string } | undefined;

  const open = (): readonly Invite[] =>
    last === undefined ? [] : last.invites.filter((one) => !answered.has(one.token));
  /** The newest live challenge that may still pop up; one by turns waits in the lists (ADR 0085). */
  const popping = (): Invite | undefined =>
    open().find((one) => one.live && !folded.has(one.token));
  const seen = () => seenMs + (seenSince === undefined ? 0 : Date.now() - seenSince);
  const leftOf = () => Math.max(0, 1 - seen() / foldMs);

  /** The answer handed on, less the challenge on the banner: the badge counts it once it folds. */
  function tell(): void {
    const without = showing?.token;
    const invites = open().filter((one) => one.token !== without);
    const key = invites.map((one) => one.token).join();
    if (told !== undefined && told.inbox === last && told.invites === key) return;
    told = { inbox: last, invites: key };
    host.inbox(last === undefined ? undefined : { ...last, invites });
  }

  function stopTicking(): void {
    if (ticking !== undefined) window.clearInterval(ticking);
    ticking = undefined;
  }

  /** The banner's bar, and the fold once its time is seen out. */
  function tick(): void {
    const invite = showing;
    if (invite === undefined) return;
    if (leftOf() <= 0) {
      foldNow(invite.token);
      return;
    }
    banner.show(challengeIncoming(invite, leftOf()), failure);
  }

  /** Into the badge (×, or its time seen out): never popped up again on this page. */
  function foldNow(token: string): void {
    folded.add(token);
    if (showing?.token === token) {
      showing = undefined;
      stopTicking();
      banner.fold(host.badge());
    }
    render();
  }

  const banner = createIncomingBanner(root, 'Challenge', {
    accept: () => {
      const taken = showing;
      if (taken === undefined) return Promise.resolve();
      return accept(taken.token);
    },
    decline: async () => {
      const said = showing;
      if (said === undefined) return;
      failure = await decline(said.token);
      render();
    },
    dismiss: () => {
      stopped = undefined;
      render();
    },
    later: () => {
      if (showing !== undefined) foldNow(showing.token);
    },
  });

  function render(): void {
    // On Friends, what would pop up lights its row instead (friends-section), and is kept there.
    if (host.onFriends()) {
      for (let next = popping(); next !== undefined; next = popping()) folded.add(next.token);
    }
    const invite = host.calm() && stopped === undefined ? popping() : undefined;
    if (invite?.token !== showing?.token) {
      failure = undefined;
      seenMs = 0;
      seenSince = document.hidden ? undefined : Date.now();
    }
    showing = invite;
    // The banner joins the page the first time it has something to say.
    if ((invite !== undefined || stopped !== undefined) && !root.isConnected) {
      document.body.append(root);
    }
    if (stopped !== undefined) banner.show(host.calm() ? stoppedIncoming(stopped) : undefined);
    else
      banner.show(invite === undefined ? undefined : challengeIncoming(invite, leftOf()), failure);
    if (invite !== undefined && ticking === undefined) ticking = window.setInterval(tick, TICK_MS);
    else if (invite === undefined) stopTicking();
    tell();
  }

  /** The challenge on the banner is gone from `inbox`: its sender stopped, unless they're playing. */
  function stoppedIn(inbox: InboxResponse): string | undefined {
    const was = showing;
    if (was === undefined || inbox.invites.some((one) => one.token === was.token)) return undefined;
    // Accepted on another of this player's tabs: the sender is in that match now, not gone.
    const sender = inbox.friends.find((friend) => friend.id === was.friend);
    return sender?.status === 'in_a_match' ? undefined : was.from;
  }

  async function accept(token: string): Promise<void> {
    const live = last?.invites.find((one) => one.token === token)?.live !== false;
    answered.add(token);
    await host.open(token, live);
    render();
  }

  async function decline(token: string): Promise<string | undefined> {
    const answer = await callApi<unknown>('POST', `challenges/${token}/decline`, {});
    if (!answer.ok && !(answer.kind === 'error' && answer.status < 500)) {
      return failureLine(failureKindOf(answer));
    }
    answered.add(token);
    render();
    return undefined;
  }

  async function read(): Promise<boolean> {
    const answer = await callApi<InboxResponse>('GET', 'me/inbox');
    if (!answer.ok || answer.body === undefined) return true;
    const inbox = answer.body;
    // One the sender stopped is gone from the answer, and its failure with it.
    stopped = stoppedIn(inbox) ?? stopped;
    if (stopped !== undefined) failure = undefined;
    last = inbox;
    render();
    return (
      inbox.friends.length > 0 ||
      inbox.requests > 0 ||
      inbox.invites.length > 0 ||
      inbox.turns.length > 0
    );
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
    // The fold's 20 s count only while the page is seen (a phone face down doesn't fold it).
    if (document.hidden && seenSince !== undefined) {
      seenMs += Date.now() - seenSince;
      seenSince = undefined;
    } else if (!document.hidden && showing !== undefined && seenSince === undefined) {
      seenSince = Date.now();
    }
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
        stopped = undefined;
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
