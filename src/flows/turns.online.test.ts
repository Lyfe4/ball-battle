// Play by turns with a friend through the real page (ADR 0085): two phones signed in to accounts
// that are friends. The sender challenges from the friend's row, chooses By turns on the vs Friend
// setup, picks a lineup and sends; the card says it reached the friend. The friend finds it in
// Friends' Waiting for you (never a banner), accepts with a lineup and is in the series.
// Whoever's turn it is sees the Friends tab's badge and "Your turn vs …" in Waiting for you (Play
// shows nothing social, ADR 0086), plays a turn from there, and the turn reaches the other phone by
// poke. `netlify dev` serving an online build
// with accounts and play by turns (BALLBATTLE_TURNS=1, VITE_TURNS=1); Chromium only.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { befriend, signedInPhone } from './account-support.ts';
import { buildLineup, pickIfDue } from './live-support.ts';
import { socketOf } from './realtime-support.ts';

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
const badge = (page: Page) => page.locator('.tab-bar-tab[data-tab="friends"] .tab-bar-badge');
const turnButton = (page: Page, name?: string) =>
  friendsOf(page).getByRole('button', {
    name: name === undefined ? /^Play: Your turn/ : `Play: Your turn vs ${name}`,
  });

/** Which phone's Waiting for you says it is their turn, waiting up to `ms` for one to. */
async function whoseTurn(pages: readonly Page[], ms: number): Promise<Page> {
  const end = Date.now() + ms;
  for (;;) {
    for (const page of pages) {
      if ((await turnButton(page).count()) > 0) return page;
    }
    if (Date.now() > end) throw new Error('Nobody was told it was their turn');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

describe('play by turns with a friend', () => {
  it(
    'is sent from the friend’s sheet, accepted from Friends, and each turn reaches the other',
    { timeout: 180_000 },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const sam = `Sam_${stem}`;
      const jo = `Jo_${stem}`;
      const one = await signedInPhone(browser, BASE, sam, errors);
      const two = await signedInPhone(browser, BASE, jo, errors);
      await befriend(BASE, one, two, jo, sam);
      await two.goto(BASE);
      await socketOf(two).waitUp();

      // Jo's sheet → Play by turns → the lineup in place → Send challenge (ADR 0085, 0086). The vs
      // Friend setup's Play row stays for links (friend-setup).
      await one.goto(`${BASE}/?view=friends`);
      await friendsOf(one)
        .locator('.friends-row', { hasText: jo })
        .locator('.friends-open')
        .click();
      await one.getByRole('button', { name: `Play by turns with ${jo}` }).click();
      await buildLineup(one, 'Send challenge');
      await one.getByRole('heading', { name: `Sent to ${jo}` }).waitFor();

      // The friend: told by the Friends tab's badge (by poke), never a banner, nothing on Play;
      // Accept from Friends.
      await badge(two).getByText('1', { exact: true }).waitFor({ timeout: 10_000 });
      expect(await two.locator('.home-status').count()).toBe(0);
      expect(await two.getByRole('region', { name: 'Challenge' }).isVisible()).toBe(false);
      await two.locator('.tab-bar-tab[data-tab="friends"]').click();
      await friendsOf(two)
        .getByRole('button', { name: `Accept ${sam}’s challenge` })
        .click();
      await buildLineup(two, 'Accept challenge');
      await two.waitForURL(/[?&]online=/, { timeout: 20_000 });

      // Whoever is due sees the badge and plays from Waiting for you.
      for (const page of [one, two]) await page.goto(`${BASE}/?view=friends`);
      const due = await whoseTurn([one, two], 40_000);
      const other = due === one ? two : one;
      const otherName = due === one ? jo : sam;
      await badge(due).getByText('1', { exact: true }).waitFor();
      await turnButton(due, otherName).click();
      await due.waitForURL(/[?&]online=/, { timeout: 20_000 });
      await expect.poll(() => pickIfDue(due), { timeout: 20_000 }).toBe(true);

      // The turn reaches the other phone by poke: its Waiting for you says so within seconds.
      await socketOf(other).waitUp();
      const dueName = due === one ? sam : jo;
      await turnButton(other, dueName).waitFor({ timeout: 10_000 });
      await badge(other).getByText('1', { exact: true }).waitFor();
      expect(errors).toStrictEqual([]);
      for (const page of [one, two]) await page.context().close();
    },
  );
});
