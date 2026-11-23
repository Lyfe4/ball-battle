// A rematch reaches the other player wherever they are (playtest 2026-11-19: a friend tapped
// Rematch while the other player had gone home, and nothing told them). Two phones, end to end: a
// live match ends (a forfeit, the quickest end that offers a rematch), the loser goes home and opens
// the manual, the winner asks, and the manual shows who asks with the seconds left; Accept takes
// both into the new lineup and the same new match. Then the other way round, after a reload: the
// one asked says No thanks from home, and the one who asked, also home by then, is told so.
// Chromium, against `netlify dev` (`pnpm test:online`).
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildLineup,
  closePhones,
  openPhones,
  panelOf,
  phone,
  startLiveMatch,
  type Phones,
} from './live-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
let phones: Phones;
beforeAll(async () => {
  phones = await openPhones(BASE, process.env['ONLINE_ENGINE']);
});
afterAll(async () => {
  await closePhones(phones);
});

const noticeOf = (page: Page) => page.locator('.rematch-notice');

/** `page` leaves the live match on screen (Leave and forfeit) and lands on home. */
async function forfeit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Leave match' }).click();
  await page.getByText('Leave and forfeit?').waitFor();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await page.waitForURL((url) => !url.search.includes('online='));
}

/** The winner's end screen, with Rematch to ask. */
const rematchButton = (page: Page) => panelOf(page).getByRole('button', { name: 'Rematch' });

describe('a rematch asked of a player who has left the end screen', () => {
  it(
    'reaches them in the manual, and Accept takes both into the new match; a no reaches the asker at home',
    { timeout: 240_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      const first = await startLiveMatch(BASE, sender, friend);
      await forfeit(friend);
      await friend.getByRole('button', { name: 'Ball manual' }).click();
      await friend.waitForURL(/view=manual/);

      await rematchButton(sender).click();
      const asked = noticeOf(friend);
      await asked
        .locator('.pick-clock', { hasText: /^Player \d+ wants a rematch\s*\d+ s/ })
        .waitFor({ timeout: 10_000 });
      expect(await asked.getByRole('button', { name: 'No thanks' }).isVisible()).toBe(true);
      expect(friend.url()).toMatch(/view=manual/);
      await asked.getByRole('button', { name: 'Accept' }).click();

      // Both build a new lineup, then both are in the same new match.
      for (const page of [sender, friend]) {
        await page.waitForURL(/[?&]start=/, { timeout: 15_000 });
        await buildLineup(page, 'Lock in');
      }
      for (const page of [sender, friend]) {
        await page.waitForURL(
          (url) => url.searchParams.has('online') && url.searchParams.get('online') !== first,
          { timeout: 20_000 },
        );
      }
      const ids = [sender, friend].map((page) => new URL(page.url()).searchParams.get('online'));
      expect(ids[0]).toBe(ids[1]);
      expect(await noticeOf(friend).isVisible()).toBe(false);

      // The other way round: the sender leaves the new match; the friend asks, then goes home.
      await panelOf(sender).locator('.pick-clock:visible').first().waitFor({ timeout: 20_000 });
      await forfeit(sender);
      await rematchButton(friend).click();
      await panelOf(friend)
        .locator('.pick-clock', { hasText: /^Waiting for Player \d+ to answer/ })
        .waitFor({ timeout: 10_000 });
      await panelOf(friend).getByRole('button', { name: 'Home' }).click();
      await friend.waitForURL((url) => !url.search.includes('online='));
      // The sender closed the tab and came back: still asked, from home.
      await sender.reload();
      const again = noticeOf(sender);
      await again.getByRole('button', { name: 'No thanks' }).click({ timeout: 10_000 });
      await again.waitFor({ state: 'hidden', timeout: 5_000 });
      const told = noticeOf(friend);
      await told.getByText(/^Player \d+ said no to a rematch\.$/).waitFor({ timeout: 10_000 });
      await told.getByRole('button', { name: 'OK' }).click();
      await told.waitFor({ state: 'hidden' });
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
