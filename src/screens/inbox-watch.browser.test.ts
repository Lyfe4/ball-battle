// A friend's live challenge reaches a signed-in player anywhere (ADR 0079, PR (d); ADR 0081, 0086),
// over a fake inbox: the incoming banner says who and what, never over a fight or a lineup pick
// (it waits until the match is over), Accept goes straight to the challenge's lineup, No thanks
// tells the server and the banner goes; ignored (the ×, or 20 s while the page is seen) it folds
// into the badge, which pulses once, and doesn't come back; while it shows the badge doesn't count
// it too; on Friends there is no banner; a sender who stops waiting is said with OK; the whole
// answer is handed on (the badge, the Friends tab); signed out, nothing is read and nothing waits.
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../style.css';
import type { InboxResponse } from '../api/friends.ts';
import { waitingCount } from './friends-text.ts';
import { LATER_NAME } from './incoming-text.ts';
import { createInboxWatch, INVITE_FOLD_MS, nextStop } from './inbox-watch.ts';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const INBOX: InboxResponse = {
  friends: [{ id: 'f-1', name: 'Sam_R', status: 'online' }],
  requests: 0,
  invites: [
    { token: TOKEN, from: 'Sam_R', friend: 'f-1', format: 'reveal', bestOf: 3, live: true },
  ],
  turns: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'hidden');
});

function watch(busy = false, foldMs = INVITE_FOLD_MS, first = INBOX) {
  const sent: string[] = [];
  let inbox = first;
  let friendsShown = false;
  const badgeNode = document.createElement('span');
  badgeNode.className = 'tab-bar-badge';
  badgeNode.textContent = '1';
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, location.href).pathname;
    sent.push(`${init?.method ?? 'GET'} ${path}`);
    if (path === '/api/v1/me/inbox') {
      return Promise.resolve(
        new Response(JSON.stringify(inbox), { headers: { 'Content-Type': 'application/json' } }),
      );
    }
    inbox = { ...inbox, invites: [] };
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  const root = document.createElement('div');
  document.body.replaceChildren(root, badgeNode);
  const went: string[] = [];
  const seen: string[] = [];
  /** What the badge would count, after each answer handed on. */
  const badge: number[] = [];
  let calm = !busy;
  const inboxWatch = createInboxWatch(
    root,
    {
      open: (token, live) => {
        went.push(live ? token : `${token} by turns`);
        return Promise.resolve();
      },
      calm: () => calm,
      onFriends: () => friendsShown,
      badge: () => badgeNode,
      expecting: () => false,
      inbox: (answer) => {
        badge.push(answer === undefined ? 0 : waitingCount(answer));
        if (answer !== undefined) {
          seen.push(answer.friends.map((f) => `${f.name} ${f.status ?? ''}`).join());
        }
      },
    },
    foldMs,
  );
  return {
    inboxWatch,
    root,
    sent,
    went,
    seen,
    badge,
    badgeNode,
    setBusy: (value: boolean) => {
      calm = !value;
    },
    setFriends: (value: boolean) => {
      friendsShown = value;
    },
    /** The next inbox answer. */
    answer: (next: InboxResponse) => {
      inbox = next;
    },
  };
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The page hidden or seen again, as a phone face down and back. */
function hide(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

const until = async (check: () => boolean, what: string) => {
  const end = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
const press = (root: HTMLElement, text: string) => {
  [...root.querySelectorAll<HTMLButtonElement>('button')]
    .find(
      (button) =>
        (button.textContent === text || button.getAttribute('aria-label') === text) &&
        !button.hidden,
    )
    ?.click();
};
const words = (root: HTMLElement) =>
  [root.querySelector('.incoming-title'), root.querySelector('.incoming-line')].map(
    (node) => node?.textContent,
  );
const shown = (root: HTMLElement) => root.isConnected && !root.hidden;

describe('a friend’s challenge on the incoming banner', () => {
  it('shows who and what with No thanks, Accept and the ×; Accept opens its lineup', async () => {
    const { inboxWatch, root, went, seen, badge } = watch();
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    expect(root.getAttribute('aria-label')).toBe('Challenge');
    expect(words(root)).toStrictEqual(['Sam_R challenges you', 'Best of 3 · Reveal · live']);
    expect(
      [...root.querySelectorAll<HTMLButtonElement>('button')]
        .filter((one) => !one.hidden)
        .map((one) => one.getAttribute('aria-label') ?? one.textContent),
    ).toStrictEqual([LATER_NAME, 'No thanks', 'Accept']);
    // One place for the news: the badge doesn't count what the banner shows.
    expect(badge.at(-1)).toBe(0);
    expect(root.querySelector<HTMLElement>('.incoming-bar')?.hidden).toBe(false);
    expect(seen).toStrictEqual(['Sam_R online']);
    press(root, 'Accept');
    await until(() => went.length === 1, 'the lineup');
    expect(went).toStrictEqual([TOKEN]);
    expect(root.hidden).toBe(true);
  });

  it('waits through a fight or a lineup pick, counted on the badge, and shows once it is over', async () => {
    const { inboxWatch, root, sent, setBusy, badge } = watch(true);
    inboxWatch.signedIn(true);
    await until(() => sent.length === 1, 'the read');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(root.hidden).toBe(true);
    // Not shown, but waiting: the badge counts it already.
    expect(badge.at(-1)).toBe(1);
    setBusy(false);
    inboxWatch.refresh();
    expect(root.hidden).toBe(false);
  });

  it('folds back into the badge when unanswered for its time, and never pops up again', async () => {
    // 20 s in the game (INVITE_FOLD_MS); a short time here, in real time.
    expect(INVITE_FOLD_MS).toBe(20_000);
    const { inboxWatch, root, badge } = watch(false, 300);
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    const shownAt = Date.now();
    await until(() => root.hidden === true, 'the card to fold');
    expect(Date.now() - shownAt).toBeGreaterThanOrEqual(250);
    // Still waiting on the player: on the badge, and in Waiting for you.
    expect(badge.at(-1)).toBe(1);
    const answers = badge.length;
    inboxWatch.poke();
    await until(() => badge.length > answers, 'the next read');
    inboxWatch.refresh();
    expect(root.hidden).toBe(true);
  });

  it('closed with the ×, it folds into the badge, which pulses once; Accept in Friends works', async () => {
    const { inboxWatch, root, went, badge, badgeNode } = watch();
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    press(root, LATER_NAME);
    // Counted on the badge at once; the banner lands in it, then the badge pulses.
    expect(badge.at(-1)).toBe(1);
    await until(() => root.hidden === true, 'the fold');
    await until(() => badgeNode.hasAttribute('data-pulse') || reduced(), 'the pulse');
    inboxWatch.refresh();
    expect(root.hidden).toBe(true);
    await inboxWatch.accept(TOKEN);
    expect(went).toStrictEqual([TOKEN]);
    expect(badge.at(-1)).toBe(0);
  });

  it('never pops up for a challenge by turns: counted, and Accept opens it by turns (ADR 0085)', async () => {
    const byTurns = { ...INBOX, invites: INBOX.invites.map((one) => ({ ...one, live: false })) };
    const { inboxWatch, root, sent, went, badge } = watch(false, INVITE_FOLD_MS, byTurns);
    inboxWatch.signedIn(true);
    await until(() => sent.length === 1 && badge.length > 0, 'the read');
    inboxWatch.refresh();
    expect(root.hidden || !root.isConnected).toBe(true);
    expect(badge.at(-1)).toBe(1);
    await inboxWatch.accept(TOKEN);
    expect(went).toStrictEqual([`${TOKEN} by turns`]);
  });

  it('never shows on Friends: it is kept there, and not popped up after (ADR 0086)', async () => {
    const { inboxWatch, root, sent, setFriends, badge } = watch();
    setFriends(true);
    inboxWatch.signedIn(true);
    await until(() => sent.length === 1 && badge.length > 0, 'the read');
    expect(shown(root)).toBe(false);
    expect(badge.at(-1)).toBe(1);
    setFriends(false);
    inboxWatch.refresh();
    expect(shown(root)).toBe(false);
  });

  it('says the sender stopped waiting, with OK, when their challenge goes while it shows', async () => {
    const { inboxWatch, root, answer, badge } = watch();
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    answer({ ...INBOX, invites: [] });
    inboxWatch.poke();
    await until(() => words(root)[0] === 'Sam_R stopped waiting', 'the sender gone');
    expect(words(root)[1]).toBe('Challenge them back from Friends');
    expect(badge.at(-1)).toBe(0);
    press(root, 'OK');
    expect(root.hidden).toBe(true);
  });

  it('says nothing when the challenge was taken on another tab (the sender is in that match)', async () => {
    const { inboxWatch, root, answer, sent } = watch();
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    answer({
      ...INBOX,
      friends: [{ id: 'f-1', name: 'Sam_R', status: 'in_a_match' }],
      invites: [],
    });
    const reads = sent.length;
    inboxWatch.poke();
    await until(() => sent.length > reads, 'the read');
    await until(() => root.hidden === true, 'the banner to go');
  });

  it('counts its 20 s only while the page is seen', async () => {
    const { inboxWatch, root } = watch(false, 300);
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    hide(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(root.hidden, 'not folded while hidden').toBe(false);
    hide(false);
    await until(() => root.hidden === true, 'the fold once seen');
  });

  it('No thanks tells the server, and the card goes', async () => {
    const { inboxWatch, root, sent } = watch();
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    press(root, 'No thanks');
    await until(() => root.hidden === true, 'the card to go');
    expect(sent).toContain(`POST /api/v1/challenges/${TOKEN}/decline`);
  });

  it('reads nothing for a player who isn’t signed in, and nothing waits', async () => {
    const { inboxWatch, sent, badge } = watch();
    inboxWatch.signedIn(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toStrictEqual([]);
    expect(badge).toStrictEqual([0]);
  });
});

describe('when a friend’s lobby stops (ADR 0089 addendum of 2026-11-27)', () => {
  it('is the first live challenge’s stopsInMs: the page reads again then', () => {
    const live = (token: string, stopsInMs?: number) => ({
      token,
      from: 'Sam_R',
      format: 'reveal' as const,
      bestOf: 3 as const,
      live: true,
      ...(stopsInMs === undefined ? {} : { stopsInMs }),
    });
    expect(nextStop({ invites: [] })).toBeUndefined();
    expect(nextStop({ invites: [live('a', 40_000), live('b', 12_000)] })).toBe(12_000);
    // By turns waits days; a server from before the field says nothing.
    expect(
      nextStop({ invites: [{ ...live('c', 5_000), live: false }, live('d')] }),
    ).toBeUndefined();
  });

  it('reads again when a game by turns or a turn runs out: no clock pokes (2026-11-27)', () => {
    const now = 1_000_000;
    const at = (ms: number) => new Date(now + ms).toISOString();
    const game = (ms: number) => ({ seriesId: 's', opponent: 'Sam_R', deadline: at(ms) });
    expect(nextStop({ invites: [], games: [game(90_000)] }, now)).toBe(90_000);
    expect(nextStop({ invites: [], turns: [game(40_000)], games: [game(90_000)] }, now)).toBe(
      40_000,
    );
    // One already past by this device's clock is the server's to settle, never a read at once.
    expect(nextStop({ invites: [], games: [game(-5_000)] }, now)).toBeUndefined();
  });
});
