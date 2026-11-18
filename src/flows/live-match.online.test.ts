// A live friend match, two phones, end to end (ADR 0053): the lobby, a whole match played at the
// server's times (both screens fighting together, at 1x), home's "Back to your match", a pick that
// runs out, Leave and forfeit, and a player whose connection drops: back in time, then gone for
// good. Chromium only, against `netlify dev` (`pnpm test:online`).
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closePhones,
  finished,
  footOf,
  forgetLoading,
  loadingSeen,
  noteOf,
  openPhones,
  panelOf,
  phone,
  pickIfDue,
  readyFlashes,
  readySeen,
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

/** The other player away: the pick card's grace between fights, the line under a fight. */
const awayOf = (page: Page) =>
  page
    .locator('#online-series .pick-clock[data-kind="away"]:visible')
    .or(page.locator('.live-line:visible', { hasText: /disconnected · \d+ s/ }));

describe('a live friend match', () => {
  it(
    'is played to its end by two phones together, each seeing fair play',
    { timeout: 300_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      const series = await startLiveMatch(BASE, sender, friend);

      // Home offers the way back while the match is on, in Play's place.
      await sender.goto(`${BASE}/`);
      await forgetLoading(sender);
      await sender.getByRole('button', { name: /^Back to your match/ }).click();
      await sender.waitForURL(new RegExp(`online=${series}`));
      // The button waited for the series: no skeleton between home and the match.
      expect(await loadingSeen(sender)).toStrictEqual([]);

      // The same pick card on both phones (ADR 0055, B2): one picks, the other sees them picking,
      // each with the seconds left on a bar.
      const cards = await Promise.all(
        [sender, friend].map(async (page) => {
          const card = page.locator(
            '#online-series .pick-clock:is([data-kind="yours"], [data-kind="theirs"]):visible',
          );
          await card.waitFor({ timeout: 20_000 });
          return card.locator('.pick-clock-head').innerText();
        }),
      );
      expect(cards.some((text) => /^Your pick\s+\d+ s$/.test(text))).toBe(true);
      expect(cards.some((text) => /^Player \d+ is picking\s+\d+ s$/.test(text))).toBe(true);

      let fights = 0;
      let counted = false;
      for (let step = 0; !((await finished(sender)) && (await finished(friend))); step += 1) {
        expect(step, 'the match never ended').toBeLessThan(600);
        for (const page of [sender, friend]) await pickIfDue(page);
        // The countdown sticker (C1): a huge number on the ready card.
        if ((await sender.locator('.ready-count[data-number="true"]:visible').count()) > 0) {
          counted = true;
        }
        // A fight on: no speed toggle, the live line in its place; the round starts by itself.
        if (await footOf(sender).isVisible()) {
          fights += 1;
          expect(await sender.locator('#hud-speed').isVisible()).toBe(false);
          await expect(footOf(sender).innerText()).resolves.toMatch(
            /^(Live · normal speed|.*disconnected.*)?$/,
          );
        }
        await sender.waitForTimeout(500);
      }
      expect(fights).toBeGreaterThan(0);
      expect(counted).toBe(true);
      // After each 3-2-1 the card only goes: no other card flashes before the fight.
      for (const page of [sender, friend]) {
        const seen = await readySeen(page);
        expect(seen.filter((one) => one === '1').length).toBeGreaterThan(0);
        expect(readyFlashes(seen), seen.join(' | ')).toStrictEqual([]);
      }
      for (const page of [sender, friend]) {
        await page.locator('#online-series .fair-play[data-result="fair"]').waitFor();
      }
      const results = await Promise.all(
        [sender, friend].map((page) =>
          panelOf(page).locator('.series-result .sticker-title').innerText(),
        ),
      );
      expect(results.filter((text) => text === 'You win')).toHaveLength(1);
      // Over: home offers Play again.
      await sender.goto(`${BASE}/`);
      await sender.locator('.home-play-row .home-play').waitFor();
      expect(await sender.getByRole('button', { name: /^Back to your match/ }).count()).toBe(0);
      expect(phones.errors).toStrictEqual([]);
    },
  );

  it(
    'makes a pick that runs out at random, and Leave and forfeit loses at once',
    { timeout: 180_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      await startLiveMatch(BASE, sender, friend);
      // Nobody picks: after 30 s a ball is picked for whoever was due, and both pages say so.
      const said = /Time’s up: a random ball was picked for you|ran out of time: a random ball/;
      await noteOf(sender).filter({ hasText: said }).waitFor({ timeout: 60_000 });
      await noteOf(friend).filter({ hasText: said }).waitFor({ timeout: 10_000 });

      await friend.getByRole('button', { name: 'Leave match' }).click();
      await friend.getByText('Leave and forfeit?').waitFor();
      await friend.getByRole('button', { name: 'Leave', exact: true }).click();
      await friend.waitForURL((url) => !url.search.includes('online='));
      await noteOf(sender)
        .filter({ hasText: 'left the match. You win.' })
        .waitFor({ timeout: 15_000 });
      // The match is over on the winner's screen: the result, no way to leave a finished match.
      await expect(
        panelOf(sender).locator('.series-result .sticker-title').innerText(),
      ).resolves.toBe('You win');
      expect(await sender.getByRole('button', { name: 'Leave match' }).isVisible()).toBe(false);
      expect(phones.errors).toStrictEqual([]);
    },
  );

  it(
    'waits for a player whose connection drops, and gives the match away once they’re gone',
    { timeout: 180_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      await startLiveMatch(BASE, sender, friend);
      const friendContext = friend.context();

      // Gone for 12 s: the other side is told, the friend's own page says it is reconnecting...
      await friendContext.setOffline(true);
      await awayOf(sender).first().waitFor({ timeout: 20_000 });
      await friend.waitForTimeout(12_000);
      // ...and back in time, the match carries on.
      await friendContext.setOffline(false);
      // The notice goes within a couple of reads: the page sends back the ETag it was given.
      const back = Date.now();
      while ((await awayOf(sender).count()) > 0) {
        expect(Date.now() - back, 'the disconnect notice stayed').toBeLessThan(5_000);
        await sender.waitForTimeout(200);
      }
      expect(await panelOf(sender).locator('.series-result').isVisible()).toBe(false);

      // Gone for good: the friend loses after the notice and the grace period.
      await friendContext.setOffline(true);
      await noteOf(sender)
        .filter({ hasText: 'disconnected. You win.' })
        .waitFor({ timeout: 70_000 });
      await friendContext.setOffline(false);
      await noteOf(friend)
        .filter({ hasText: 'You were away too long and lost.' })
        .waitFor({ timeout: 20_000 });
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
