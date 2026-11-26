// One vs Friend path (ADR 0089, B1) through the real page at 390 x 664, signed in with friends, in a
// build with accounts and play by turns (previews, staging): Play against a friend with nobody
// picked opens "Who do you want to play?" (no history step; Escape and Back close it); Challenge
// there sends a live challenge to that friend, straight to their lobby, and the box remembers them;
// Play then goes straight to them. What to play's "Choose who to play" opens the sheet again;
// Anyone, with a link is today's lobby, which offers the online friends, and Challenge there stops
// the link and challenges them instead. Play by turns opens its lineup. Every move ends back on Play.
import { afterAll, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { ACCOUNT_STORAGE_KEY } from '../app/online-device.ts';
import { back, settle, until, visible } from './page-support.ts';
import { onScreen, openAs } from './shell-routes-support.ts';

const KEYS = [
  ACCOUNT_STORAGE_KEY,
  'ballbattle.online.guest',
  'ballbattle.online.adult',
  'ballbattle.playOpponent',
  'ballbattle.friendPick',
];
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const FRIENDS = [
  { id: 'f-1', name: 'Robin', status: 'online' },
  { id: 'f-2', name: 'Jo', status: 'offline' },
  { id: 'f-3', name: 'Mina', status: 'in_a_match' },
  { id: 'f-4', name: 'Kai', status: 'offline' },
  { id: 'f-5', name: 'Noor', status: 'offline' },
];
const ME = { name: 'sam_k', account: true, username: 'sam_k' };

/** The page's API: who, the inbox, challenges sent (to a friend or anyone) and their lobby. */
function fakeServer(asked: string[]): void {
  let invitee: string | null = null;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace('/api/v1/', '');
    const body = typeof init?.body === 'string' ? init.body : '';
    if (path !== 'me/inbox' && path !== 'me/match') asked.push(`${method} ${path} ${body}`.trim());
    const json = (status: number, answer: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(answer), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    if (path === 'me') return json(200, ME);
    if (path === 'me/inbox') {
      return json(200, { friends: FRIENDS, requests: 0, invites: [], turns: [] });
    }
    if (method === 'POST' && path === 'challenges') {
      const sent = JSON.parse(body) as { friend?: string };
      invitee = FRIENDS.find((one) => one.id === sent.friend)?.name ?? null;
      return json(200, {
        token: TOKEN,
        format: 'reveal',
        bestOf: 3,
        expiresAt: '2026-12-01T00:00:00Z',
      });
    }
    if (path === `challenges/${TOKEN}` || path === `challenges/${TOKEN}/cancel`) {
      return json(200, {
        format: 'reveal',
        bestOf: 3,
        from: 'sam_k',
        status: method === 'POST' ? 'stopped' : 'yours',
        seriesId: null,
        startId: null,
        live: true,
        own: true,
        invitee,
        declined: false,
        blocked: null,
      });
    }
    return json(404, { error: { code: 'not_found', message: 'No server in this test' } });
  });
}

const sheet = () => document.querySelector<HTMLDialogElement>('dialog.who-sheet');
const inSheet = (name: string) => {
  const found = [...(sheet()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(
    (node) => node.textContent.trim() === name && node.getClientRects().length > 0,
  );
  if (found === undefined) throw new Error(`No "${name}" in the sheet`);
  return found;
};
const play = () => {
  const found = visible('.home-play')[0];
  if (found === undefined) throw new Error('No Play');
  return found;
};
const boxSays = () => [
  visible('.play-box-who')[0]?.textContent,
  visible('.play-box-rules')[0]?.textContent,
];
const sentPosts = (asked: readonly string[]) =>
  asked.filter((line) => line.startsWith('POST challenges'));
async function inLobby(title: string): Promise<void> {
  await onScreen('challenge');
  await until(
    () => visible('#online-challenge :is(h1, h2)').some((node) => node.textContent === title),
    5_000,
    `the lobby, "${title}"`,
    false,
  );
}

afterAll(() => {
  for (const key of KEYS) window.localStorage.removeItem(key);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('one vs Friend path, signed in (ADR 0089)', () => {
  it('asks who on Play, with no history step, and Escape and Back close it', async () => {
    vi.stubEnv('VITE_TURNS', '1');
    for (const key of KEYS) window.localStorage.removeItem(key);
    for (const key of KEYS.slice(0, 3)) window.localStorage.setItem(key, '1');
    window.localStorage.setItem('ballbattle.playOpponent', 'friend');
    await openAs({ online: true, accounts: true }, '', {
      '/api/v1/me': ME,
      '/api/v1/me/inbox': { friends: FRIENDS, requests: 0, invites: [], turns: [] },
    });
    fakeServer([]);
    await onScreen('home');
    expect(boxSays()).toStrictEqual(['vs Friend', 'Live · Best of 3 · Reveal']);
    await userEvent.click(play());
    await until(() => sheet()?.open === true, 5_000, 'the sheet', false);
    await until(
      () => (sheet()?.querySelectorAll('.friends-name').length ?? 0) > 0,
      5_000,
      'friends',
      false,
    );
    expect(location.search).toBe('');
    expect(
      [...(sheet()?.querySelectorAll('.friends-group-title') ?? [])].map((n) => n.textContent),
    ).toStrictEqual(['Online · 1', 'Not online']);
    await userEvent.keyboard('{Escape}');
    await until(() => sheet()?.open === false, 2_000, 'Escape to close it', false);
    await userEvent.click(play());
    await until(() => sheet()?.open === true, 5_000, 'the sheet again', false);
    await back();
    await until(() => sheet()?.open === false, 2_000, 'Back to close it', false);
    history.forward();
    await onScreen('home');
    await settle();
  });

  it('challenges a friend from the sheet, then Play goes straight to them', async () => {
    const asked: string[] = [];
    fakeServer(asked);
    await userEvent.click(play());
    await until(() => sheet()?.open === true, 5_000, 'the sheet', false);
    await userEvent.click(inSheet('Challenge'));
    await inLobby('Waiting for Robin');
    expect(location.search).toBe(`?challenge=${TOKEN}`);
    expect(sentPosts(asked)).toHaveLength(1);
    expect(sentPosts(asked)[0]).toContain('"friend":"f-1"');
    expect(sentPosts(asked)[0]).toContain('"live":true');
    await back();
    await onScreen('home');
    // Remembered: the box says them, and Play goes straight to them, no sheet.
    expect(boxSays()).toStrictEqual(['vs Robin', 'Live · Best of 3 · Reveal']);
    expect(play().getAttribute('aria-label')).toBe('Challenge Robin live, Best of 3 · Reveal');
    await userEvent.click(play());
    await inLobby('Waiting for Robin');
    expect(sheet()?.open).toBe(false);
    expect(sentPosts(asked)).toHaveLength(2);
    expect(sentPosts(asked)[1]).toContain('"friend":"f-1"');
    await back();
    await onScreen('home');
  });

  it('offers who again from What to play, and the link’s lobby offers friends online', async () => {
    const asked: string[] = [];
    fakeServer(asked);
    await settle();
    const open = [...document.querySelectorAll('dialog')].filter((node) => node.open);
    expect(open.map((node) => node.className)).toStrictEqual([]);
    await userEvent.click(visible('.play-box')[0] ?? play());
    const what = document.querySelector<HTMLDialogElement>('dialog.play-sheet');
    await until(() => what?.open === true, 5_000, 'What to play', false);
    const choose = [...(what?.querySelectorAll<HTMLButtonElement>('.play-sheet-who') ?? [])][0];
    if (choose === undefined) throw new Error('No Choose who to play');
    await userEvent.click(choose);
    await until(
      () => sheet()?.open === true && what?.open === false,
      5_000,
      'the who sheet',
      false,
    );
    await userEvent.click(inSheet('Anyone, with a link'));
    await inLobby('Your challenge');
    expect(sentPosts(asked)[0]).not.toContain('"friend"');
    await until(() => visible('.who-lobby .friends-name').length === 1, 5_000, 'friends', false);
    expect(visible('.who-lobby .friends-group-title').map((n) => n.textContent)).toStrictEqual([
      'Or challenge a friend',
    ]);
    const challenge = visible('.who-lobby .friends-challenge')[0];
    if (challenge === undefined) throw new Error('No Challenge in the lobby');
    await userEvent.click(challenge);
    await inLobby('Waiting for Robin');
    // The link stopped, then Robin's challenge, its lobby in the link's place: Back is Play.
    expect(asked.some((line) => line.startsWith(`POST challenges/${TOKEN}/cancel`))).toBe(true);
    expect(sentPosts(asked).at(-1)).toContain('"friend":"f-1"');
    await back();
    await onScreen('home');
  });

  it('plays by turns with a friend away: its lineup, then Back to Play', async () => {
    fakeServer([]);
    window.localStorage.removeItem('ballbattle.friendPick');
    await userEvent.click(play());
    await until(() => sheet()?.open === true, 5_000, 'the sheet', false);
    const turns = [
      ...(sheet()?.querySelectorAll<HTMLButtonElement>('.friends-challenge') ?? []),
    ].find((node) => node.getAttribute('aria-label') === 'Play by turns with Jo');
    if (turns === undefined) throw new Error('No Play by turns with Jo');
    await userEvent.click(turns);
    await onScreen('send');
    await back();
    await onScreen('home');
    expect(boxSays()).toStrictEqual(['vs Jo', 'By turns · Best of 3 · Reveal']);
  });
});
