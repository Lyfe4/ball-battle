// The real page as a given build reads its URLs (ADR 0081): the build's switches are stubbed
// before main.ts loads (`VITE_ONLINE`, `VITE_ACCOUNTS`, read once by online-build.ts and
// accounts-build.ts), so one browser project checks production, production with vs Friend on, and
// previews. The API answers every request with a refusal at once, so no screen waits on a server.
import { expect, vi } from 'vitest';
import page from '../../index.html?raw';
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

/**
 * On every tab screen of a build with accounts, reached by its tab: one avatar, in the header row's
 * lead slot at every size (ADR 0087), and where the rail shows, the game's mark atop it in the
 * avatar's old place; the avatar opens Profile, which has none, and Profile's Back returns to that
 * tab (ADR 0081). Ends back on Play.
 */
export async function avatarOnEveryTab(): Promise<void> {
  await openAs({ online: true, accounts: true }, '');
  for (const [label, screen] of TAB_SCREENS) {
    if (label !== 'Play') tabLink(label).click();
    await onScreen(screen);
    await settle();
    const shown = avatarsShown();
    expect(shown, screen).toHaveLength(1);
    const avatar = shown[0];
    if (avatar === undefined) return;
    expect(avatar.getAttribute('aria-label'), screen).toBe('Profile');
    // In this screen's own lead slot, first in its header row.
    const lead = avatar.parentElement;
    expect(lead?.classList.contains('screen-lead'), screen).toBe(true);
    expect(lead?.parentElement?.firstElementChild, screen).toBe(lead);
    expect(lead?.closest('[hidden]'), screen).toBeNull();
    const rail = tabBar();
    const mark = rail?.querySelector('.tab-bar-mark');
    if (mark instanceof HTMLElement && mark.getClientRects().length > 0) {
      // The rail (beside, a desktop): the mark tops it, above its first tab.
      const first = rail?.querySelector('a')?.getBoundingClientRect();
      expect(mark.getBoundingClientRect().bottom, screen).toBeLessThanOrEqual(first?.top ?? 0);
      expect(rail?.querySelector('.account-toggle'), screen).toBeNull();
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
