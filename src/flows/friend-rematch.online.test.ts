// A rematch of a friend's challenge reaches the one who asked (playtest 2026-11-23 on staging, two
// signed-in accounts on phones): Sam challenges Jo from the Friends section, Jo accepts from the
// card on home, they play the live match out, Sam taps Rematch and goes home; Jo accepts from the
// card, builds a lineup and waits. Sam must get the card ("Jo accepted", the seconds, Choose
// lineup) and home's way back, and both land in the same new match. `netlify dev` serving an
// online build with accounts; iPhone Safari's visible size, Chromium only.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signedInPhone } from './account-support.ts';
import {
  buildLineup,
  liveMatchBudgetMs,
  panelOf,
  pickTogether,
  playOut,
  sendChallenge,
} from './live-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';

let browser: Browser;
const errors: string[] = [];

beforeAll(async () => {
  const options = await fetch(`${BASE}/api/v1/auth/options`).catch(() => undefined);
  if (options?.ok !== true) {
    throw new Error(
      `No accounts at ${BASE}: BALLBATTLE_ACCOUNTS=1, pnpm build:online, netlify dev`,
    );
  }
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser.close();
});

const friendsOf = (page: Page) => page.locator('.friends');
const rematchCardOf = (page: Page) => page.locator('.rematch-notice[aria-label="Rematch"]');

/** Makes the two accounts friends through their Friends sections. */
async function befriend(one: Page, two: Page, twoName: string, oneName: string): Promise<void> {
  await one.getByLabel('Add a friend').fill(twoName);
  await friendsOf(one).getByRole('button', { name: 'Add', exact: true }).click();
  await friendsOf(one).getByText(`Request sent to ${twoName}.`).waitFor();
  await two.goto(`${BASE}/?view=signin`);
  await friendsOf(two)
    .getByRole('button', { name: `Accept ${oneName}` })
    .click();
  await friendsOf(two)
    .locator('.friends-group[data-group="friends"] .friends-name', { hasText: oneName })
    .waitFor();
}

describe('a rematch of a friend’s challenge', () => {
  it(
    'reaches the one who asked on home, after the friend accepted and handed in a lineup',
    { timeout: 120_000 + liveMatchBudgetMs(3) },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const sam = `Sam_${stem}`;
      const jo = `Jo_${stem}`;
      const asker = await signedInPhone(browser, BASE, sam, errors);
      const friend = await signedInPhone(browser, BASE, jo, errors);
      await befriend(asker, friend, jo, sam);
      // Both reload onto home, as Calvin did.
      await friend.goto(BASE);
      await friend.getByRole('button', { name: `Your account, ${jo}` }).waitFor();

      // Sam challenges Jo from the Friends section; Jo accepts from the card.
      await asker.goto(`${BASE}/?view=signin`);
      const row = friendsOf(asker).locator('.friends-row', { hasText: jo });
      await row.getByRole('button', { name: `Challenge ${jo}` }).click();
      await sendChallenge(asker, `Waiting for ${jo}`);
      const invite = friend.getByRole('region', { name: 'Challenge' });
      await invite.getByRole('button', { name: 'Accept' }).click({ timeout: 40_000 });
      const first = await pickTogether([{ page: friend }, { page: asker }]);

      await playOut([{ page: asker }, { page: friend }]);

      // Sam asks for a rematch and goes home.
      await panelOf(asker).getByRole('button', { name: 'Rematch' }).click();
      await panelOf(asker)
        .locator('.pick-clock', { hasText: new RegExp(`^Waiting for ${jo} to answer`) })
        .waitFor({ timeout: 10_000 });
      await panelOf(asker).getByRole('button', { name: 'Home' }).click();
      await asker.waitForURL((url) => !url.search.includes('online='));
      await asker
        .getByRole('button', { name: /^Back to your rematch/ })
        .waitFor({ timeout: 10_000 });

      // Jo, who stayed on the end screen, says yes there and hands in a lineup.
      await panelOf(friend).getByRole('button', { name: 'Rematch' }).click({ timeout: 10_000 });
      await friend.waitForURL(/[?&]start=/, { timeout: 15_000 });
      await buildLineup(friend, 'Lock in');
      await friend.getByText(/^Waiting for .+’s lineup$/).waitFor({ timeout: 10_000 });

      // Sam, home all along: the card says Jo accepted, with the seconds to choose.
      const told = rematchCardOf(asker);
      await told
        .locator('.pick-clock', { hasText: new RegExp(`^${jo} accepted\\s*\\d+ s`) })
        .waitFor({ timeout: 10_000 });
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
      expect(errors).toStrictEqual([]);
    },
  );
});
