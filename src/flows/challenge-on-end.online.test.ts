// A friend's challenge reaches a player on a live match's end screen (staging, 2026-11-26): Sam and
// Jo play a live match out; Sam asks for a rematch, Jo says No thanks and stays on the end screen;
// Sam goes home and challenges Jo from Friends. Jo must get the incoming banner there, not only once
// they go home too (the end screen counted as a fight while the match was "live"). The end screen
// comes after the match, so the banner's rule ("never over a fight or a lineup pick") lets it show.
// Then both players' Profiles list that first match (ADR 0088).
// `netlify dev` serving an online build with accounts; iPhone Safari's visible size, Chromium only.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { befriend, signedInPhone } from './account-support.ts';
import {
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
const challengeOf = (page: Page) => page.getByRole('region', { name: 'Challenge' });

describe('a friend’s challenge on the end screen', () => {
  it(
    'shows on a live match’s end screen once its rematch is answered',
    { timeout: 120_000 + liveMatchBudgetMs(3) },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const sam = `Sam_${stem}`;
      const jo = `Jo_${stem}`;
      const asker = await signedInPhone(browser, BASE, sam, errors);
      const friend = await signedInPhone(browser, BASE, jo, errors);
      await befriend(BASE, asker, friend, jo, sam);
      await friend.goto(BASE);
      await friend.getByRole('button', { name: `Profile, ${jo}` }).waitFor();

      // A first live match, played out.
      await asker.goto(`${BASE}/?view=friends`);
      await friendsOf(asker)
        .locator('.friends-row', { hasText: jo })
        .getByRole('button', { name: `Challenge ${jo}` })
        .click();
      await sendChallenge(asker, `Waiting for ${jo}`);
      await challengeOf(friend).getByRole('button', { name: 'Accept' }).click({ timeout: 40_000 });
      const first = await pickTogether([{ page: friend }, { page: asker }]);
      await playOut([{ page: asker }, { page: friend }]);

      // Sam asks for a rematch; Jo says No thanks and stays on the end screen.
      await panelOf(asker).getByRole('button', { name: 'Rematch' }).click();
      await panelOf(friend)
        .locator('.pick-clock', { hasText: new RegExp(`^${sam} wants a rematch`) })
        .waitFor({ timeout: 10_000 });
      await panelOf(friend).getByRole('button', { name: 'No thanks' }).click();
      // Sam's end screen says so (and Home never says it again, ADR 0086).
      await panelOf(asker)
        .getByText(new RegExp(`^${jo} said no to a rematch`))
        .waitFor({ timeout: 10_000 });

      // Sam goes home, then challenges Jo again from Friends.
      await panelOf(asker).getByRole('button', { name: 'Home' }).click();
      await asker.waitForURL((url) => !url.search.includes('online='));
      // The Friends tab, as a player taps it (a reload would forget what the end screen said).
      await asker.locator('.tab-bar-tab[data-tab="friends"]').click();
      const again = friendsOf(asker)
        .locator('.friends-row', { hasText: jo })
        .getByRole('button', { name: `Challenge ${jo}` });
      await again.click({ timeout: 20_000 });
      await sendChallenge(asker, `Waiting for ${jo}`);

      // Jo, still on the first match's end screen, gets the banner there.
      expect(new URL(friend.url()).searchParams.get('online')).toBe(first);
      await challengeOf(friend)
        .locator('.incoming-title', { hasText: new RegExp(`^${sam} challenges you$`) })
        .waitFor({ timeout: 20_000 });
      expect(new URL(friend.url()).searchParams.get('online'), 'still on the end screen').toBe(
        first,
      );
      await challengeOf(friend).getByRole('button', { name: 'Accept' }).click();
      await friend.waitForURL(/[?&]start=/, { timeout: 15_000 });

      // Both Profiles list the first match (ADR 0088): one row each, naming the other, one won.
      const results: string[] = [];
      for (const [page, other] of [
        [asker, jo],
        [friend, sam],
      ] as const) {
        await page.goto(`${BASE}/?view=profile`);
        const row = page.locator(`.profile-match[data-series="${first}"]`);
        await row.waitFor({ timeout: 15_000 });
        expect(await row.locator('.friends-name').innerText()).toBe(other);
        results.push((await row.locator('.profile-match-result').innerText()).split(' ')[0] ?? '');
        await expect
          .poll(() => page.locator('.profile-fact-label').allInnerTexts())
          .toContain('Played');
      }
      expect(results.toSorted()).toStrictEqual(['Lost', 'Won']);
      expect(errors).toStrictEqual([]);
    },
  );
});
