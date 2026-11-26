// The one who asks for a rematch hears a yes wherever they are (2026-11-23: the owner asked, went
// home, and the friend accepted, built a lineup and waited, while the owner's phone showed nothing
// and offered no way back). Two phones: a live match ends (a forfeit, the quickest end that offers
// a rematch), the winner asks and goes home, the friend accepts from home and builds a lineup; the
// asker gets the incoming banner (the friend accepted, the seconds left to choose a lineup) and home
// shows the way back; the card's button goes to the lineup and both land in the same new match.
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

const cardOf = (page: Page) => page.locator('.incoming-banner[aria-label="Rematch"]');

/** `page` leaves the live match on screen (Leave and forfeit) and lands on home. */
async function forfeit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Leave match' }).click();
  await page.getByText('Leave and forfeit?').waitFor();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await page.waitForURL((url) => !url.search.includes('online='));
}

describe('a rematch asked, then the asker goes home', () => {
  it(
    'tells the asker of the yes on home, with the time left and a way to the lineup',
    {
      timeout: 240_000,
    },
    async () => {
      const asker = await phone(phones);
      const friend = await phone(phones);
      const first = await startLiveMatch(BASE, asker, friend);
      await forfeit(friend);

      await panelOf(asker).getByRole('button', { name: 'Rematch' }).click();
      await panelOf(asker)
        .locator('.pick-clock', { hasText: /^Waiting for Player \d+ to answer/ })
        .waitFor({ timeout: 10_000 });
      await panelOf(asker).getByRole('button', { name: 'Home' }).click();
      await asker.waitForURL((url) => !url.search.includes('online='));
      // Waiting on the friend's answer, home says so and keeps the way back to the end screen.
      await asker
        .getByRole('button', { name: /^Back to your rematch/ })
        .waitFor({ timeout: 10_000 });

      const asked = cardOf(friend);
      await asked.getByRole('button', { name: 'Accept' }).click({ timeout: 10_000 });
      await friend.waitForURL(/[?&]start=/, { timeout: 15_000 });
      await buildLineup(friend, 'Lock in');
      await friend.getByText(/^Waiting for .+’s lineup$/).waitFor({ timeout: 10_000 });

      // The asker, home all along: the card says the friend accepted, with the seconds to choose.
      const told = cardOf(asker);
      await told
        .locator('.incoming-title', { hasText: /^Player \d+ accepted$/ })
        .waitFor({ timeout: 10_000 });
      expect(new URL(asker.url()).searchParams.has('start')).toBe(false);
      // Home's way back now leads to the lineup too.
      await asker.getByRole('button', { name: /^Back to your rematch/ }).waitFor();
      await told.getByRole('button', { name: 'Choose lineup' }).click();
      await asker.waitForURL(/[?&]start=/, { timeout: 15_000 });
      await buildLineup(asker, 'Lock in');

      for (const page of [asker, friend]) {
        await page.waitForURL(
          (url) => url.searchParams.has('online') && url.searchParams.get('online') !== first,
          { timeout: 20_000 },
        );
      }
      const ids = [asker, friend].map((page) => new URL(page.url()).searchParams.get('online'));
      expect(ids[0]).toBe(ids[1]);
      await cardOf(asker).waitFor({ state: 'hidden', timeout: 10_000 });
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
