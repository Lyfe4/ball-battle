// A first visit seen from the server (font-once.safari.browser.test.ts): the browser command opens
// the page in a fresh browser context (an empty cache, as a first visit), every request of which
// carries one header, and the dev server's middleware counts that context's requests by path.
// Counting at the server, not with Playwright's request events, sees only real downloads: WebKit
// serves a font from its preload without a second fetch, yet Playwright reports one.
import type { Plugin } from 'vite';
import type { BrowserCommand } from 'vitest/node';

const VISIT_HEADER = 'x-ballbattle-first-visit';

/** Each first visit's requests, by visit id, then by path. */
const visits = new Map<string, Map<string, number>>();

/** Counts each first visit's requests (the dev server of the browser projects only). */
export const firstVisitCounter: Plugin = {
  name: 'ballbattle-first-visit-counter',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const id = request.headers[VISIT_HEADER];
      const counts = typeof id === 'string' ? visits.get(id) : undefined;
      if (counts !== undefined && request.url !== undefined) {
        const path = request.url.split('?')[0] ?? request.url;
        counts.set(path, (counts.get(path) ?? 0) + 1);
      }
      next();
    });
  },
};

let nextVisit = 0;

/**
 * Opens `/index.html` + `search` as a first visit at the test's own viewport, waits until the
 * stage shows and its fonts have loaded, then a little longer for any late request, and returns
 * how many requests of each path ending in `suffix` reached the server.
 */
export const firstVisitRequests: BrowserCommand<[search: string, suffix: string]> = async (
  context,
  search,
  suffix,
) => {
  const browser = context.context.browser();
  if (browser === null) throw new Error('No browser to open a first visit in');
  const id = `visit-${String(nextVisit++)}`;
  const counts = new Map<string, number>();
  visits.set(id, counts);
  const fresh = await browser.newContext({
    viewport: context.page.viewportSize(),
    extraHTTPHeaders: { [VISIT_HEADER]: id },
  });
  try {
    const page = await fresh.newPage();
    await page.goto(new URL(`/index.html${search}`, context.page.url()).href);
    // A string, as it runs in the page (this file has no DOM types).
    await page.waitForFunction(
      "document.getElementById('stage')?.hasAttribute('data-booting') === false && document.fonts.status === 'loaded'",
    );
    await page.waitForTimeout(500);
    return Object.fromEntries([...counts].filter(([path]) => path.endsWith(suffix)));
  } finally {
    await fresh.close();
    visits.delete(id);
  }
};
