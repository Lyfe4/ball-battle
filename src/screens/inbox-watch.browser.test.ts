// A friend's live challenge reaches a signed-in player anywhere (ADR 0079, PR (d); ADR 0081), over
// a fake inbox: the rematch's floating card says who and what, never over a fight or a lineup pick
// (it waits until the match is over), Accept goes straight to the challenge's lineup, No thanks
// tells the server and the card goes; ignored (closed, or 20 s) it folds back into the badge and
// doesn't come back; the whole answer is handed on (the badge, the strip, the Friends tab); signed
// out, nothing is read and nothing waits.
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../style.css';
import type { InboxResponse } from '../api/friends.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { waitingCount } from './friends-text.ts';
import { createInboxWatch, INVITE_FOLD_MS } from './inbox-watch.ts';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const INBOX: InboxResponse = {
  friends: [{ id: 'f-1', name: 'Sam_R', status: 'online' }],
  requests: 0,
  invites: [{ token: TOKEN, from: 'Sam_R', format: 'reveal', bestOf: 3 }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function watch(busy = false, foldMs = INVITE_FOLD_MS) {
  const sent: string[] = [];
  let inbox = INBOX;
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
  document.body.replaceChildren(root);
  const went: string[] = [];
  const seen: string[] = [];
  /** What the badge would count, after each answer handed on. */
  const badge: number[] = [];
  let calm = !busy;
  const inboxWatch = createInboxWatch(
    root,
    BALL_LOOKUP,
    {
      open: (token) => {
        went.push(token);
        return Promise.resolve();
      },
      calm: () => calm,
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
    setBusy: (value: boolean) => {
      calm = !value;
    },
  };
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
    .find((button) => button.textContent === text && !button.hidden)
    ?.click();
};

describe('a friend’s challenge on the floating card', () => {
  it('shows who and what with Accept and No thanks; Accept opens its lineup', async () => {
    const { inboxWatch, root, went, seen } = watch();
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    expect(root.getAttribute('aria-label')).toBe('Challenge');
    expect(root.querySelector('.rematch-notice-line')?.textContent).toBe(
      'Sam_R challenges you · Best of 3 · Reveal · live',
    );
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

  it('closed, it folds too, and Accept from the Friends tab still works', async () => {
    const { inboxWatch, root, went, badge } = watch();
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    press(root, 'Later');
    expect(root.hidden).toBe(true);
    inboxWatch.refresh();
    expect(root.hidden).toBe(true);
    await inboxWatch.accept(TOKEN);
    expect(went).toStrictEqual([TOKEN]);
    expect(badge.at(-1)).toBe(0);
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
