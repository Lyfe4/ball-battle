// One vs Friend path for a guest (ADR 0089, B1), in a build with accounts: Play against a friend goes
// straight to the link, as before, with no "Who do you want to play?" and no friends; the lobby says
// once how to challenge friends in the game, and its Sign in goes to sign-in. (A build without
// accounts, production's shape, is play-box.safari.browser.test.ts: the link, no such line.)
import { afterAll, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { back, until, visible } from './page-support.ts';
import { onScreen, openAs } from './shell-routes-support.ts';

const KEYS = ['ballbattle.online.guest', 'ballbattle.online.adult', 'ballbattle.playOpponent'];
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const GUEST = { name: 'Player 4821', account: false, username: null };

afterAll(() => {
  for (const key of KEYS) window.localStorage.removeItem(key);
  vi.unstubAllGlobals();
});

describe('one vs Friend path, as a guest (ADR 0089)', () => {
  it('goes straight to the link, and its lobby says to sign in to challenge friends', async () => {
    for (const key of KEYS) window.localStorage.setItem(key, '1');
    window.localStorage.setItem('ballbattle.playOpponent', 'friend');
    const asked: string[] = [];
    await openAs({ online: true, accounts: true }, '', { '/api/v1/me': GUEST });
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1/', '');
      asked.push(`${method} ${path}`);
      const json = (answer: unknown, status = 200) =>
        Promise.resolve(
          new Response(JSON.stringify(answer), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      if (path === 'me') return json(GUEST);
      if (method === 'POST' && path === 'challenges') {
        return json({
          token: TOKEN,
          format: 'reveal',
          bestOf: 3,
          expiresAt: '2026-12-01T00:00:00Z',
        });
      }
      if (path === `challenges/${TOKEN}`) {
        return json({
          format: 'reveal',
          bestOf: 3,
          from: 'Player 4821',
          status: 'yours',
          seriesId: null,
          startId: null,
          live: true,
          own: true,
          invitee: null,
          declined: false,
          blocked: null,
        });
      }
      return json({ error: { code: 'not_found', message: 'No server in this test' } }, 404);
    });
    await onScreen('home');
    const play = visible('.home-play')[0];
    if (play === undefined) throw new Error('No Play');
    await userEvent.click(play);
    await onScreen('challenge');
    await until(() => visible('.who-lobby-line').length === 1, 5_000, 'the sign-in line', false);
    expect(document.querySelector('dialog.who-sheet')).toBeNull();
    expect(asked.filter((line) => line === 'POST challenges')).toHaveLength(1);
    expect(visible('.who-lobby-line')[0]?.textContent).toBe(
      'Sign in to challenge friends in the game.',
    );
    expect(visible('.who-lobby')).toHaveLength(0);
    const signIn = visible('.who-lobby-sign-in')[0];
    if (signIn === undefined) throw new Error('No Sign in');
    await userEvent.click(signIn);
    await onScreen('signin');
    await back();
    await onScreen('challenge');
    await back();
    await onScreen('home');
  });
});
