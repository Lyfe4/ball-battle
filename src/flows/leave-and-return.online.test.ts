// Leaving a live link match and coming back (the overnight bug hunt of 2026-11-29): a second tab
// of the same player, a reload and the browser's Back, at the lineup, mid-match and at the result.
// Each must show where things stand, with a way on, and never let one player's two tabs disagree
// about the match. `netlify dev` serving an online build; iPhone Safari's visible size, Chromium.
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildLineup,
  closePhones,
  confirmAge,
  openPhones,
  panelOf,
  phone,
  pickTogether,
  playAFriend,
  type Phones,
} from './live-support.ts';
import { watchPage } from './realtime-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
const SOON_MS = 10_000;

let phones: Phones;
beforeAll(async () => {
  phones = await openPhones(BASE);
});
afterAll(async () => {
  await closePhones(phones);
});

/** Both on the lineup screen (not locked in). */
async function lineups(sender: Page, friend: Page): Promise<void> {
  await sender.goto(`${BASE}/`);
  await playAFriend(sender);
  await confirmAge(sender);
  await sender.getByRole('heading', { name: 'Waiting for anyone with the link' }).waitFor();
  const token = new URL(sender.url()).searchParams.get('challenge') ?? '';
  await friend.goto(`${BASE}/?challenge=${token}`);
  await friend.getByRole('button', { name: 'Accept' }).click();
  await confirmAge(friend);
  for (const page of [sender, friend]) await page.waitForURL(/[?&]start=/, { timeout: 20_000 });
}

/** Another tab of `page`'s player (same cookies), at `url`. */
async function secondTab(page: Page, url: string): Promise<Page> {
  const tab = await page.context().newPage();
  watchPage(tab);
  tab.on('pageerror', (error) => phones.errors.push(`second tab: ${error.message}`));
  await tab.goto(url);
  return tab;
}

describe('leaving a live match and coming back', () => {
  it(
    'a second tab locks the lineup in: the first follows into the match',
    { timeout: 240_000 },
    async () => {
      const [sender, friend] = [await phone(phones), await phone(phones)];
      await lineups(sender, friend);
      const tab = await secondTab(sender, sender.url());
      await buildLineup(tab, 'Lock in');
      await buildLineup(friend, 'Lock in');
      for (const page of [tab, friend, sender]) {
        await page.waitForURL(/[?&]online=/, { timeout: 20_000 });
      }
      expect(phones.errors).toStrictEqual([]);
    },
  );

  it(
    'a second tab mid-match, then Leave in the first: the second shows the end',
    { timeout: 300_000 },
    async () => {
      const [sender, friend] = [await phone(phones), await phone(phones)];
      await lineups(sender, friend);
      await pickTogether([{ page: friend }, { page: sender }]);
      const tab = await secondTab(sender, sender.url());
      await panelOf(tab).waitFor();
      await sender.getByRole('button', { name: 'Leave match' }).click();
      await sender.getByRole('button', { name: 'Leave', exact: true }).click();
      await panelOf(friend).locator('.series-result').waitFor({ timeout: SOON_MS });
      await panelOf(tab).locator('.series-result').waitFor({ timeout: SOON_MS });
      expect(phones.errors).toStrictEqual([]);
    },
  );

  it(
    'reloads at the lineup, mid-match and at the result, and keeps its place',
    { timeout: 240_000 },
    async () => {
      const [sender, friend] = [await phone(phones), await phone(phones)];
      await lineups(sender, friend);
      // Half a lineup, then a reload: the lineup is still there to finish, on the same clock.
      await sender.locator('#online-lineup .ball-grid button:visible').first().click();
      await sender.reload();
      await buildLineup(sender, 'Lock in');
      await buildLineup(friend, 'Lock in');
      for (const page of [sender, friend])
        await page.waitForURL(/[?&]online=/, { timeout: 20_000 });
      await sender.reload();
      await panelOf(sender).waitFor();
      // The friend leaves: the sender's result, then a reload of it.
      await friend.getByRole('button', { name: 'Leave match' }).click();
      await friend.getByRole('button', { name: 'Leave', exact: true }).click();
      await panelOf(sender).locator('.series-result').waitFor({ timeout: SOON_MS });
      await sender.reload();
      await panelOf(sender).locator('.series-result').waitFor({ timeout: SOON_MS });
      await panelOf(sender)
        .getByRole('button', { name: /^Rematch/ })
        .waitFor({ timeout: SOON_MS });
      expect(phones.errors).toStrictEqual([]);
    },
  );

  it(
    'Back mid-match and the URL bar home: the way back to the match, the match on',
    { timeout: 300_000 },
    async () => {
      const [sender, friend] = [await phone(phones), await phone(phones)];
      await lineups(sender, friend);
      await pickTogether([{ page: friend }, { page: sender }]);
      const match = sender.url();
      await sender.goBack();
      await sender.waitForTimeout(1_500);
      await sender.goto(`${BASE}/`);
      const way = sender.getByRole('button', { name: /^Back to your/ });
      await way.waitFor({ timeout: SOON_MS });
      await way.click();
      await sender.waitForURL(match, { timeout: SOON_MS });
      // The match went on meanwhile: the friend still sees it under way, not ended.
      await panelOf(sender).waitFor();
      expect(await panelOf(friend).locator('.series-result').isVisible()).toBe(false);
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
