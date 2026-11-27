// The one vs Friend path (ADR 0089 and its addendum of 2026-11-27) through the real page at 390 x
// 664, signed in with friends, in a build with accounts and play by turns (previews, staging): Play
// against a friend opens "Who do you want to play?" (no history step; Escape and Back close it);
// picking a friend only selects them, and nothing is sent until the one button; it goes to the one
// waiting screen, and Back from it cancels the challenge. Play never goes straight to anyone, the
// friend last picked listed first. The Friends tab's Challenge opens the same sheet with that
// friend picked; What to play only sets rules; the waiting screen offers no other friends. By turns
// opens its lineup. Every move ends back on Play.
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
  'ballbattle.friendTurns',
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
const INBOX = { friends: FRIENDS, requests: 0, invites: [], turns: [] };

/** The page's API: who, the inbox, challenges sent (to a friend or anyone) and their lobby. */
function fakeServer(asked: string[]): void {
  let invitee: string | null | undefined;
  let cancelled = false;
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
    if (path === 'me/inbox') return json(200, INBOX);
    // Home's way back: the waiting challenge while it is out and not cancelled.
    if (path === 'me/match') {
      const out = invitee !== undefined && !cancelled;
      return json(200, {
        match: out
          ? { kind: 'lobby', token: TOKEN, format: 'reveal', bestOf: 3, invitee, stopsInMs: 60_000 }
          : null,
      });
    }
    if (path === 'friends') {
      return json(200, {
        code: '7KQ2M9XD',
        friends: FRIENDS,
        incoming: [],
        outgoing: [],
        blocked: [],
      });
    }
    if (method === 'POST' && path === 'challenges') {
      const sent = JSON.parse(body) as { friend?: string };
      invitee = FRIENDS.find((one) => one.id === sent.friend)?.name ?? null;
      cancelled = false;
      return json(201, {
        token: TOKEN,
        format: 'reveal',
        bestOf: 3,
        expiresAt: '2026-12-01T00:00:00Z',
      });
    }
    if (path === `challenges/${TOKEN}` || path === `challenges/${TOKEN}/cancel`) {
      if (method === 'POST') cancelled = true;
      return json(200, {
        format: 'reveal',
        bestOf: 3,
        from: 'sam_k',
        status: cancelled ? 'stopped' : 'yours',
        seriesId: null,
        startId: null,
        live: true,
        own: true,
        invitee: invitee ?? null,
        declined: false,
        superseded: false,
        blocked: null,
      });
    }
    return json(404, { error: { code: 'not_found', message: 'No server in this test' } });
  });
}

const sheet = () => document.querySelector<HTMLDialogElement>('dialog.who-sheet');
const row = (name: string) => {
  const found = [...(sheet()?.querySelectorAll<HTMLButtonElement>('.who-row') ?? [])].find(
    (node) => node.querySelector('.friends-name')?.textContent === name,
  );
  if (found === undefined) throw new Error(`No "${name}" in the sheet`);
  return found;
};
const sendButton = () => {
  const found = sheet()?.querySelector<HTMLButtonElement>('.who-sheet-send');
  if (found == null) throw new Error('No send button');
  return found;
};
const names = () =>
  [...(sheet()?.querySelectorAll('.who-row .friends-name') ?? [])].map((n) => n.textContent);
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
  asked.filter((line) => line.startsWith('POST challenges '));
async function openSheet(): Promise<void> {
  await userEvent.click(play());
  await until(() => sheet()?.open === true, 5_000, 'the sheet', false);
  await until(() => names().length > 1, 5_000, 'friends', false);
}
async function waitingFor(who: string): Promise<void> {
  await onScreen('challenge');
  await until(
    () => visible('.notice-waiting-title').some((node) => node.textContent === who),
    5_000,
    `the waiting screen, "${who}"`,
    false,
  );
}

afterAll(() => {
  for (const key of KEYS) window.localStorage.removeItem(key);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('one vs Friend path, signed in (ADR 0089 addendum of 2026-11-27)', () => {
  it('asks who on Play, with no history step, and Escape and Back close it', async () => {
    vi.stubEnv('VITE_TURNS', '1');
    for (const key of KEYS) window.localStorage.removeItem(key);
    for (const key of KEYS.slice(0, 3)) window.localStorage.setItem(key, '1');
    window.localStorage.setItem('ballbattle.playOpponent', 'friend');
    await openAs({ online: true, accounts: true }, '', {
      '/api/v1/me': ME,
      '/api/v1/me/inbox': INBOX,
    });
    fakeServer([]);
    await onScreen('home');
    expect(boxSays()).toStrictEqual(['vs Friend', 'Live · Best of 3 · Reveal']);
    await openSheet();
    expect(location.search).toBe('');
    expect(
      [...(sheet()?.querySelectorAll('.friends-group-title') ?? [])].map((n) => n.textContent),
    ).toStrictEqual(['Online · 1', 'Not online']);
    await userEvent.keyboard('{Escape}');
    await until(() => sheet()?.open === false, 2_000, 'Escape to close it', false);
    await openSheet();
    await back();
    await until(() => sheet()?.open === false, 2_000, 'Back to close it', false);
    history.forward();
    await onScreen('home');
    await settle();
  });

  it('sends nothing on a pick, only on the button; Back asks before it cancels', async () => {
    const asked: string[] = [];
    fakeServer(asked);
    await openSheet();
    await userEvent.click(row('Robin'));
    await userEvent.click(row('Jo'));
    await userEvent.click(row('Robin'));
    expect(sentPosts(asked)).toStrictEqual([]);
    expect(sendButton().textContent).toBe('Challenge Robin');
    await userEvent.click(sendButton());
    await waitingFor('Waiting for Robin');
    expect(location.search).toBe(`?challenge=${TOKEN}`);
    expect(sentPosts(asked)).toHaveLength(1);
    expect(sentPosts(asked)[0]).toContain('"friend":"f-1"');
    expect(sentPosts(asked)[0]).toContain('"live":true');
    // The one waiting screen offers no other friends.
    expect(visible('.who-lobby')).toHaveLength(0);
    // Back asks first; Keep waiting keeps it, nothing sent.
    const asking = () => document.querySelector<HTMLDialogElement>('dialog.waiting-back');
    const inAppBack = () =>
      visible('#online-challenge .screen-back, .screen-header .screen-back')[0];
    await userEvent.click(inAppBack() ?? play());
    await until(() => asking()?.open === true, 2_000, 'Back to ask', false);
    expect(asking()?.querySelector('.sheet-title')?.textContent).toBe(
      'Cancel your challenge to Robin?',
    );
    await userEvent.click(
      visible('dialog.waiting-back button').find((b) => b.textContent === 'Keep waiting') ?? play(),
    );
    await until(() => asking()?.open === false, 2_000, 'the question to close', false);
    await onScreen('challenge');
    expect(asked.some((line) => line.includes('/cancel'))).toBe(false);
    // Asked again: Cancel challenge cancels it, then home.
    await userEvent.click(inAppBack() ?? play());
    await until(() => asking()?.open === true, 2_000, 'Back to ask again', false);
    await userEvent.click(
      visible('dialog.waiting-back button').find((b) => b.textContent === 'Cancel challenge') ??
        play(),
    );
    await onScreen('home');
    expect(asked.some((line) => line.startsWith(`POST challenges/${TOKEN}/cancel`))).toBe(true);
    // Play never goes straight to anyone: the box says vs Friend, and Play asks again, Robin first.
    expect(boxSays()).toStrictEqual(['vs Friend', 'Live · Best of 3 · Reveal']);
    await openSheet();
    expect(names()[0]).toBe('Robin');
    expect(sheet()?.querySelector('.who-row[aria-checked="true"]')).toBeNull();
    expect(sentPosts(asked)).toHaveLength(1);
    await userEvent.keyboard('{Escape}');
    await until(() => sheet()?.open === false, 2_000, 'the sheet to close', false);
  });

  it('What to play only sets rules: no one to choose there', async () => {
    await settle();
    await userEvent.click(visible('.play-box')[0] ?? play());
    const what = document.querySelector<HTMLDialogElement>('dialog.play-sheet');
    await until(() => what?.open === true, 5_000, 'What to play', false);
    expect(what?.querySelector('.play-sheet-who')).toBeNull();
    const how = [...(what?.querySelectorAll<HTMLButtonElement>('.play-sheet-how button') ?? [])];
    expect(how.map((node) => node.textContent)).toStrictEqual([
      'Liveplay now',
      'By turnsup to a day a move',
    ]);
    await userEvent.keyboard('{Escape}');
    await until(() => what?.open === false, 2_000, 'What to play to close', false);
  });

  it('sends a link from the same sheet; leaving another way keeps it, home leads back', async () => {
    const asked: string[] = [];
    fakeServer(asked);
    await openSheet();
    await userEvent.click(row('Send a link instead'));
    expect(sendButton().textContent).toBe('Send a link');
    await userEvent.click(sendButton());
    await waitingFor('Waiting for anyone with the link');
    expect(sentPosts(asked)[0]).not.toContain('"friend"');
    // The browser's Back (or a tab) leaves the screen: the challenge stays, nothing cancelled.
    await back();
    await onScreen('home');
    expect(asked.some((line) => line.includes('/cancel'))).toBe(false);
    // Home's "Back to your lobby" leads back while it is alive.
    await until(
      () => visible('.home-play').some((b) => /lobby/i.test(b.textContent)),
      5_000,
      'Back to your lobby',
      false,
    );
    await userEvent.click(
      visible('.home-play').find((b) => /lobby/i.test(b.textContent)) ?? play(),
    );
    await waitingFor('Waiting for anyone with the link');
    await userEvent.click(visible('.screen-header .screen-back')[0] ?? play());
    const asking = document.querySelector<HTMLDialogElement>('dialog.waiting-back');
    await until(() => asking?.open === true, 2_000, 'Back to ask', false);
    expect(asking?.querySelector('.sheet-title')?.textContent).toBe('Cancel your challenge?');
    await userEvent.click(
      visible('dialog.waiting-back button').find((b) => b.textContent === 'Cancel challenge') ??
        play(),
    );
    await onScreen('home');
  });

  it('plays by turns with a friend away: its lineup, then Back to Play', async () => {
    fakeServer([]);
    await openSheet();
    await userEvent.click(row('Jo'));
    expect(sendButton().textContent).toBe('Play Jo by turns');
    await userEvent.click(sendButton());
    await onScreen('send');
    await back();
    await onScreen('home');
    expect(boxSays()).toStrictEqual(['vs Friend', 'Live · Best of 3 · Reveal']);
  });

  it('enters the same sheet from the Friends tab’s Challenge, that friend picked', async () => {
    const asked: string[] = [];
    fakeServer(asked);
    await userEvent.click(visible('.tab-bar-tab[data-tab="friends"]')[0] ?? play());
    await onScreen('friends');
    await until(
      () => visible('.friends-challenge').length > 0,
      5_000,
      'a friend’s Challenge',
      false,
    );
    await userEvent.click(visible('.friends-challenge')[0] ?? play());
    await until(() => sheet()?.open === true, 5_000, 'the sheet', false);
    await until(
      () => sheet()?.querySelector('.who-row[aria-checked="true"]') !== null,
      5_000,
      'Robin picked',
      false,
    );
    expect(sendButton().textContent).toBe('Challenge Robin');
    expect(sentPosts(asked)).toStrictEqual([]);
    await userEvent.keyboard('{Escape}');
    await until(() => sheet()?.open === false, 2_000, 'the sheet to close', false);
    await onScreen('friends');
  });
});
