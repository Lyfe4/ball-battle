// A friend's live challenge reaches a signed-in player anywhere (ADR 0079, PR (d)), over a fake
// inbox: the rematch's floating card says who and what, never over a fight (it waits for the fight
// to end), Accept goes straight to the challenge's lineup, No thanks tells the server and the card
// goes; the friends' status is handed on; signed out, nothing is read.
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../style.css';
import type { InboxResponse } from '../api/friends.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { createInboxWatch } from './inbox-watch.ts';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const INBOX: InboxResponse = {
  friends: [{ id: 'f-1', name: 'Sam_R', status: 'online' }],
  requests: 0,
  invites: [{ token: TOKEN, from: 'Sam_R', format: 'reveal', bestOf: 3 }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function watch(fighting = false) {
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
  let fight = fighting;
  const inboxWatch = createInboxWatch(root, BALL_LOOKUP, {
    open: (token) => {
      went.push(token);
      return Promise.resolve();
    },
    fighting: () => fight,
    expecting: () => false,
    friends: (friends) => {
      seen.push(friends.map((f) => `${f.name} ${f.status ?? ''}`).join());
    },
  });
  return {
    inboxWatch,
    root,
    sent,
    went,
    seen,
    setFighting: (value: boolean) => {
      fight = value;
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

  it('waits while a fight is on screen, and shows once it is over', async () => {
    const { inboxWatch, root, sent, setFighting } = watch(true);
    inboxWatch.signedIn(true);
    await until(() => sent.length === 1, 'the read');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(root.hidden).toBe(true);
    setFighting(false);
    inboxWatch.refresh();
    expect(root.hidden).toBe(false);
  });

  it('No thanks tells the server, and the card goes', async () => {
    const { inboxWatch, root, sent } = watch();
    inboxWatch.signedIn(true);
    await until(() => !root.hidden, 'the card');
    press(root, 'No thanks');
    await until(() => root.hidden === true, 'the card to go');
    expect(sent).toContain(`POST /api/v1/challenges/${TOKEN}/decline`);
  });

  it('reads nothing for a player who isn’t signed in', async () => {
    const { inboxWatch, sent } = watch();
    inboxWatch.signedIn(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toStrictEqual([]);
  });
});
