// Two phones in a live friend match (ADR 0053), for the online flows: browser contexts at iPhone
// Safari's visible size against `netlify dev` (an online build and the API on one origin, over a
// local Supabase). Each phone is its own guest. The fights come from the series' random id, so a
// flow plays whatever the screen offers rather than pinning a seed.
import { chromium, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import { expect } from 'vitest';

/** iPhone Safari's visible size (ADR 0039). */
export const PHONE = { width: 390, height: 664 };

export interface Phones {
  /** The online server: `netlify dev`'s origin. */
  readonly base: string;
  readonly browser: Browser;
  readonly contexts: BrowserContext[];
  /** Every console error on any phone (a CSP violation is one). */
  readonly errors: string[];
}

/** `engine` is Chromium (as CI runs it) unless 'webkit': one run in Safari's engine. */
export async function openPhones(base: string, engine?: string): Promise<Phones> {
  const health = await fetch(`${base}/api/v1/health`).catch(() => undefined);
  if (health?.ok !== true) {
    throw new Error(`No online server at ${base}: pnpm build:online, then netlify dev`);
  }
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  return { base, browser, contexts: [], errors: [] };
}

export async function closePhones(phones: Phones): Promise<void> {
  for (const context of phones.contexts) await context.close();
  await phones.browser.close();
}

/**
 * Notes every loading state a page shows (ADR 0054): a screen's skeleton (by its section's id) or a
 * "Loading…" heading. Moving between screens shows neither; only a cold open shows a skeleton.
 * Against a deploy preview (ONLINE_BASE_URL) it also removes Netlify's toolbar.
 */
const LOADING_PROBE = `
  window.__loading = [];
  const note = () => {
    // A deploy preview's Netlify toolbar covers the page's buttons.
    document.querySelector('[data-netlify-deploy-id]')?.remove();
    for (const node of document.querySelectorAll('.skeleton, h1')) {
      const shown = node.getClientRects().length > 0;
      const what = node.matches('.skeleton') ? node.id : node.textContent === 'Loading…' ? 'Loading…' : '';
      if (shown && what !== '' && !window.__loading.includes(what)) window.__loading.push(what);
    }
  };
  new MutationObserver(note).observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
`;

/** The loading states `page` has shown since it opened or since the last `forgetLoading`. */
export const loadingSeen = (page: Page): Promise<string[]> =>
  page.evaluate(() => (globalThis as unknown as { __loading: string[] }).__loading);

export const forgetLoading = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (globalThis as unknown as { __loading: string[] }).__loading = [];
  });

/** A fresh phone, collecting console errors and the loading states it shows. */
export async function phone(phones: Phones): Promise<Page> {
  const context = await phones.browser.newContext({ viewport: PHONE });
  phones.contexts.push(context);
  const page = await context.newPage();
  await page.addInitScript(LOADING_PROBE);
  page.on('console', (message) => {
    // A request the page meant to fail (offline on purpose) is not an error of the page's.
    if (
      message.type() === 'error' &&
      !/ERR_INTERNET_DISCONNECTED|Failed to load/.test(message.text())
    ) {
      phones.errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => phones.errors.push(error.message));
  return page;
}

/** Fills the visible lineup tray with the first three balls of the grid, then presses `done`. */
async function buildLineup(page: Page, done: string): Promise<void> {
  const grid = page.locator('#online-lineup .ball-grid button');
  for (let index = 0; index < 3; index += 1) await grid.nth(index).click();
  await page.getByRole('button', { name: done }).click();
}

/** The 16+ card: the first online action on this device. */
async function confirmAge(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Play online' }).waitFor();
  await page.getByRole('button', { name: 'I’m 16 or older' }).click();
}

/**
 * The sender sends a live Best of 3 from home's vs Friend and waits in the lobby; the friend opens the link, sees the
 * line about staying, and accepts. Both end up in the series: the sender's lobby goes there by
 * itself. Returns the series id.
 */
export async function startLiveMatch(
  base: string,
  sender: Page,
  friend: Page,
  format = 'reveal',
): Promise<string> {
  // From home, as a player starts it (ADR 0055): vs Friend, the 16+ question first, then its setup.
  await sender.goto(`${base}/`);
  await sender.locator('.home-card[data-opponent="friend"]').click();
  await confirmAge(sender);
  await sender.getByRole('heading', { name: 'vs Friend' }).waitFor();
  if (format !== 'reveal') {
    await sender.locator('#online-lineup .rules-card', { hasText: /^Showdown/ }).click();
  }
  await sender.getByRole('button', { name: 'Choose lineup' }).click();
  await buildLineup(sender, 'Send challenge');
  await sender.getByRole('heading', { name: 'Waiting for your friend…' }).waitFor();
  // Send challenge stayed busy until the lobby could show: nothing loading between them.
  expect(await loadingSeen(sender)).toStrictEqual([]);
  const token = new URL(sender.url()).searchParams.get('challenge') ?? '';

  await friend.goto(`${base}/?challenge=${token}`);
  await friend.getByRole('heading', { name: /challenges you$/ }).waitFor();
  // A link opened cold: the card's own layout while it loads, never a Loading title.
  expect(await loadingSeen(friend)).not.toContain('Loading…');
  await forgetLoading(friend);
  await friend.getByText('Leaving for 30 s loses the match').waitFor();
  await friend.getByRole('button', { name: 'Build your lineup' }).click();
  // The 16+ question comes before the lineup, never after it is built (ADR 0055).
  await confirmAge(friend);
  await buildLineup(friend, 'Accept challenge');
  await friend.waitForURL(/[?&]online=/);
  await sender.waitForURL(/[?&]online=/, { timeout: 20_000 });
  // Accept and the lobby each waited for the series: it showed complete on arrival.
  expect(await loadingSeen(friend)).toStrictEqual([]);
  expect(await loadingSeen(sender)).toStrictEqual([]);
  return new URL(friend.url()).searchParams.get('online') ?? '';
}

export const panelOf = (page: Page) => page.locator('#online-series');
export const noteOf = (page: Page) => page.locator('#online-series .series-note');
export const footOf = (page: Page) => page.locator('.live-line');

/** Picks the first ball offered, if a pick is offered now. True when it picked. */
export async function pickIfDue(page: Page): Promise<boolean> {
  const pick = panelOf(page).locator('.pick-row-pick').first();
  if (!(await pick.isVisible())) return false;
  await pick.click().catch(() => undefined);
  return true;
}

/** True once the series' result shows. */
export const finished = (page: Page) => panelOf(page).locator('.series-result').isVisible();
