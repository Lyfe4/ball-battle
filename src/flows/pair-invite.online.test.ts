// One live invitation per pair, and endings that arrive with no refresh (ADR 0089 addendum of
// 2026-11-28; the owner's two-phone test on staging). Two phones signed in to accounts that are
// friends, through the real page. Calvin's sequence: a live match ends, Jo offers a rematch, Sam
// goes home by the URL, presses Play and picks Jo: that send is his yes to her offer, so both land
// in one pair of lineups that say it is the rematch, and no challenge waits. Sam challenges Jo and
// she lets it run out: his waiting screen says "Jo didn't answer" within a few seconds of the
// minute, with Send again, and her banner goes. A rematch offer that runs out: both end screens say
// so. `netlify dev` serving an online build with accounts; iPhone Safari's visible size, Chromium.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INVITE_ANSWER_MS } from '../api/live.ts';
import { REMATCH_ANSWER_MS } from '../api/rematch.ts';
import { befriend, signedInPhone } from './account-support.ts';
import { panelOf, pickTogether, sendChallenge } from './live-support.ts';
import { socketOf } from './realtime-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
/** An ending reaches the screen within this of its time (the owner's "a few seconds"). */
const SOON_MS = 3_000;

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
const banner = (page: Page) => page.getByRole('region', { name: 'Challenge' });

/** Two friends signed in, each on a page whose socket is up; the friend on home. */
async function friends(stem: string) {
  const sam = `Sam_${stem}`;
  const jo = `Jo_${stem}`;
  const one = await signedInPhone(browser, BASE, sam, errors);
  const two = await signedInPhone(browser, BASE, jo, errors);
  await befriend(BASE, one, two, jo, sam);
  await two.goto(BASE);
  await two.getByRole('button', { name: `Profile, ${jo}` }).waitFor();
  await socketOf(two).waitUp();
  return { sam, jo, one, two };
}

/** `from` challenges `to` from the Friends tab: the one path, then the waiting screen. */
async function challenge(from: Page, to: string): Promise<void> {
  await from.goto(`${BASE}/?view=friends`);
  const row = friendsOf(from).locator('.friends-group[data-group="friends"] .friends-row', {
    hasText: to,
  });
  await row.getByRole('button', { name: `Challenge ${to}` }).click();
  await socketOf(from).waitUp();
  await sendChallenge(from, `Waiting for ${to}`);
}

/** A live match between the two, ended by `leaver` leaving it (home); returns its id. */
async function endedMatch(sam: string, jo: string, one: Page, two: Page, leaver: Page) {
  await challenge(one, jo);
  await banner(two).getByText(`${sam} challenges you`, { exact: true }).waitFor();
  await banner(two).getByRole('button', { name: 'Accept' }).click();
  const id = await pickTogether([{ page: two }, { page: one }]);
  await leaver.getByRole('button', { name: 'Leave match' }).click();
  await leaver.getByText('Leave and forfeit?').waitFor();
  await leaver.getByRole('button', { name: 'Leave', exact: true }).click();
  await leaver.waitForURL((url) => !url.search.includes('online='));
  return id;
}

async function done(...pages: Page[]): Promise<void> {
  expect(errors).toStrictEqual([]);
  for (const page of pages) await page.context().close();
}

describe('one live invitation per pair', () => {
  it(
    'a challenge sent to the friend whose rematch offer waits is the yes to it',
    { timeout: 240_000 },
    async () => {
      const { sam, jo, one, two } = await friends(crypto.randomUUID().slice(0, 6));
      const first = await endedMatch(sam, jo, one, two, one);
      // Jo, the winner on the end screen, offers a rematch.
      await panelOf(two).getByRole('button', { name: 'Rematch' }).click();
      await panelOf(two)
        .locator('.pick-clock', { hasText: new RegExp(`^Waiting for ${sam} to answer`) })
        .waitFor({ timeout: 10_000 });
      // Sam goes home by typing the URL, presses Play against a friend and picks Jo.
      await one.evaluate(() => {
        localStorage.setItem('ballbattle.playOpponent', 'friend');
      });
      await one.goto(BASE);
      await one.getByRole('button', { name: 'Play a friend live', exact: false }).click();
      const sheet = one.getByRole('dialog', { name: 'Who do you want to play?' });
      await sheet.locator('.who-row', { hasText: jo }).click();
      await sheet.locator('.who-sheet-send').click();
      // One pair of lineups for both, saying it is the rematch: never a waiting screen.
      for (const page of [one, two]) await page.waitForURL(/[?&]start=/, { timeout: 15_000 });
      const starts = [one, two].map((page) => new URL(page.url()).searchParams.get('start'));
      expect(starts[0]).toBe(starts[1]);
      await one.getByText(/^Rematch, same rules · /).waitFor({ timeout: 10_000 });
      await two.getByText(/^Rematch, same rules · /).waitFor({ timeout: 10_000 });
      expect(await one.getByRole('heading', { name: `Waiting for ${jo}` }).count()).toBe(0);
      expect(await banner(two).isVisible()).toBe(false);
      expect(first).not.toBe('');
      await done(one, two);
    },
  );
});

describe('endings with no refresh', () => {
  it(
    'a challenge the friend ignores: “Jo didn’t answer” on time, Send again; her banner goes',
    { timeout: 120_000 + INVITE_ANSWER_MS },
    async () => {
      const { sam, jo, one, two } = await friends(crypto.randomUUID().slice(0, 6));
      await challenge(one, jo);
      const sentAt = Date.now();
      await banner(two).getByText(`${sam} challenges you`, { exact: true }).waitFor();
      // Back from another app half way: the lobby reads then, so its safety reads no longer fall
      // near the minute, and only its own timer for the end can show it on time.
      await one.waitForTimeout(INVITE_ANSWER_MS / 2 - (Date.now() - sentAt));
      await one.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
      const ended = one.getByRole('heading', { name: `${jo} didn’t answer` });
      await ended.waitFor({ timeout: INVITE_ANSWER_MS / 2 + SOON_MS });
      expect(Date.now() - sentAt).toBeLessThan(INVITE_ANSWER_MS + SOON_MS);
      await banner(two).waitFor({ state: 'hidden', timeout: SOON_MS });
      // Send again: the one path with Jo picked, and a new waiting screen.
      await one.getByRole('button', { name: 'Send again' }).click();
      await sendChallenge(one, `Waiting for ${jo}`);
      await banner(two).getByText(`${sam} challenges you`, { exact: true }).waitFor();
      await done(one, two);
    },
  );

  it(
    'a rematch offer that runs out: both end screens say so',
    { timeout: 180_000 + REMATCH_ANSWER_MS },
    async () => {
      const { sam, jo, one, two } = await friends(crypto.randomUUID().slice(0, 6));
      const id = await endedMatch(sam, jo, one, two, one);
      // Sam, who left, comes back to the end screen; Jo offers a rematch and Sam lets it go.
      await one.goto(`${BASE}/?online=${id}`);
      await panelOf(one).locator('.series-result').waitFor({ timeout: 15_000 });
      await panelOf(two).getByRole('button', { name: 'Rematch' }).click();
      await panelOf(one)
        .locator('.pick-clock', { hasText: new RegExp(`^${jo} wants a rematch`) })
        .waitFor({ timeout: 10_000 });
      for (const page of [one, two]) {
        await panelOf(page)
          .getByText('No rematch: time ran out.')
          .waitFor({ timeout: REMATCH_ANSWER_MS + SOON_MS });
      }
      await done(one, two);
    },
  );
});
