// The real page as a given build reads its URLs (ADR 0081): the build's switches are stubbed
// before main.ts loads (`VITE_ONLINE`, `VITE_ACCOUNTS`, read once by online-build.ts and
// accounts-build.ts), so one browser project checks production, production with vs Friend on, and
// previews. The API answers every request with a refusal at once, so no screen waits on a server.
import { expect, vi } from 'vitest';
import page from '../../index.html?raw';
import { ACCOUNT_STORAGE_KEY } from '../app/online-device.ts';
import { button, settle, until, visible } from './page-support.ts';

export interface Build {
  readonly online: boolean;
  readonly accounts: boolean;
}

/** A test's own API answers, by path ("/api/v1/me"); any other path is refused. */
export type Answers = Readonly<Record<string, unknown>>;

/** An answer with no response at all: the device is offline (a fetch that rejects). */
export const OFFLINE = Symbol('offline');
const STATUS = Symbol('status');
/** An answer with a status of its own (a server error, a refusal), not 200. */
export const withStatus = (status: number, body: unknown) => ({ [STATUS]: status, body });
const statusOf = (answer: unknown): { status: number; body: unknown } | undefined =>
  typeof answer === 'object' && answer !== null && STATUS in answer
    ? { status: Number(answer[STATUS]), body: (answer as unknown as { body: unknown }).body }
    : undefined;

/**
 * Loads the page as `build` at `search`, the API answering from `answers` where it has one. Once
 * per file: main.ts runs once.
 */
export async function openAs(build: Build, search: string, answers: Answers = {}): Promise<void> {
  vi.stubEnv('VITE_ONLINE', build.online ? '1' : '');
  vi.stubEnv('VITE_ACCOUNTS', build.accounts ? '1' : '');
  const real = window.fetch.bind(window);
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (!url.pathname.startsWith('/api/')) return real(input, init);
    // Sign-in's options, so Google's return is read, and the test's own; everything else refused.
    const answer = answers[url.pathname];
    if (answer === OFFLINE) return Promise.reject(new TypeError('Failed to fetch'));
    const given = statusOf(answer);
    if (given !== undefined) {
      return Promise.resolve(
        new Response(JSON.stringify(given.body), {
          status: given.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    const options = url.pathname === '/api/v1/auth/options';
    const ok = options || answer !== undefined;
    const body = options
      ? { google: true, emailCodes: true }
      : (answer ?? { error: { code: 'not_found', message: 'No server in this test' } });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: ok ? 200 : 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  const body = new DOMParser().parseFromString(page, 'text/html').body;
  document.body.replaceChildren(...body.children);
  history.replaceState(null, '', `${location.pathname}${search}`);
  await import('../main.ts');
  await settle();
}

/** Opens `search` as a link followed in the same tab would: a new entry, read by the page. */
export async function follow(search: string): Promise<void> {
  history.pushState(null, '', `${location.pathname}${search}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  await settle();
}

/** The screen on show, as the stage names it. */
export const screenOn = (): string | undefined =>
  document.getElementById('stage')?.dataset['screen'];

/** Waits for screen `screen`, failing with where the page is. */
export async function onScreen(screen: string): Promise<void> {
  await until(() => screenOn() === screen, 5_000, `the ${screen} screen`, false);
  // The Balls manual is a chunk of its own (manual-lazy.ts): drawn once it has come.
  if (screen === 'manual') await manualDrawn();
}

/** Waits for the Balls manual's chunk to be drawn (busy until then, manual-lazy.ts). */
export async function manualDrawn(): Promise<void> {
  await until(
    () => document.querySelector('#manual[aria-busy]') === null,
    10_000,
    'the Balls manual',
    false,
  );
}

/** The shell's own screen's heading (Ranks), if it shows. */
export const placeholderTitle = (): string | undefined =>
  visible('#shell-screen h1')[0]?.textContent.trim();

/** Expects home, with its address bare (a fallback rewrites it, so the URL says home too). */
export async function expectHome(): Promise<void> {
  await onScreen('home');
  expect(location.search).toBe('');
  expect(visible('#home').length).toBe(1);
}

/** Presses the shell's own screen's way on. */
export async function pressPlaceholder(name: string): Promise<void> {
  button(name).click();
  await settle();
}

/** Well-formed online links, as the game writes them (online-url.ts). */
export const LINKS = {
  online: '?online=0b8f9c1e-2a4d-4e6f-8a1b-3c5d7e9f0a2b',
  start: '?start=0b8f9c1e-2a4d-4e6f-8a1b-3c5d7e9f0a2b',
  challenge: '?challenge=AbCdEfGhIjKlMnOpQrStUv',
  send: '?view=send&fmt=reveal&mode=bo3',
  google: '?view=signin&google=signed_in',
} as const;

/** The tab bar, if it is laid out (a task on a phone hides it by its stylesheet). */
export const tabBar = (): HTMLElement | undefined =>
  visible('nav.tab-bar').find((node) => node.getClientRects().length > 0);

/** The tabs' words, in order, as the bar shows them (none when it is hidden). */
export const tabLabels = (): string[] =>
  visible('nav.tab-bar .tab-bar-label').map((label) => label.textContent.trim());

/** The tab marked as the page on show. */
export const currentTab = (): string | undefined =>
  document.querySelector('nav.tab-bar [aria-current="page"] .tab-bar-label')?.textContent.trim();

/** The tab link named `label`. */
export function tabLink(label: string): HTMLAnchorElement {
  const link = [...document.querySelectorAll<HTMLAnchorElement>('nav.tab-bar a')].find(
    (node) => node.querySelector('.tab-bar-label')?.textContent.trim() === label,
  );
  if (link === undefined) throw new Error(`No tab "${label}"`);
  return link;
}

/** The avatars laid out on the page: each is `display: none` where it isn't the one (online.css). */
export const avatarsShown = (): HTMLElement[] =>
  visible('button.account-toggle').filter((node) => node.getClientRects().length > 0);

const TAB_SCREENS = [
  ['Play', 'home'],
  ['Balls', 'manual'],
  ['Friends', 'friends'],
  ['Ranks', 'ranks'],
] as const;

const NAME = 'calvino';
const FRIENDS = [
  { id: 'f-1', name: 'Jo', status: 'offline' },
  { id: 'f-2', name: 'Robin', status: 'online' },
];
/** A signed-in account with two friends: the avatar shows its name where the rail shows. */
const SIGNED_IN: Answers = {
  '/api/v1/me': { name: NAME, account: true, username: NAME },
  '/api/v1/me/inbox': { friends: FRIENDS, requests: 0, invites: [], turns: [] },
  '/api/v1/friends': {
    code: '7KQ2M9XD',
    friends: FRIENDS,
    incoming: [],
    outgoing: [],
    blocked: [],
  },
};

const seen = (node: Element | null | undefined): node is Element =>
  node instanceof Element && node.getClientRects().length > 0;

/** How many times `text` shows, laid out, in `root` (`display: none` text is not in innerText). */
const timesShown = (root: HTMLElement, text: string): number =>
  root.innerText.split(text).length - 1;

/**
 * On every tab screen of a build with accounts, signed in, reached by its tab: one avatar, top
 * right in this screen's header row just before its `?` and gear (ADR 0087 addendum of
 * 2026-11-26), its username shown once in the row where the rail shows and not at all on a phone;
 * where the rail shows, the game's mark atop it and this tab's own icon in the lead slot, else the
 * mark in the lead slot; the avatar opens Profile, which has none, and Profile's Back returns to
 * that tab (ADR 0081). Ends back on Play.
 */
export async function avatarOnEveryTab(): Promise<void> {
  // A remembered account, so the page asks /me who it is (who-am-i.ts).
  localStorage.setItem(ACCOUNT_STORAGE_KEY, '1');
  await openAs({ online: true, accounts: true }, '', SIGNED_IN);
  for (const [label, screen] of TAB_SCREENS) {
    if (label !== 'Play') tabLink(label).click();
    await onScreen(screen);
    await until(
      () => avatarsShown().some((node) => node.getAttribute('aria-label') === `Profile, ${NAME}`),
      5_000,
      `${screen}: the avatar signed in`,
    );
    await settle();
    const shown = avatarsShown();
    expect(shown, screen).toHaveLength(1);
    const avatar = shown[0];
    if (avatar === undefined) return;
    // In this screen's own header row, just before its tools: the `?` or the gear.
    const row = avatar.parentElement;
    if (row === null) return;
    expect(row.classList.contains('screen-header'), screen).toBe(true);
    expect(row.closest('[hidden]'), screen).toBeNull();
    const next = avatar.nextElementSibling;
    expect(next?.matches('.symbol-legend-toggle, .settings-toggle'), screen).toBe(true);
    const rail = tabBar();
    const mark = rail?.querySelector('.tab-bar-mark');
    const own = row.querySelector('.screen-lead .screen-mark');
    const icon = row.querySelector('.screen-lead .screen-tab-icon');
    if (seen(mark)) {
      // The rail (beside, a desktop): the mark tops it, above its first tab; the lead slot holds
      // this tab's own icon, the one the rail shows for it, and no mark.
      const first = rail?.querySelector('a')?.getBoundingClientRect();
      expect(mark.getBoundingClientRect().bottom, screen).toBeLessThanOrEqual(first?.top ?? 0);
      expect(rail?.querySelector('.account-toggle'), screen).toBeNull();
      expect(seen(own), `${screen}: one mark`).toBe(false);
      expect(seen(icon), `${screen}: the tab's icon leads the row`).toBe(true);
      const railPath = rail?.querySelector('[aria-current="page"] .tab-bar-icon path');
      expect(icon?.querySelector('path')?.getAttribute('d'), screen).toBe(
        railPath?.getAttribute('d'),
      );
      expect(icon?.getAttribute('aria-hidden'), screen).toBe('true');
      expect(timesShown(row, NAME), `${screen}: the name once`).toBe(1);
    } else {
      expect(seen(own), `${screen}: the mark leads the row`).toBe(true);
      expect(seen(icon), `${screen}: no tab icon beside the mark`).toBe(false);
      expect(timesShown(row, NAME), `${screen}: no name on a phone`).toBe(0);
    }
    avatar.click();
    await onScreen('profile');
    await settle();
    // Profile is browsed to (ADR 0087): the bar or rail stays with the opener's tab lit; no avatar.
    expect(currentTab(), screen).toBe(label);
    expect(avatarsShown(), screen).toHaveLength(0);
    button('Back').click();
    await onScreen(screen);
    await settle();
    expect(currentTab(), screen).toBe(label);
  }
  tabLink('Play').click();
  await onScreen('home');
}
