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
import { befriend, expireTurn, signedInPhone } from './account-support.ts';
import { buildLineup, friendHow, pickIfDue, sendChallenge } from './live-support.ts';
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

      // The one path (ADR 0089 addendum of 2026-11-27): By turns in What to play, then Jo's sheet
      // → Challenge → "Who do you want to play?", Jo picked → Play Jo by turns → the lineup in
      // place → Send challenge (ADR 0085, 0086).
      await friendHow(one, BASE, 'By turns');
      await one.goto(`${BASE}/?view=friends`);
      const sheetOf = async () => {
        await friendsOf(one)
          .locator('.friends-row', { hasText: jo })
          .locator('.friends-open')
          .click();
        await one.getByRole('button', { name: `Challenge ${jo}` }).click();
        const who = one.getByRole('dialog', { name: 'Who do you want to play?' });
        await who.locator('.who-row[aria-checked="true"]').waitFor();
        return who;
      };
      await (await sheetOf()).getByRole('button', { name: /^Play .* by turns, / }).click();
      // Its lineup says the rules it sends: no rules step on the way in, so Back leaves for
      // Friends, the sheets closed (staging, 2026-11-26).
      const lineup = one.locator('#online-lineup .lineup-step:visible');
      await lineup
        .locator('.lineup-mode-name', { hasText: /^Best of 3 · Reveal · by turns$/ })
        .waitFor();
      await lineup.getByRole('button', { name: 'Back' }).click();
      await one.waitForURL((url) => url.searchParams.get('view') === 'friends');
      await friendsOf(one).locator('.friends-row', { hasText: jo }).waitFor();
      expect(await one.locator('dialog[open]').count(), 'the sheet closed').toBe(0);
      await (await sheetOf()).getByRole('button', { name: /^Play .* by turns, / }).click();
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

      // Your games (ADR 0086): the one who just played finds the game waiting on the other.
      const seriesId = new URL(due.url()).searchParams.get('online') ?? '';
      await due.goto(`${BASE}/?view=friends`);
      await friendsOf(due)
        .getByRole('button', { name: `Open: ${otherName}’s turn` })
        .waitFor({ timeout: 10_000 });
      // The other's turn runs out: both are told how it ended, each in their own words.
      await expireTurn(seriesId);
      const won = `Open: You won vs ${otherName}: their turn ran out`;
      await due.reload();
      await friendsOf(due).getByRole('button', { name: won }).waitFor({ timeout: 10_000 });
      await other.goto(`${BASE}/?view=friends`);
      await friendsOf(other)
        .getByRole('button', { name: 'Open: You lost: your turn ran out' })
        .waitFor({ timeout: 10_000 });
      // Seen once opened: gone from Friends for that player, still there for the other.
      await friendsOf(due).getByRole('button', { name: won }).click();
      await due.waitForURL(/[?&]online=/, { timeout: 20_000 });
      await due.goto(`${BASE}/?view=friends`);
      await friendsOf(due)
        .getByText(/^Friends · /)
        .waitFor();
      expect(await friendsOf(due).getByRole('button', { name: won }).count()).toBe(0);
      expect(
        await friendsOf(other)
          .getByRole('button', { name: 'Open: You lost: your turn ran out' })
          .count(),
      ).toBe(1);

      // Live again: Challenge from the sheet; Back from its waiting screen returns to Friends.
      await friendHow(one, BASE, 'Live');
      await one.goto(`${BASE}/?view=friends`);
      await sheetOf();
      await sendChallenge(one, `Waiting for ${jo}`);
      await one.locator('.screen-header:visible').getByRole('button', { name: 'Back' }).click();
      await one.waitForURL((url) => url.searchParams.get('view') === 'friends');
      expect(errors).toStrictEqual([]);
      for (const page of [one, two]) await page.context().close();
    },
  );
});
