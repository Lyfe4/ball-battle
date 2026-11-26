// The Play tab's mode box and its sheet (ADR 0081 addendum, Option B), at 390 x 664 in the build
// production has with vs Friend on (online, accounts off). The box says exactly what Play starts;
// tapping it opens "What to play", a modal dialog: focus moves onto its title and comes back to the
// box, and its one close (the × last in its head), Escape, a tap outside and Back each close it
// (ADR 0086); nothing in it says Done. Choices apply at once
// and are remembered per opponent. Play against the bot goes to its lineup; against a friend it
// goes straight to the share link, with no rules step, after the 16+ question on a device without
// a guest. Every test ends on the entry it started from: no history left behind.
import { afterAll, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { SERIES_LENGTH_STORAGE_KEY } from '../app/series-length.ts';
import { checkOneClose } from './look-checks.ts';
import { back, settle, until, visible } from './page-support.ts';
import { follow, LINKS, onScreen, openAs, screenOn } from './shell-routes-support.ts';

// modes.ts's keys, spelled out: importing it here would read the build's switches (online-build.ts)
// before `openAs` sets them.
const PLAY_FORMAT_STORAGE_KEY = 'ballbattle.playFormat';
const PLAY_OPPONENT_STORAGE_KEY = 'ballbattle.playOpponent';
const FRIEND_FORMAT_STORAGE_KEY = 'ballbattle.friendFormat';
const FRIEND_BEST_OF_STORAGE_KEY = 'ballbattle.friendBestOf';
const GUEST_KEY = 'ballbattle.online.guest';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const KEYS = [
  BOT_LEVEL_STORAGE_KEY,
  PLAY_FORMAT_STORAGE_KEY,
  SERIES_LENGTH_STORAGE_KEY,
  PLAY_OPPONENT_STORAGE_KEY,
  FRIEND_FORMAT_STORAGE_KEY,
  FRIEND_BEST_OF_STORAGE_KEY,
  GUEST_KEY,
];

const box = () => {
  const found = visible('.play-box')[0];
  if (!(found instanceof HTMLButtonElement)) throw new Error('No mode box');
  return found;
};
const boxSays = () => ({
  who: box().querySelector('.play-box-who')?.textContent,
  rules: box().querySelector('.play-box-rules')?.textContent,
});
const play = () => {
  const found = visible('.home-play')[0];
  if (!(found instanceof HTMLButtonElement)) throw new Error('No Play');
  return found;
};
const sheet = () => {
  const found = document.querySelector('dialog.play-sheet');
  if (!(found instanceof HTMLDialogElement)) throw new Error('No sheet');
  return found;
};
/** A button in the sheet, by its words or the start of its accessible name. */
function choice(name: string): HTMLButtonElement {
  const found = [...sheet().querySelectorAll('button')].find(
    (node) =>
      node.closest('[hidden]') === null &&
      (node.textContent.trim() === name ||
        node.getAttribute('aria-label') === name ||
        node.getAttribute('aria-label')?.startsWith(`${name},`) === true),
  );
  if (found === undefined) throw new Error(`No "${name}" in the sheet`);
  return found;
}
/** The sheet's groups as a screen reader meets them: each name, then its choices. */
const groups = () =>
  [...sheet().querySelectorAll<HTMLElement>('[role="group"]')]
    .filter((group) => group.closest('[hidden]') === null)
    .map((group) => {
      const label = document.getElementById(group.getAttribute('aria-labelledby') ?? '');
      const buttons = [...group.querySelectorAll('button')];
      return {
        name: label?.textContent,
        choices: buttons.map((node) => node.querySelector('.segmented-text')?.textContent ?? ''),
        chosen: buttons
          .filter((node) => node.getAttribute('aria-pressed') === 'true')
          .map((node) => node.querySelector('.segmented-text')?.textContent ?? ''),
      };
    });

async function openSheet(): Promise<void> {
  await userEvent.click(box());
  await until(() => sheet().open, 2_000, 'the sheet to open', false);
}

async function expectClosed(how: string): Promise<void> {
  await until(() => !sheet().open, 2_000, `the sheet to close (${how})`, false);
  expect(document.activeElement, how).toBe(box());
}

/** Answers the API as a server would for sending a live challenge; records what was asked. */
function fakeServer(asked: string[]): void {
  const real = window.fetch.bind(window);
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (!url.pathname.startsWith('/api/')) return real(input, init);
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace('/api/v1/', '');
    const body = typeof init?.body === 'string' ? init.body : '';
    asked.push(`${method} ${path} ${body}`.trim());
    const json = (status: number, body: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    if (method === 'POST' && path === 'session') return json(200, { name: 'Player 1234' });
    if (method === 'POST' && path === 'challenges') {
      const sent = JSON.parse(body) as { format: string; bestOf: number };
      return json(200, { token: TOKEN, ...sent, expiresAt: '2026-12-01T00:00:00Z' });
    }
    if (method === 'GET' && path === `challenges/${TOKEN}`) {
      return json(200, {
        format: 'showdown',
        bestOf: 3,
        from: 'Player 1234',
        status: 'yours',
        seriesId: null,
        startId: null,
        live: true,
        own: true,
        invitee: null,
        declined: false,
      });
    }
    return json(404, { error: { code: 'not_found', message: 'No server in this test' } });
  });
}

/** Every screen the stage shows from now on, in order. */
function watchScreens(): { seen: string[]; stop: () => void } {
  const seen: string[] = [];
  const stage = document.getElementById('stage');
  const observer = new MutationObserver(() => {
    const now = screenOn();
    if (now !== undefined && seen.at(-1) !== now) seen.push(now);
  });
  if (stage !== null)
    observer.observe(stage, { attributes: true, attributeFilter: ['data-screen'] });
  return {
    seen,
    stop: () => {
      observer.disconnect();
    },
  };
}

afterAll(() => {
  for (const key of KEYS) window.localStorage.removeItem(key);
  vi.unstubAllGlobals();
});

describe('the Play tab’s mode box (ADR 0081, Option B)', () => {
  it('says exactly what Play starts, with Play whole on screen and no outline until a key', async () => {
    for (const key of KEYS) window.localStorage.removeItem(key);
    await openAs({ online: true, accounts: false }, '');
    await onScreen('home');
    // The chooser and Change rules went: the box is the one way to the rules.
    expect(visible('.home-chooser')).toHaveLength(0);
    expect(visible('.home-link').map((link) => link.textContent)).toStrictEqual(['Free play']);
    expect(boxSays()).toStrictEqual({ who: 'vs Normal bot', rules: 'Best of 3 · Reveal' });
    expect(box().getAttribute('aria-haspopup')).toBe('dialog');
    expect(box().getAttribute('aria-label')).toBe(
      'vs Normal bot, Best of 3 · Reveal: what to play',
    );
    expect(play().textContent.trim()).toBe('Play');
    expect(play().getAttribute('aria-label')).toBe(
      'Play Best of 3, Reveal, against the Normal bot',
    );
    // The box sits right above Play, and both lie whole above the tab bar without a scroll.
    const bar = visible('nav.tab-bar')[0]?.getBoundingClientRect();
    const playBox = play().getBoundingClientRect();
    expect(box().getBoundingClientRect().bottom).toBeLessThanOrEqual(playBox.top);
    expect(window.scrollY).toBe(0);
    expect(Math.round(playBox.bottom)).toBeLessThanOrEqual(Math.round(bar?.top ?? 0));
    // Focused on arrival, as before, but no ring until the keyboard is used.
    expect(document.activeElement).toBe(play());
    expect(getComputedStyle(play()).outlineStyle).toBe('none');
    expect(getComputedStyle(play()).boxShadow).not.toContain('rgb(255');
  });

  it('opens a dialog that changes and remembers each opponent’s rules', async () => {
    await openSheet();
    const dialog = sheet();
    expect(dialog.matches(':modal')).toBe(true);
    expect(document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      'What to play',
    );
    // Focus moved in, onto the dialog's title (ADR 0086): its name is heard, Tab reaches a choice.
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.id).toBe('play-sheet-title');
    expect(groups()).toStrictEqual([
      { name: 'Against', choices: ['vs Bot', 'vs Friend'], chosen: ['vs Bot'] },
      { name: 'Length', choices: ['Best of 3', 'Best of 5'], chosen: ['Best of 3'] },
      { name: 'Format', choices: ['Reveal', 'Showdown', 'Blind'], chosen: ['Reveal'] },
      { name: 'Bot', choices: ['Easy', 'Normal', 'Hard'], chosen: ['Normal'] },
    ]);
    // A format is heard with how it plays.
    expect(choice('Reveal').getAttribute('aria-label')).toBe('Reveal, take turns');

    // Each choice applies at once, and is this device's next time.
    await userEvent.click(choice('Best of 5'));
    await userEvent.click(choice('Hard bot'));
    expect(boxSays()).toStrictEqual({ who: 'vs Hard bot', rules: 'Best of 5 · Reveal' });
    expect(window.localStorage.getItem(SERIES_LENGTH_STORAGE_KEY)).toBe('5');
    expect(window.localStorage.getItem(BOT_LEVEL_STORAGE_KEY)).toBe('hard');
    // Blind has no level to choose.
    await userEvent.click(choice('Blind'));
    expect(groups().map((group) => group.name)).toStrictEqual(['Against', 'Length', 'Format']);
    expect(boxSays()).toStrictEqual({ who: 'vs Bot', rules: 'Best of 5 · Blind' });
    await userEvent.click(choice('Reveal'));
    // Escape only ever closes (ADR 0038): focus back on the box.
    await userEvent.keyboard('{Escape}');
    await expectClosed('Escape');

    // A tap outside the sheet closes it.
    await openSheet();
    await userEvent.click(document.body, { position: { x: 30, y: 30 }, force: true });
    await expectClosed('a tap outside');

    // vs Friend offers only what live matches support, and no level.
    await openSheet();
    await userEvent.click(choice('vs Friend'));
    expect(groups()).toStrictEqual([
      { name: 'Against', choices: ['vs Bot', 'vs Friend'], chosen: ['vs Friend'] },
      { name: 'Length', choices: ['Best of 3', 'Best of 5'], chosen: ['Best of 3'] },
      { name: 'Format', choices: ['Reveal', 'Showdown'], chosen: ['Reveal'] },
    ]);
    expect(boxSays()).toStrictEqual({ who: 'vs Friend', rules: 'Live · Best of 3 · Reveal' });
    await userEvent.click(choice('Showdown'));
    expect(window.localStorage.getItem(FRIEND_FORMAT_STORAGE_KEY)).toBe('showdown');
    // The bot's rules are its own.
    expect(window.localStorage.getItem(PLAY_FORMAT_STORAGE_KEY)).toBe('reveal');
    await userEvent.click(choice('vs Bot'));
    expect(boxSays()).toStrictEqual({ who: 'vs Hard bot', rules: 'Best of 5 · Reveal' });
    await userEvent.click(choice('vs Friend'));
    expect(boxSays()).toStrictEqual({ who: 'vs Friend', rules: 'Live · Best of 3 · Showdown' });

    // One close, the ×, last in the sheet's head, named Close; no Done anywhere.
    const close = checkOneClose('What to play', dialog);
    expect(close.parentElement?.lastElementChild).toBe(close);
    expect(close.parentElement?.classList.contains('play-sheet-head')).toBe(true);
    expect(close.getAttribute('aria-label')).toBe('Close');
    expect(
      [...dialog.querySelectorAll('button')].filter((node) => node.textContent.includes('Done')),
    ).toStrictEqual([]);
    await userEvent.click(close);
    await expectClosed('the ×');

    // Choosing added no history step; Back closes the sheet (and Forward comes back to Play).
    expect(location.search).toBe('');
    await openSheet();
    await back();
    await until(() => !sheet().open, 2_000, 'the sheet to close (Back)', false);
    const returned = new Promise((resolve) => {
      window.addEventListener('popstate', resolve, { once: true });
    });
    history.forward();
    await returned;
    await onScreen('home');

    // The choice outlives the tab: it is read again on open.
    expect(window.localStorage.getItem(PLAY_OPPONENT_STORAGE_KEY)).toBe('friend');
    expect(play().getAttribute('aria-label')).toBe(
      'Play a friend live, Best of 3, Showdown: send them a link',
    );
  });

  it('asks a guest’s first vs Friend Play the 16+ question, then shows the share link', async () => {
    const asked: string[] = [];
    fakeServer(asked);
    const screens = watchScreens();
    await userEvent.click(play());
    await onScreen('send');
    // The 16+ question in the send screen's place: no rules step before or after it.
    expect(visible('#online-challenge :is(h1, h2)').map((h) => h.textContent)).toContain(
      'Play online',
    );
    expect(visible('.rules-step')).toHaveLength(0);
    const yes = visible('#online-challenge button').find((node) =>
      node.textContent.includes('16 or older'),
    );
    if (yes === undefined) throw new Error('No 16+ button');
    await userEvent.click(yes);
    await onScreen('challenge');
    await until(
      () =>
        visible('#online-challenge :is(h1, h2)').some(
          (h) => h.textContent === 'Waiting for your friend',
        ),
      5_000,
      'the lobby',
      false,
    );
    screens.stop();
    expect(screens.seen).toStrictEqual(['send', 'challenge']);
    expect(visible('.rules-step')).toHaveLength(0);
    expect(location.search).toBe(`?challenge=${TOKEN}`);
    // Sent with the sheet's rules, live.
    const sent = asked.find((line) => line.startsWith('POST challenges'));
    expect(sent).toContain('"format":"showdown"');
    expect(sent).toContain('"bestOf":3');
    expect(sent).toContain('"live":true');
    // The 16+ step took no entry of its own: Back from the lobby is home.
    await back();
    await onScreen('home');
    expect(location.search).toBe('');
  });

  it('with a guest, goes straight from Play to the share link', async () => {
    const asked: string[] = [];
    fakeServer(asked);
    expect(window.localStorage.getItem(GUEST_KEY)).toBe('1');
    const screens = watchScreens();
    await userEvent.click(play());
    await onScreen('challenge');
    await settle();
    screens.stop();
    // Play stayed busy until the lobby could show: home, then the lobby, nothing between.
    expect(screens.seen).toStrictEqual(['challenge']);
    expect(asked.filter((line) => line.startsWith('POST'))).toHaveLength(1);
    // Production's shape has no accounts (ADR 0089): no friends to offer, no sign-in line.
    expect(visible('.who-lobby, .who-lobby-line')).toHaveLength(0);
    expect(document.querySelector('dialog.who-sheet')).toBeNull();
    await back();
    await onScreen('home');
    expect(boxSays()).toStrictEqual({ who: 'vs Friend', rules: 'Live · Best of 3 · Showdown' });
  });

  it('keeps the old send link’s setup, its formats in the same order', async () => {
    await follow(LINKS.send);
    await onScreen('send');
    expect(visible('.rules-card-name').map((name) => name.textContent)).toStrictEqual([
      'Reveal',
      'Showdown',
    ]);
    await back();
    await onScreen('home');
    expect(location.search).toBe('');
  });
});
