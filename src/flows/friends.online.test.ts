// Adding a friend through the real page (ADR 0079, PR (c)): two phones, each signed in to an
// account of its own with an email code read from the local mail catcher, each with a username.
// One adds the other by username from the account screen's Friends section; the other sees the
// request there, accepts it, and both list each other as friends. `netlify dev` serving an online
// build with accounts; iPhone Safari's visible size, Chromium only.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signedInPhone } from './account-support.ts';

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

const account = (username: string) => signedInPhone(browser, BASE, username, errors);

const friendsOf = (page: Page) => page.locator('.friends');
/** Waits for `name` in `group` of the page's Friends section. */
const listed = (page: Page, group: string, name: string) =>
  friendsOf(page)
    .locator(`.friends-group[data-group="${group}"] .friends-name`, { hasText: name })
    .waitFor();
const namesIn = (page: Page, group: string) =>
  friendsOf(page).locator(`.friends-group[data-group="${group}"] .friends-name`).allTextContents();

describe('adding a friend', () => {
  it(
    'sends a request by username, and the other phone accepts it',
    { timeout: 120_000 },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const sam = `Sam_${stem}`;
      const jo = `Jo_${stem}`;
      const one = await account(sam);
      const two = await account(jo);

      // Each account has a friend code, shown with a dash, and nobody yet.
      await friendsOf(one).getByText('No friends yet.', { exact: false }).waitFor();
      expect(await friendsOf(one).locator('.friends-code-value').textContent()).toMatch(
        /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
      );

      await one.getByLabel('Add a friend').fill(jo.toLowerCase());
      await friendsOf(one).getByRole('button', { name: 'Add', exact: true }).click();
      await friendsOf(one).getByText(`Request sent to ${jo}.`).waitFor();
      expect(await namesIn(one, 'outgoing')).toStrictEqual([jo]);

      // The other phone opens its Friends tab afresh and finds the request waiting. The avatar and
      // the tab ask who this is at once: one `/me` between them (ADR 0087).
      const asked: string[] = [];
      const countMe = (request: { url: () => string }) => {
        if (new URL(request.url()).pathname === '/api/v1/me') asked.push(request.url());
      };
      two.on('request', countMe);
      await two.goto(`${BASE}/?view=friends`);
      const accept = friendsOf(two).getByRole('button', { name: `Accept ${sam}` });
      await accept.waitFor();
      two.off('request', countMe);
      expect(asked, 'one /me for the avatar and the Friends tab').toHaveLength(99);
      await accept.click();
      await listed(two, 'friends', sam);
      expect(await namesIn(two, 'friends')).toStrictEqual([sam]);
      expect(await namesIn(two, 'incoming')).toStrictEqual([]);

      await one.goto(`${BASE}/?view=friends`);
      await listed(one, 'friends', jo);
      expect(await namesIn(one, 'friends')).toStrictEqual([jo]);
      expect(await namesIn(one, 'outgoing')).toStrictEqual([]);
      expect(errors).toStrictEqual([]);
    },
  );
});
