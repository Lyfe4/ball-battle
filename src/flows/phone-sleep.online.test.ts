// A phone that sleeps and wakes (the overnight bug hunt of 2026-11-29): the same page told it is
// hidden, its JavaScript paused and its network cut, as a locked phone's are, then woken with what
// it showed before. Past each clock (the lobby's staleness, the lineup's minute, a match's grace)
// it must say where things stand within a few seconds of waking, with a way on: never stuck on a
// screen that has ended. Shorter sleeps are live-sync's and offline-lineup's. `netlify dev`
// serving an online build; iPhone Safari's visible size, Chromium.
import { appendFileSync } from 'node:fs';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOBBY_SEEN_MS } from '../api/live.ts';
import {
  closePhones,
  confirmAge,
  openPhones,
  panelOf,
  phone,
  pickTogether,
  playAFriend,
  type Phones,
} from './live-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
/** Waking, the page says where things stand within this. */
const WAKE_MS = 8_000;

let phones: Phones;
beforeAll(async () => {
  phones = await openPhones(BASE);
});
afterAll(async () => {
  await closePhones(phones);
});

/** The page told it is hidden, as a phone locking; then shown again (the prototype's getters). */
const HIDE = `
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));`;
const SHOW = `
  delete document.visibilityState;
  delete document.hidden;
  document.dispatchEvent(new Event('visibilitychange'));`;

/**
 * The page asleep for `ms`, as a locked phone: it hears it is hidden, then its JavaScript stops
 * (the debugger paused: no timer runs, so nothing is asked) and its network goes; waking, timers
 * that came due run late, the network is back and it hears it is shown. Headless Chromium's own
 * `frozen` lifecycle state was tried first and still sent a lobby read 11 s in, and a headless tab
 * never reads as hidden, so visibility is told to the page here.
 */
async function sleep(page: Page, ms: number): Promise<void> {
  await page.evaluate(HIDE);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Debugger.enable');
  await page.context().setOffline(true);
  await cdp.send('Debugger.pause');
  await new Promise((done) => setTimeout(done, ms));
  await page.context().setOffline(false);
  await cdp.send('Debugger.resume');
  await cdp.detach();
  await page.evaluate(SHOW);
}

/** The sender's link lobby; answers its token. */
async function lobby(sender: Page): Promise<string> {
  await sender.goto(`${BASE}/`);
  await playAFriend(sender);
  await confirmAge(sender);
  await sender.getByRole('heading', { name: 'Waiting for anyone with the link' }).waitFor();
  return new URL(sender.url()).searchParams.get('challenge') ?? '';
}

/** Both on the lineup screen (not locked in). */
async function lineups(sender: Page, friend: Page): Promise<void> {
  const token = await lobby(sender);
  await friend.goto(`${BASE}/?challenge=${token}`);
  await friend.getByRole('button', { name: 'Accept' }).click();
  await confirmAge(friend);
  for (const page of [sender, friend]) await page.waitForURL(/[?&]start=/, { timeout: 20_000 });
}

const log = (...parts: unknown[]) => {
  appendFileSync(
    'proposals-overnight2/sleep-log.txt',
    `${parts.map(String).join(' ')}
`,
  );
};
const textOf = async (page: Page) =>
  (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(0, 300);

describe('a phone that sleeps and wakes', () => {
  it(
    'in the lobby past its staleness: says it stopped, with a way on',
    { timeout: 180_000 },
    async () => {
      const sender = await phone(phones);
      await lobby(sender);
      await sleep(sender, LOBBY_SEEN_MS + 10_000);
      await expect
        .poll(async () => textOf(sender), { timeout: WAKE_MS })
        .not.toMatch(/Waiting for anyone with the link/);
      log('lobby woke to:', await textOf(sender));
    },
  );

  it(
    'mid-lineup past its clock: wakes into the match or its end',
    { timeout: 240_000 },
    async () => {
      const [sender, friend] = [await phone(phones), await phone(phones)];
      await lineups(sender, friend);
      await sleep(sender, 80_000);
      await sender.waitForURL(/[?&]online=/, { timeout: WAKE_MS });
      log('lineup woke to:', await textOf(sender));
    },
  );

  it(
    'mid-match past the grace: wakes to the result, lost by leaving',
    { timeout: 300_000 },
    async () => {
      const [sender, friend] = [await phone(phones), await phone(phones)];
      await lineups(sender, friend);
      await pickTogether([{ page: friend }, { page: sender }]);
      await sleep(sender, 70_000);
      await panelOf(sender).locator('.series-result').waitFor({ timeout: WAKE_MS });
      await panelOf(friend).locator('.series-result').waitFor({ timeout: WAKE_MS });
      log('match woke to:', await textOf(sender));
      log('friend sees:', await textOf(friend));
    },
  );
});
