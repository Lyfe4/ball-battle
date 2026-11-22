// What a phone shows when an online request fails (ADR 0052): "You're offline" only when the
// device is offline or the request got no response at all; a server too slow to answer, a server
// error and a refusal each say so with Try again, and Try again works once the server does. The
// real page from `netlify dev` with the API answered by the test (`page.route`), so each failure is
// exact: accepting a friend's challenge (where a phone met "You're offline" on staging, 2026-11-15)
// and reading a series. iPhone Safari's visible size, Chromium only, like the friend challenge.
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
const PHONE = { width: 390, height: 664 };
const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAA';
const SERIES = '00000000-0000-4000-8000-000000000000';
/** callApi's limit (src/app/api.ts). */
const TIMEOUT_MS = 15_000;

type Failure = (route: Route) => Promise<void> | void;

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Each way a request can fail, and the notice it must bring. */
const FAILURES: readonly {
  readonly name: string;
  readonly fail: Failure;
  readonly title: string;
  readonly text?: string;
}[] = [
  {
    name: 'a network error (no response at all)',
    fail: (route) => route.abort('internetdisconnected'),
    title: 'You’re offline',
  },
  {
    // Netlify's gateway when a function runs past its limit: not our JSON.
    name: 'a gateway timeout page',
    fail: (route) =>
      route.fulfill({ status: 504, contentType: 'text/html', body: '<H1>Inactivity Timeout</H1>' }),
    title: 'Something went wrong',
  },
  {
    name: 'our own server error',
    fail: (route) => json(route, 500, { error: { code: 'internal', message: 'Oops' } }),
    title: 'Something went wrong',
  },
  {
    name: 'a refusal',
    fail: (route) =>
      json(route, 429, { error: { code: 'rate_limited', message: 'Too many moves: wait a bit' } }),
    title: 'That didn’t work',
    text: 'Too many moves: wait a bit',
  },
];

let browser: Browser;
let context: BrowserContext | undefined;

beforeAll(async () => {
  const health = await fetch(`${BASE}/api/v1/health`).catch(() => undefined);
  if (health?.ok !== true) {
    throw new Error(`No online server at ${BASE}: pnpm build:online, then netlify dev`);
  }
  browser = await chromium.launch();
});

afterEach(async () => {
  await context?.close();
  context = undefined;
});

afterAll(async () => {
  await browser.close();
});

/** A fresh phone that already has a guest, and a friend's open challenge to accept. */
async function phone(): Promise<Page> {
  context = await browser.newContext({ viewport: PHONE });
  await context.addInitScript(() => {
    localStorage.setItem('ballbattle.online.guest', '1');
  });
  const page = await context.newPage();
  // The guest is known to the server too: the page asks `/me` on load, whatever the screen, and a
  // 401 there forgets the guest, so Try again would ask the 16+ question instead of accepting.
  await page.route('**/api/v1/me', (route) => json(route, 200, { name: 'Player 4321' }));
  await page.route(`**/api/v1/challenges/${TOKEN}`, (route) =>
    json(route, 200, {
      format: 'reveal',
      bestOf: 3,
      from: 'Player 1234',
      status: 'open',
      seriesId: null,
    }),
  );
  return page;
}

/** The friend's lineup, built, up to the Accept challenge button. */
async function lineupReady(page: Page): Promise<void> {
  await page.goto(`${BASE}/?challenge=${TOKEN}`);
  await page.getByRole('button', { name: 'Build your lineup' }).click();
  const grid = page.locator('#online-lineup .ball-grid button');
  for (let index = 0; index < 3; index += 1) await grid.nth(index).click();
}

/** Answers every accept with `fail` until `recover()`, then accepts. */
async function routeAccept(page: Page, fail: Failure): Promise<{ readonly recover: () => void }> {
  let failing = true;
  await page.route(`**/api/v1/challenges/${TOKEN}/accept`, (route) =>
    failing ? fail(route) : json(route, 200, { seriesId: SERIES }),
  );
  return {
    recover: () => {
      failing = false;
    },
  };
}

async function noticeSays(page: Page, title: string, text?: string): Promise<void> {
  await page.getByRole('heading', { name: title }).waitFor();
  const notice = page
    .locator('#online-challenge, #online-series-notice')
    .filter({ hasText: title });
  if (text !== undefined) await expect(notice.innerText()).resolves.toContain(text);
  if (title !== 'You’re offline') {
    await expect(page.getByText('offline').count()).resolves.toBe(0);
  }
}

/** Try again, now that the server answers: the accepted series opens. */
async function retried(page: Page, recover: () => void): Promise<void> {
  recover();
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.waitForURL(new RegExp(`[?&]online=${SERIES}`));
}

describe('accepting a challenge on a phone', () => {
  for (const { name, fail, title, text } of FAILURES) {
    it(`after ${name} says "${title}", and Try again accepts`, { timeout: 60_000 }, async () => {
      const page = await phone();
      await lineupReady(page);
      const accept = await routeAccept(page, fail);
      await page.getByRole('button', { name: 'Accept challenge' }).click();
      await noticeSays(page, title, text);
      await retried(page, accept.recover);
    });
  }

  it('offline says "You’re offline" without sending, and Try again accepts once back', async () => {
    const page = await phone();
    await lineupReady(page);
    let sent = 0;
    const accept = await routeAccept(page, (route) => {
      sent += 1;
      return route.abort('internetdisconnected');
    });
    await context?.setOffline(true);
    await page.getByRole('button', { name: 'Accept challenge' }).click();
    await noticeSays(page, 'You’re offline');
    expect(sent).toBe(0);
    await context?.setOffline(false);
    await retried(page, accept.recover);
  });

  it('a server too slow to answer says "No answer yet", not offline', async () => {
    const page = await phone();
    await page.clock.install();
    await lineupReady(page);
    const accept = await routeAccept(page, () => undefined);
    const sent = page.waitForRequest(`**/api/v1/challenges/${TOKEN}/accept`);
    await page.getByRole('button', { name: 'Accept challenge' }).click();
    await sent;
    await page.clock.runFor(TIMEOUT_MS);
    await noticeSays(page, 'No answer yet');
    await retried(page, accept.recover);
  });
});

describe('reading a series on a phone', () => {
  it('that hangs says "No answer yet", and Try again shows what the server says', async () => {
    const page = await phone();
    await page.clock.install();
    let failing = true;
    await page.route(`**/api/v1/series/${SERIES}`, (route) =>
      failing ? undefined : json(route, 404, { error: { code: 'not_found', message: 'No such' } }),
    );
    const sent = page.waitForRequest(`**/api/v1/series/${SERIES}`);
    await page.goto(`${BASE}/?online=${SERIES}`);
    await sent;
    await page.clock.runFor(TIMEOUT_MS);
    await noticeSays(page, 'No answer yet');
    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('heading', { name: 'Nothing here' }).waitFor();
  });

  for (const { name, fail, title, text } of FAILURES) {
    it(`after ${name} says "${title}"`, async () => {
      const page = await phone();
      await page.route(`**/api/v1/series/${SERIES}`, fail);
      await page.goto(`${BASE}/?online=${SERIES}`);
      await noticeSays(page, title, text);
      await page.getByRole('button', { name: 'Try again' }).waitFor();
    });
  }
});
