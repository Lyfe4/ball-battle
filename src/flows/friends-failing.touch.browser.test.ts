// Friends never jumps when the server fails (ADR 0087 addendum of 2026-11-28), on a device that
// remembers an account, at 375 x 812 with real taps (browsers-touch). The slow walk caught this
// now and then: which failure landed first, `/me` or the list, decided whether the screen moved.
// Here the test holds every read and lets them fail in each order: the header and the link card
// never move, nothing shifts past ADR 0087's 0.02 (where the browser reports shifts), and one
// failure card offers Try again. Opens on Friends and moves only between Ranks and Friends.
import { describe, expect, it } from 'vitest';
import { ACCOUNT_STORAGE_KEY } from '../app/online-device.ts';
import { visitCache } from '../app/visit-cache.ts';
import { frames, until, visible } from './page-support.ts';
import { follow, onScreen, openAs } from './shell-routes-support.ts';

/** Each held read, failed with a 500 when the test says; `restore` puts the page's fetch back. */
function holdReads(paths: readonly string[]) {
  const real = window.fetch.bind(window);
  const waiting = new Map<string, (() => void)[]>();
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (!paths.includes(url.pathname)) return real(input, init);
    return new Promise<Response>((resolve) => {
      const list = waiting.get(url.pathname) ?? [];
      list.push(() => {
        resolve(
          new Response(JSON.stringify({ error: { code: 'internal', message: 'Failing' } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });
      waiting.set(url.pathname, list);
    });
  };
  return {
    restore() {
      window.fetch = real;
    },
    async release(path: string) {
      await until(() => (waiting.get(path)?.length ?? 0) > 0, 5_000, `a read of ${path}`, false);
      for (const done of waiting.get(path) ?? []) done();
      waiting.set(path, []);
      await frames(3);
    },
  };
}

/** Layout shifts from now (Chromium reports them; elsewhere the boxes below decide). */
function watchShifts(): () => number {
  let total = 0;
  if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) return () => 0;
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    })[]) {
      if (!entry.hadRecentInput) total += entry.value;
    }
  });
  observer.observe({ type: 'layout-shift' });
  return () => {
    observer.disconnect();
    return Math.round(total * 1000) / 1000;
  };
}

const boxOf = (selector: string): string => {
  const node = visible(selector)[0];
  const box = node?.getBoundingClientRect();
  return box === undefined ? 'none' : `${box.left.toFixed(1)},${box.top.toFixed(1)}`;
};

/** Where the parts that must stay sit: the header's title and the link card. */
const anchors = () => ({
  title: boxOf('.friends-screen .screen-title'),
  link: boxOf('.friends-screen .friends-link-card'),
});

/** Friends opened afresh with every read held, then failed in `order`. */
async function friendsFailing(order: readonly string[]): Promise<void> {
  await follow('?view=ranks');
  await onScreen('ranks');
  const held = holdReads(['/api/v1/me', '/api/v1/friends']);
  visitCache.clear();
  await follow('?view=friends');
  await onScreen('friends');
  await document.fonts.ready;
  await frames(3);
  const before = anchors();
  const shifts = watchShifts();
  for (const path of order) await held.release(path);
  await frames(3);
  await new Promise((resolve) => setTimeout(resolve, 300));
  held.restore();
  expect({
    order,
    anchors: anchors(),
    shift: shifts() <= 0.02,
    tryAgain: visible('.friends-screen button').filter(
      (node) => node.textContent.trim() === 'Try again',
    ).length,
  }).toStrictEqual({ order, anchors: before, shift: true, tryAgain: 1 });
}

describe('Friends when the server fails, signed in on this device', () => {
  it('keeps its place whichever failure lands first', async () => {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, '1');
    // The inbox fails too (no answer given): nothing says how many friends there are.
    await openAs({ online: true, accounts: true }, '?view=ranks', {
      '/api/v1/me': { name: 'robin_b', account: true, username: 'robin_b' },
    });
    await friendsFailing(['/api/v1/me', '/api/v1/friends']);
    await friendsFailing(['/api/v1/friends', '/api/v1/me']);
  }, 60_000);
});
