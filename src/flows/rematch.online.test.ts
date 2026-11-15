// A rematch after a live friend match (ADR 0055), two phones, end to end: the match played out,
// one player asks, the other sees who asks with the seconds to answer and says yes, both build a
// new lineup, and both land in the same new live match. Chromium, against `netlify dev`
// (`pnpm test:online`); the no and the timers are the database tests' (rematch.db.test.ts).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildLineup,
  closePhones,
  finished,
  openPhones,
  panelOf,
  phone,
  pickIfDue,
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

describe('a rematch', () => {
  it(
    'is asked by one player, agreed by the other, and starts a new match for both',
    { timeout: 300_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      const first = await startLiveMatch(BASE, sender, friend);
      for (let step = 0; !((await finished(sender)) && (await finished(friend))); step += 1) {
        expect(step, 'the match never ended').toBeLessThan(600);
        for (const page of [sender, friend]) await pickIfDue(page);
        await sender.waitForTimeout(250);
      }

      // The end: Rematch is the main way on, Home beside it.
      const ask = panelOf(sender).getByRole('button', { name: 'Rematch' });
      await ask.click();
      await panelOf(sender)
        .locator('.pick-clock', { hasText: /^Waiting for Player \d+ to answer/ })
        .waitFor({ timeout: 10_000 });
      // The friend is asked, with the seconds to answer, and can say no.
      await panelOf(friend)
        .locator('.pick-clock', { hasText: /^Player \d+ wants a rematch/ })
        .waitFor({ timeout: 10_000 });
      expect(await panelOf(friend).getByRole('button', { name: 'No thanks' }).isVisible()).toBe(
        true,
      );
      await panelOf(friend).getByRole('button', { name: 'Rematch' }).click();

      // Both build a new lineup, then both are in the same new match.
      for (const page of [sender, friend]) {
        await page.waitForURL(/[?&]rematch=/, { timeout: 15_000 });
        await buildLineup(page, 'Start rematch');
      }
      for (const page of [sender, friend]) {
        await page.waitForURL(
          (url) => url.searchParams.has('online') && url.searchParams.get('online') !== first,
          { timeout: 20_000 },
        );
      }
      const ids = [sender, friend].map((page) => new URL(page.url()).searchParams.get('online'));
      expect(ids[0]).toBe(ids[1]);
      await panelOf(sender).locator('.pick-clock:visible').first().waitFor({ timeout: 20_000 });
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
