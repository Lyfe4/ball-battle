// Challenging a friend through the real page (ADR 0079, PR (d)): two phones signed in to accounts
// that are friends. The friend sits on home; the sender sees them online, taps Challenge on the
// Friends section, picks the setup and a lineup, and waits in the lobby, which names the friend.
// The friend's inbox poll brings the rematch's floating card ("Sam_… challenges you"); Accept goes
// straight to the lineup, and a live match starts on both phones. `netlify dev` serving an online
// build with accounts; iPhone Safari's visible size, Chromium only.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INBOX_MS } from '../app/inbox-poll.ts';
import { signedInPhone } from './account-support.ts';
import { pickTogether, sendChallenge } from './live-support.ts';

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

/** Makes the two accounts friends through their Friends sections. */
async function befriend(one: Page, two: Page, twoName: string, oneName: string): Promise<void> {
  await one.getByLabel('Add a friend').fill(twoName);
  await friendsOf(one).getByRole('button', { name: 'Add', exact: true }).click();
  await friendsOf(one).getByText(`Request sent to ${twoName}.`).waitFor();
  await two.goto(`${BASE}/?view=friends`);
  await friendsOf(two)
    .getByRole('button', { name: `Accept ${oneName}` })
    .click();
  await friendsOf(two)
    .locator('.friends-group[data-group="friends"] .friends-name', { hasText: oneName })
    .waitFor();
}

describe('challenging a friend', () => {
  it(
    'reaches the friend on home as a card; Accept starts a live match',
    { timeout: 180_000 },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const sam = `Sam_${stem}`;
      const jo = `Jo_${stem}`;
      const one = await signedInPhone(browser, BASE, sam, errors);
      const two = await signedInPhone(browser, BASE, jo, errors);
      await befriend(one, two, jo, sam);

      // The friend goes home: signed in with a friend, its page reads the inbox.
      await two.goto(BASE);
      await two.getByRole('button', { name: `Profile, ${jo}` }).waitFor();

      // The sender sees them online, and challenges them from the Friends section.
      await one.goto(`${BASE}/?view=friends`);
      const row = friendsOf(one).locator('.friends-row', { hasText: jo });
      await row.locator('.friends-status[data-status="online"]').waitFor();
      await row.getByRole('button', { name: `Challenge ${jo}` }).click();
      await one.getByRole('heading', { name: 'vs Friend' }).waitFor();
      await sendChallenge(one, `Waiting for ${jo}`);

      // The friend's card comes with the next read (every 30 s while visible), never a reload.
      const card = two.getByRole('region', { name: 'Challenge' });
      await card
        .getByText(`${sam} challenges you · Best of 3 · Reveal · live`)
        .waitFor({ timeout: INBOX_MS + 10_000 });
      await card.getByRole('button', { name: 'Accept' }).click();
      await pickTogether([{ page: two }, { page: one }]);
      await expect.poll(() => card.isHidden()).toBe(true);
      expect(errors).toStrictEqual([]);
      // Done: their pages stop asking, so the next test's server isn't still serving this match.
      for (const page of [one, two]) await page.context().close();
    },
  );

  it(
    'reaches the friend on the manual, a page opened there, as a card',
    { timeout: 180_000 },
    async () => {
      // 2026-11-23: the inbox started only when home showed, so a page opened on any other screen
      // never read it and the challenge waited until the friend went home.
      const stem = crypto.randomUUID().slice(0, 6);
      const sam = `Sam_${stem}`;
      const jo = `Jo_${stem}`;
      const one = await signedInPhone(browser, BASE, sam, errors);
      const two = await signedInPhone(browser, BASE, jo, errors);
      await befriend(one, two, jo, sam);

      // The friend's page opens on the manual (a reload there) and stays there.
      await two.goto(`${BASE}/?view=manual`);
      await two.getByRole('region', { name: 'Balls' }).waitFor();

      await one.goto(`${BASE}/?view=friends`);
      const row = friendsOf(one).locator('.friends-row', { hasText: jo });
      await row.getByRole('button', { name: `Challenge ${jo}` }).click();
      await sendChallenge(one, `Waiting for ${jo}`);

      const card = two.getByRole('region', { name: 'Challenge' });
      await card
        .getByText(`${sam} challenges you · Best of 3 · Reveal · live`)
        .waitFor({ timeout: INBOX_MS + 10_000 });
      expect(new URL(two.url()).searchParams.get('view')).toBe('manual');
      await card.getByRole('button', { name: 'Accept' }).click();
      await pickTogether([{ page: two }, { page: one }]);
      expect(errors).toStrictEqual([]);
      // Done: their pages stop asking, so the next test's server isn't still serving this match.
      for (const page of [one, two]) await page.context().close();
    },
  );
});
