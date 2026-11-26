// Profile (ADR 0081) through a fake API: an account by its username, its record (ADR 0088; its
// states in profile-record.browser.test.ts), Change username, Log out and Delete account (asked once, Keep first); a guest told what
// signing in unlocks, with Sign in and Forget me; nobody, with no Forget me and no request at all;
// and Privacy · Terms at the end. It reads `/me` once when it opens, and an account's record.
import { describe, expect, it } from 'vitest';
import type { Fetch } from '../app/api.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { recordFixture } from '../api/record-support.ts';
import { createProfile, type ProfileHost } from './profile.ts';
import { callApi } from '../app/api.ts';
import { createVisitCache } from '../app/visit-cache.ts';
import { whoAmI, type WhoAmI } from '../app/who-am-i.ts';
import { createWhoSource } from '../app/who-source.ts';
import type { PlayerResponse } from '../api/session.ts';

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function memory(entries: Record<string, string> = {}): ProfileHost['storage'] {
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

/** Waits until `check`, as long as a slow engine needs, failing with `what`. */
const until = async (check: () => boolean, what: string) => {
  const end = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
const titled = (title: string) => until(() => texts('h1')[0] === title, title);
const texts = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)]
    .filter((node) => node.closest('[hidden]') === null)
    .map((node) => node.textContent.trim());
function press(name: string): void {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent.trim() === name && node.closest('[hidden]') === null,
  );
  if (found === undefined) throw new Error(`No button ${name}`);
  found.click();
}

/** A promise the test settles when it chooses. */
function held() {
  let resolve: (who: WhoAmI) => void = () => undefined;
  const promise = new Promise<WhoAmI>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** The shown button named `name`. */
function button(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent.trim() === name && node.closest('[hidden]') === null,
  );
  if (found === undefined) throw new Error(`No button ${name}`);
  return found;
}

/** Profile where this visit already knows `known`, and `/me` answers with `answer`. */
function showKnown(known: WhoAmI, answer: Promise<WhoAmI>): void {
  const notice = document.createElement('section');
  const loading = document.createElement('div');
  document.body.replaceChildren(notice, loading);
  const screen = createProfile(
    { notice, loading },
    {
      storage: memory(),
      who: { known: () => known, ask: () => answer },
      back: () => undefined,
      home: () => undefined,
      signIn: () => undefined,
      cookies: () => '',
      logOut: () => Promise.resolve(undefined),
      forget: () => Promise.resolve(undefined),
      lookup: BALL_LOOKUP,
      openSeries: () => Promise.resolve(),
      allMatches: () => undefined,
      send: () =>
        Promise.resolve(json(200, recordFixture({ wins: 0, played: 0, favourite: null }))),
    },
  );
  screen.setVisible(true);
  screen.show();
}

/** Profile over a fake API whose `/me` says `me`. */
function profile(me: [number, unknown], cookies = '__Host-bb_player=1', storage = memory()) {
  const notice = document.createElement('section');
  const loading = document.createElement('div');
  document.body.replaceChildren(notice, loading);
  const asked: string[] = [];
  const done: string[] = [];
  const send: Fetch = (input, init) => {
    const path = new URL(input, location.href).pathname.replace('/api/v1/', '');
    asked.push(`${init.method ?? 'GET'} ${path}`);
    if (path === 'me') return Promise.resolve(json(...me));
    if (path === 'me/record') {
      return Promise.resolve(json(200, recordFixture({ wins: 0, played: 0, favourite: null })));
    }
    return Promise.resolve(json(404, { error: { code: 'not_found', message: 'no' } }));
  };
  const screen = createProfile(
    { notice, loading },
    {
      storage,
      who: createWhoSource(
        () =>
          whoAmI(storage, cookies, () => callApi<PlayerResponse>('GET', 'me', undefined, {}, send)),
        createVisitCache(),
      ),
      back: () => done.push('back'),
      home: () => done.push('home'),
      signIn: () => done.push('sign in'),
      cookies: () => cookies,
      logOut: () => {
        done.push('log out');
        return Promise.resolve(undefined);
      },
      forget: () => {
        done.push('forget');
        return Promise.resolve('You’re offline');
      },
      lookup: BALL_LOOKUP,
      openSeries: () => Promise.resolve(),
      allMatches: () => done.push('all matches'),
      send,
    },
  );
  screen.setVisible(true);
  screen.show();
  return { asked, done };
}

describe('Profile', () => {
  it('shows an account by its username, its actions as rows and Delete account apart', async () => {
    const { asked, done } = profile([200, { name: 'robin_b', account: true, username: 'robin_b' }]);
    await titled('robin_b');
    // The identity block under the title: the disc, the @username, what opponents see.
    expect(texts('.profile-identity .friends-disc')).toStrictEqual(['r']);
    expect(texts('.profile-handle')).toStrictEqual(['@robin_b']);
    expect(texts('.profile-identity .notice-text')).toStrictEqual([
      'Opponents see you as robin_b.',
    ]);
    // The record's card (ADR 0088), no primary for the name: rows, then the danger zone.
    await until(() => texts('.profile-empty').length === 1, 'the empty record');
    expect(texts('.notice .hud-button-primary')).toStrictEqual([]);
    expect(texts('.notice-more-title')).toStrictEqual(['Account']);
    expect(texts('.notice-more button')).toStrictEqual(['Change username', 'Log out']);
    expect(texts('.notice-danger .danger-row')).toStrictEqual(['Delete account']);
    expect(texts('.profile-legal a')).toStrictEqual(['Privacy', 'Terms']);
    // One read of `/me`, then the account's record.
    expect(asked).toStrictEqual(['GET me', 'GET me/record']);

    // Asked once, Keep first; a failed try says why (here the fake says offline).
    press('Delete account');
    await titled('Delete your account?');
    expect(texts('.screen-footer button')).toStrictEqual(['Keep', 'Delete']);
    press('Delete');
    await until(() => document.body.textContent.includes('You’re offline'), 'why it failed');
    expect(done).toStrictEqual(['forget']);
    press('Keep');
    await titled('robin_b');
    done.length = 0;

    press('Change username');
    await titled('Change your username');
    press('Cancel');
    await titled('robin_b');
    press('Log out');
    await until(() => done.length > 0, 'Log out');
    expect(done).toStrictEqual(['log out']);
  });

  // ADR 0087's refresh in place: an account this visit knows shows at once, and `/me` answers later.
  // An answer that changes nothing draws nothing, so a confirm the player opened meanwhile stays.
  it('keeps the Delete confirm open when /me answers the account it already shows', async () => {
    const answer = held();
    showKnown({ kind: 'account', username: 'robin_b' }, answer.promise);
    await titled('robin_b');
    press('Delete account');
    await titled('Delete your account?');
    const confirm = button('Delete');
    answer.resolve({ kind: 'account', username: 'robin_b' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(texts('h1')).toStrictEqual(['Delete your account?']);
    expect(button('Delete')).toBe(confirm);
    expect(confirm.isConnected).toBe(true);
  });

  it('draws the account again when /me says something new about it', async () => {
    const answer = held();
    showKnown({ kind: 'account', username: 'robin_b' }, answer.promise);
    await titled('robin_b');
    answer.resolve({ kind: 'account', username: 'robin_c' });
    await titled('robin_c');
  });

  it('tells a guest what signing in unlocks, with Sign in and Forget me', async () => {
    const { done } = profile([200, { name: 'Player 4821', account: false }]);
    await titled('Guest');
    expect(texts('.notice-text')).toContain('Playing on this device.');
    expect(texts('.notice-danger .danger-row')).toStrictEqual(['Forget me on this device']);
    press('Sign in');
    expect(done).toStrictEqual(['sign in']);
    press('Forget me on this device');
    await titled('Delete your guest?');
  });

  it('asks nothing for nobody on this device, and offers no Forget me', async () => {
    const { asked } = profile([500, {}], '');
    await titled('Guest');
    expect(asked).toStrictEqual([]);
    expect(texts('.notice-danger button')).toStrictEqual([]);
  });

  it('claims nothing when the server can’t say, and Try again asks again', async () => {
    const { asked } = profile([503, { error: { code: 'unavailable', message: 'down' } }]);
    await titled('Your profile');
    press('Try again');
    await until(() => asked.length === 2, 'the second read');
    expect(asked).toStrictEqual(['GET me', 'GET me']);
  });
});
