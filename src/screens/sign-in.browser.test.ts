// The account screen reads who this device is from the server (ADR 0079 addendum of 2026-11-22),
// through a fake API: a device Safari wiped (no keys, the cookies kept) is shown its account, not
// the 16+ question but taken on to the Friends tab; a guest is offered Forget me. Log out and
// Delete account are Profile's (profile.browser.test.ts, ADR 0081).
import { describe, expect, it } from 'vitest';
import type { Fetch } from '../app/api.ts';
import { createSignIn, type SignInHost } from './sign-in.ts';

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function memory(entries: Record<string, string> = {}): SignInHost['storage'] {
  const map = new Map(Object.entries(entries));
  const store = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
  return () => store;
}

/** The screen over a fake API whose `/me` says `me` (a status and body). */
function screen(me: [number, unknown], storage = memory(), cookies = '__Host-bb_player=1') {
  const notice = document.createElement('section');
  const loading = document.createElement('div');
  document.body.replaceChildren(notice, loading);
  const asked: string[] = [];
  const send: Fetch = (input) => {
    const path = new URL(input, location.href).pathname.replace('/api/v1/', '');
    asked.push(path);
    if (path === 'auth/options')
      return Promise.resolve(json(200, { google: false, emailCodes: true }));
    if (path === 'me') return Promise.resolve(json(...me));
    return Promise.resolve(json(404, { error: { code: 'not_found', message: 'no' } }));
  };
  const deleted: string[] = [];
  const landed: string[] = [];
  const signIn = createSignIn(
    { notice, loading },
    {
      storage,
      back: () => undefined,
      home: () => undefined,
      rewrite: () => undefined,
      toMatch: () => Promise.resolve(),
      leaveFor: () => undefined,
      userAgent: navigator.userAgent,
      send,
      cookies: () => cookies,
      forget: () => {
        deleted.push('forget');
        return Promise.resolve('You’re offline');
      },
      landed: () => {
        landed.push('friends');
      },
    },
  );
  signIn.setVisible(true);
  signIn.show(undefined);
  return { notice, asked, deleted, landed };
}

const heading = (root: HTMLElement) => root.querySelector('.screen-title')?.textContent ?? '';
const quiet = (root: HTMLElement) =>
  [...root.querySelectorAll('.notice-more .notice-quiet')].map((node) => node.textContent);
const until = async (check: () => boolean, what: string) => {
  const end = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

describe('the account screen', () => {
  it('takes a signed-in account to the Friends tab, though Safari wiped the device’s keys', async () => {
    const account = { name: 'Sam_1', account: true, username: 'Sam_1' };
    const { notice, landed } = screen([200, account]);
    // Signed in already: no 16+ question and no ways in, straight on to Friends (ADR 0081), where
    // "You're signed in" used to show; Profile holds the username, Log out and Delete account.
    await until(() => landed.length === 1, 'the Friends tab');
    expect(heading(notice)).not.toBe('Sign in');
    expect(notice.textContent).not.toContain('16');
  });

  it('offers a guest the ways in, then Forget me', async () => {
    const { notice } = screen([200, { name: 'Player 4821', account: false, username: null }]);
    await until(() => heading(notice) === 'Sign in', 'the ways in');
    expect(quiet(notice)).toStrictEqual(['Forget me']);
  });

  it('asks nothing of a first visit, and asks the 16+ question', async () => {
    const { notice, asked } = screen([401, {}], memory(), '');
    await until(() => notice.querySelector('.hud-button') !== null, 'the first card');
    expect(asked).toStrictEqual(['auth/options']);
    expect(notice.textContent).toContain('16');
    expect(quiet(notice)).toStrictEqual([]);
  });
});
