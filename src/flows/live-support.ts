// Two phones in a live friend match (ADR 0053), for the online flows: browser contexts at iPhone
// Safari's visible size against `netlify dev` (an online build and the API on one origin, over a
// local Supabase). Each phone is its own guest. The fights come from the series' random id, so a
// flow plays whatever the screen offers rather than pinning a seed.
import { chromium, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import { expect } from 'vitest';
import { attemptWatchMs, LEAD_MS, roundWatchMs, TOSS_LEAD_MS } from '../api/live.ts';
import { MATCH_TIME_LIMIT_TICKS } from '../sim/constants.ts';
import { MAX_ATTEMPTS } from '../sim/series.ts';
import { allowLocalRealtime, blockRealtime, watchPage } from './realtime-support.ts';

/**
 * The Play tab's way to a friend match (ADR 0081, Option B): the mode box's sheet, vs Friend and
 * `format`, Done, then Play: straight to the link (the 16+ question first on a new device).
 */
export async function playAFriend(page: Page, format = 'Reveal'): Promise<void> {
  await page.locator('.play-box').click();
  const sheet = page.getByRole('dialog', { name: 'What to play' });
  await sheet.getByRole('button', { name: 'vs Friend' }).click();
  await sheet.getByRole('button', { name: new RegExp(`^${format},`) }).click();
  await sheet.locator('.play-sheet-done').click();
  await page.locator('.home-play-row .home-play').click();
}

/** iPhone Safari's visible size (ADR 0039). */
export const PHONE = { width: 390, height: 664 };

export interface Phones {
  /** The online server: `netlify dev`'s origin. */
  readonly base: string;
  readonly browser: Browser;
  readonly contexts: BrowserContext[];
  /** Every console error on any phone (a CSP violation is one). */
  readonly errors: string[];
  /** Each phone's Realtime socket is blocked (ADR 0082): its pages poll as before. */
  readonly blocked?: boolean;
}

/** `engine` is Chromium (as CI runs it) unless 'webkit': one run in Safari's engine. */
export async function openPhones(base: string, engine?: string, blocked = false): Promise<Phones> {
  const health = await fetch(`${base}/api/v1/health`).catch(() => undefined);
  if (health?.ok !== true) {
    throw new Error(`No online server at ${base}: pnpm build:online, then netlify dev`);
  }
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  return { base, browser, contexts: [], errors: [], blocked };
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

/**
 * Notes every look of the live ready card as it changes (playtest 2026-11-19): its countdown line
 * ("Get ready", "3", "2", "1"), "" while it shows without one, "gone" once hidden. After a number the
 * card only ever goes: nothing else flashes before the fight.
 */
const READY_PROBE = `
  window.__ready = [];
  const look = () => {
    const layer = document.querySelector('.ready-layer');
    const card = layer?.querySelector('.ready-card[data-live="true"]');
    if (!card) return;
    const shown = layer.getClientRects().length > 0 && !layer.hidden;
    const now = shown ? (card.querySelector('.ready-count')?.textContent ?? '') : 'gone';
    if (window.__ready.at(-1) !== now) window.__ready.push(now);
  };
  new MutationObserver(look).observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
`;

/** Every look of the live ready card `page` has shown, in order (READY_PROBE). */
export const readySeen = (page: Page): Promise<string[]> =>
  page.evaluate(() => (globalThis as unknown as { __ready: string[] }).__ready);

/** Where a countdown number was followed by anything but the card going: a flash. */
export const readyFlashes = (seen: readonly string[]): string[] =>
  seen.flatMap((now, index) => {
    const next = seen[index + 1];
    return /^d$/.test(now) && next !== undefined && next !== 'gone' && !/^d$/.test(next)
      ? [`${now} → "${next}"`]
      : [];
  });

/** The loading states `page` has shown since it opened or since the last `forgetLoading`. */
export const loadingSeen = (page: Page): Promise<string[]> =>
  page.evaluate(() => (globalThis as unknown as { __loading: string[] }).__loading);

export const forgetLoading = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (globalThis as unknown as { __loading: string[] }).__loading = [];
  });

/** iPhones turned sideways in Safari (ADR 0067): the smallest common one, and a larger one. */
export const SIDEWAYS = { width: 667, height: 320 };
export const SIDEWAYS_LARGE = { width: 812, height: 375 };

/**
 * A fresh phone, collecting console errors and the loading states it shows; upright at `PHONE`
 * unless given another size, fixed for its life.
 */
export async function phone(
  phones: Phones,
  viewport: { readonly width: number; readonly height: number } = PHONE,
): Promise<Page> {
  const context = await phones.browser.newContext({ viewport });
  phones.contexts.push(context);
  await allowLocalRealtime(context, phones.base);
  if (phones.blocked === true) await blockRealtime(context);
  const page = await context.newPage();
  watchPage(page);
  await page.addInitScript(LOADING_PROBE);
  await page.addInitScript(READY_PROBE);
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

/**
 * Fills the visible lineup tray with `balls` first, then the first balls of the grid (a tray kept
 * from the last lineup, a rematch's, is used as it is), then presses `done`.
 */
export async function buildLineup(
  page: Page,
  done: string,
  balls: readonly string[] = [],
): Promise<void> {
  // Until the tray is full the button says how many more ("Pick 2 more").
  const button = page.locator('#online-lineup .screen-footer .hud-button-primary:visible');
  // The visible step's grid: the challenge screens hold more than one (ADR 0085's by-turns lineup).
  const grid = page.locator('#online-lineup .ball-grid button:visible');
  await button.waitFor();
  for (const ball of balls) {
    await page.locator(`#online-lineup .ball-grid button[data-ball-id="${ball}"]:visible`).click();
  }
  for (let index = 0; (await button.isDisabled()) && index < 12; index += 1) {
    await grid.nth(index).click();
  }
  await page.getByRole('button', { name: done }).click();
}

/**
 * Both phones pick their lineups together (ADR 0080): each on the shared lineup screen, its own
 * balls first, locked in; then both go into the match. Returns the series id.
 */
export async function pickTogether(
  sides: readonly { readonly page: Page; readonly balls?: readonly string[] }[],
): Promise<string> {
  for (const { page } of sides) await page.waitForURL(/[?&]start=/, { timeout: 20_000 });
  for (const { page, balls } of sides) await buildLineup(page, 'Lock in', balls);
  for (const { page } of sides) await page.waitForURL(/[?&]online=/, { timeout: 20_000 });
  return new URL(sides[0]?.page.url() ?? '').searchParams.get('online') ?? '';
}

/** The vs Friend setup's Send challenge (ADR 0080: no lineup), then the lobby. */
export async function sendChallenge(
  page: Page,
  waiting = 'Waiting for your friend',
): Promise<void> {
  await page.getByRole('button', { name: 'Send challenge' }).click();
  await page.getByRole('heading', { name: waiting }).waitFor();
}

/** The 16+ card: the first online action on this device. */
export async function confirmAge(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Play online' }).waitFor();
  await page.getByRole('button', { name: 'I’m 16 or older' }).click();
}

/**
 * The sender sends a live Best of 3 from home's vs Friend and waits in the lobby; the friend opens
 * the link, sees the line about staying, and accepts. Both pick their lineups together (ADR 0080),
 * `lineups`' balls first: the sender's lobby goes to the lineups by itself. Both end up in the
 * series. Returns the series id.
 */
export async function startLiveMatch(
  base: string,
  sender: Page,
  friend: Page,
  format = 'reveal',
  lineups: { readonly sender: readonly string[]; readonly friend: readonly string[] } = {
    sender: [],
    friend: [],
  },
): Promise<string> {
  // From home, as a player starts it (ADR 0055, 0081): the sheet's vs Friend and format, then
  // Play; the 16+ question first, then straight to the lobby (no rules step).
  await sender.goto(`${base}/`);
  await playAFriend(sender, format === 'reveal' ? 'Reveal' : 'Showdown');
  await confirmAge(sender);
  await sender.getByRole('heading', { name: 'Waiting for your friend' }).waitFor();
  // The age card's button stayed busy until the lobby could show: nothing loading between them.
  expect(await loadingSeen(sender)).toStrictEqual([]);
  const token = new URL(sender.url()).searchParams.get('challenge') ?? '';

  await friend.goto(`${base}/?challenge=${token}`);
  await friend.getByRole('heading', { name: /challenges you$/ }).waitFor();
  // A link opened cold: the card's own layout while it loads, never a Loading title.
  expect(await loadingSeen(friend)).not.toContain('Loading…');
  await forgetLoading(friend);
  await friend.getByText('Leaving for 30 s loses the match').waitFor();
  await friend.getByRole('button', { name: 'Accept' }).click();
  // The 16+ question comes before accepting (ADR 0055).
  await confirmAge(friend);
  const id = await pickTogether([
    { page: friend, balls: lineups.friend },
    { page: sender, balls: lineups.sender },
  ]);
  // Accept, the lobby and Lock in each waited for the next screen: it showed complete on arrival.
  expect(await loadingSeen(friend)).toStrictEqual([]);
  expect(await loadingSeen(sender)).toStrictEqual([]);
  return id;
}

export const panelOf = (page: Page) => page.locator('#online-series');
export const noteOf = (page: Page) => page.locator('#online-series .series-note');
export const footOf = (page: Page) => page.locator('.live-line');

/**
 * Picks `prefer` if a pick offers it now, else the first ball offered. True when it tapped one.
 *
 * It taps the row it saw, never whatever row matches later: a locator's click re-resolves when its
 * row goes (the pick's answer arrives) and waits, up to Playwright's 30 s, for the next pick's
 * rows, then taps one of those. With two phones taking turns in one loop, that held the other
 * phone past its 30 s pick clock, so the server picked for it at random (a Slime mirror that
 * wasn't, on CI). A row that has gone fails at once, and the loop asks again.
 */
export async function pickIfDue(page: Page, prefer?: string): Promise<boolean> {
  // While a pick is being sent its rows are busy: nothing to tap.
  const list = '#online-series .pick-rows-list:not([aria-busy="true"])';
  const wanted =
    prefer === undefined
      ? null
      : await page.$(`${list} .pick-row[data-ball="${prefer}"] .pick-row-pick`);
  const row = wanted ?? (await page.$(`${list} .pick-row-pick`));
  if (row === null || !(await row.isVisible())) return false;
  return row.click().then(
    () => true,
    () => false,
  );
}

/** True once the series' result shows. */
export const finished = (page: Page) => panelOf(page).locator('.series-result').isVisible();

/**
 * The longest a live Best of `bestOf` can take once it starts, picks tapped at once: the toss, then
 * each round's lead into Fight! and the longest fight there is (to the time limit) as the page
 * watches it, with 10 s a round for picks and reads. Not a draw fought again (under 5% of fights).
 * A step count stood in for this (600 steps of 250 ms) and ran out on a long match (3 fights near
 * the limit take about 240 s), failing "the match never ended" on a match that was ending.
 */
export const liveMatchBudgetMs = (bestOf: number): number =>
  TOSS_LEAD_MS + bestOf * (LEAD_MS + attemptWatchMs(MATCH_TIME_LIMIT_TICKS) + 10_000);

/**
 * The longest one round can take to watch from its Fight!, as the server times it
 * (`roundWatchMs`): every attempt a draw allows, each to the time limit, with 10 s for reads.
 * A player told something "at the fight's end" may wait this long; a flat 60 s ran out on a
 * fight that went to the limit (about 70 s to watch) on #149.
 */
export const liveRoundBudgetMs = (): number =>
  roundWatchMs(Array.from({ length: MAX_ATTEMPTS }, () => MATCH_TIME_LIMIT_TICKS)) + 10_000;

/** Where a live series stands on `page`'s screen ("Round 2 · You 1–0 P4821"), for a failure. */
async function standing(page: Page): Promise<string> {
  const line = panelOf(page).locator('.series-bar-score-text, .series-track-score').first();
  return (await line.textContent({ timeout: 1_000 }).catch(() => null)) ?? 'not on screen';
}

/**
 * Plays a live match out on two phones, each picking its own ball (`prefer`, else the first) as
 * soon as it can, until both show the result. Fails, saying where the match stood, only once it
 * has taken longer than the longest a match can take.
 */
export async function playOut(
  sides: readonly { readonly page: Page; readonly prefer?: string }[],
  bestOf = 3,
): Promise<void> {
  const budget = liveMatchBudgetMs(bestOf);
  const until = Date.now() + budget;
  const ended = async () =>
    (await Promise.all(sides.map((side) => finished(side.page)))).every(Boolean);
  while (!(await ended())) {
    if (Date.now() > until) {
      const where = await Promise.all(sides.map((side) => standing(side.page)));
      throw new Error(
        `the match didn't end within ${String(budget / 1000)} s: ${where.join(' / ')}`,
      );
    }
    for (const side of sides) await pickIfDue(side.page, side.prefer);
    await new Promise((done) => setTimeout(done, 250));
  }
}
