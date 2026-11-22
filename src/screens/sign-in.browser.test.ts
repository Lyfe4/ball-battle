// The account screen reads who this device is from the server (ADR 0079 addendum of 2026-11-22),
// through a fake API: a device Safari wiped (no keys, the cookies kept) is shown its account, not
// the 16+ question; a guest is offered Forget me; Delete account asks once, Keep first.
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
      logOut: () => Promise.resolve(undefined),
      forget: () => {
        deleted.push('forget');
        return Promise.resolve('You’re offline');
      },
    },
  );
  signIn.setVisible(true);
  signIn.show(undefined);
  return { notice, asked, deleted };
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
const press = (root: HTMLElement, text: string) => {
  [...root.querySelectorAll<HTMLButtonElement>('button')]
    .find((b) => b.textContent === text)
    ?.click();
};

describe('the account screen', () => {
  it('shows a signed-in account its account, though Safari wiped the device’s keys', async () => {
    const account = { name: 'Sam_1', account: true, username: 'Sam_1' };
    const { notice } = screen([200, account]);
    await until(() => heading(notice) === 'You’re signed in', 'the signed-in card');
    expect(notice.textContent).toContain('Opponents see you as Sam_1.');
    expect(quiet(notice)).toStrictEqual(['Log out', 'Delete account']);
  });

  it('asks before deleting an account, Keep first, and says why a try failed', async () => {
    const account = { name: 'Sam_1', account: true, username: 'Sam_1' };
    const { notice, deleted } = screen([200, account]);
    await until(() => heading(notice) === 'You’re signed in', 'the signed-in card');
    press(notice, 'Delete account');
    await until(() => heading(notice) === 'Delete your account?', 'the question');
    expect(
      [...notice.querySelectorAll('.screen-footer button')].map((b) => b.textContent),
    ).toStrictEqual(['Keep', 'Delete']);
    press(notice, 'Delete');
    await until(() => notice.textContent.includes('You’re offline'), 'why it failed');
    expect(deleted).toStrictEqual(['forget']);
    press(notice, 'Keep');
    await until(() => heading(notice) === 'You’re signed in', 'back to the account');
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
