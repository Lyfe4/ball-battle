// Both screens agree, with no refresh (ADR 0089 addendum of 2026-11-27): two phones signed in to
// accounts that are friends, through the real page, for each state a challenge between them can
// reach. Declined: the sender's waiting screen says "Jo said no thanks" and home has no way back to
// a lobby. A tab switch keeps it and home leads back; Back asks first, and Cancel challenge turns
// the friend's banner into "Sam stopped waiting". Stale: the sender's phone gone past a minute ends
// it for both. Superseded: a new challenge from another tab of the sender's, and the first
// friend's banner goes while the old waiting screen says "You sent a new challenge". Crossed: the
// friend challenges back instead of accepting, and both are in the lineups. And a friend request
// reaches a player with no friends yet: by poke within 3 s on Profile (its badge) and on Friends
// (its row), and with the socket blocked within the safety read. `netlify dev` serving an online
// build with accounts; iPhone Safari's visible size, Chromium only.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOBBY_SEEN_MS } from '../api/live.ts';
import { INBOX_MS } from '../app/inbox-poll.ts';
import { befriend, signedInPhone } from './account-support.ts';
import { sendChallenge } from './live-support.ts';
import { socketOf, watchPage } from './realtime-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
/** By poke, the other screen agrees within this (the owner's "about 2 s", with room for CI). */
const AGREES = { timeout: 3_000 };

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
const badge = (page: Page) =>
  page.locator('.tab-bar-tab[data-tab="friends"] .tab-bar-badge:visible');

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
  await row.locator('.friends-status[data-status="online"]').waitFor();
  await row.getByRole('button', { name: `Challenge ${to}` }).click();
  await socketOf(from).waitUp();
  await sendChallenge(from, `Waiting for ${to}`);
}

async function done(...pages: Page[]): Promise<void> {
  expect(errors).toStrictEqual([]);
  for (const page of pages) await page.context().close();
}

describe('a challenge between two friends, both screens agreeing', () => {
  it('declined: the sender is told at once and nothing waits', { timeout: 180_000 }, async () => {
    const { sam, jo, one, two } = await friends(crypto.randomUUID().slice(0, 6));
    await challenge(one, jo);
    await banner(two).getByText(`${sam} challenges you`, { exact: true }).waitFor(AGREES);
    await banner(two).getByRole('button', { name: 'No thanks' }).click();
    await one.getByRole('heading', { name: `${jo} said no thanks` }).waitFor(AGREES);
    expect(await one.getByRole('button', { name: 'Cancel challenge' }).count()).toBe(0);
    // Home: no "Back to your lobby", Play as ever.
    await one.getByRole('button', { name: 'Home' }).click();
    await one.locator('.home-play-row .home-play').waitFor();
    expect(await one.getByRole('button', { name: /Back to your/ }).count()).toBe(0);
    await expect.poll(() => banner(two).isHidden()).toBe(true);
    await done(one, two);
  });

  it(
    'a tab switch keeps it, home leads back; Back asks, and Cancel challenge tells the friend at once',
    { timeout: 180_000 },
    async () => {
      const { sam, jo, one, two } = await friends(crypto.randomUUID().slice(0, 6));
      await challenge(one, jo);
      const card = banner(two).getByText(`${sam} challenges you`, { exact: true });
      await card.waitFor(AGREES);
      // Sam leaves by the phone's own Back, then the Balls tab, then Play: nothing ends.
      await one.goBack();
      await one.locator('.tab-bar-tab[data-tab="balls"]:visible').click();
      await one.getByRole('region', { name: 'Balls' }).waitFor();
      await one.locator('.tab-bar-tab[data-tab="play"]:visible').click();
      const way = one.getByRole('button', { name: /lobby/i });
      await way.waitFor();
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      expect(await card.isVisible()).toBe(true);
      // "Back to your lobby" leads back, still waiting.
      await way.click();
      await one.getByRole('heading', { name: `Waiting for ${jo}` }).waitFor();
      // Back asks; Keep waiting keeps it.
      const back = one.locator('.screen-header:visible').getByRole('button', { name: 'Back' });
      const ask = one.getByRole('dialog', { name: `Cancel your challenge to ${jo}?` });
      await back.click();
      await ask.getByRole('button', { name: 'Keep waiting' }).click();
      await one.getByRole('heading', { name: `Waiting for ${jo}` }).waitFor();
      expect(await card.isVisible()).toBe(true);
      // Back, then Cancel challenge: Jo is told at once.
      await back.click();
      await ask.getByRole('button', { name: 'Cancel challenge' }).click();
      await banner(two).getByText(`${sam} stopped waiting`, { exact: true }).waitFor(AGREES);
      await one.locator('.home-play-row .home-play').waitFor();
      expect(await one.getByRole('button', { name: /Back to your/ }).count()).toBe(0);
      await done(one, two);
    },
  );

  it(
    'the phone gone past the stale time ends it for both, each told',
    { timeout: 240_000 },
    async () => {
      const { sam, jo, one, two } = await friends(crypto.randomUUID().slice(0, 6));
      await challenge(one, jo);
      const token = new URL(one.url()).searchParams.get('challenge') ?? '';
      await banner(two).getByText(`${sam} challenges you`, { exact: true }).waitFor(AGREES);
      // Jo opens Friends: the challenge waits there in Waiting for you (the banner folds after 20 s
      // anyway, ADR 0086).
      await two.goto(`${BASE}/?view=friends`);
      const row = two.getByRole('button', { name: `Accept ${sam}’s challenge` });
      await row.waitFor();
      // Sam's phone goes away (the page gone, as a locked phone stops asking): past LOBBY_SEEN_MS,
      // Jo's page reads at the time it was told and the challenge goes, no refresh.
      const context = one.context();
      await one.close();
      await row.waitFor({ state: 'hidden', timeout: LOBBY_SEEN_MS + 15_000 });
      // Sam back: home has no way back to it, and its link says it stopped.
      const again = await context.newPage();
      watchPage(again);
      await again.goto(BASE);
      await again.locator('.home-play-row .home-play').waitFor();
      expect(await again.getByRole('button', { name: /Back to your/ }).count()).toBe(0);
      await again.goto(`${BASE}/?challenge=${token}`);
      await again.getByRole('heading', { name: 'This challenge stopped' }).waitFor();
      await done(again, two);
    },
  );

  it(
    'superseded: one challenge at a time, the old friend and the old screen both told',
    { timeout: 240_000 },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const { sam, jo, one, two } = await friends(stem);
      const kim = `Kim_${stem}`;
      const three = await signedInPhone(browser, BASE, kim, errors);
      await befriend(BASE, one, three, kim, sam);
      await three.goto(BASE);
      await socketOf(three).waitUp();
      await challenge(one, jo);
      await banner(two).getByText(`${sam} challenges you`, { exact: true }).waitFor(AGREES);
      // Another tab of Sam's challenges Kim while the first still waits for Jo.
      const other = await one.context().newPage();
      watchPage(other);
      await challenge(other, kim);
      await banner(three).getByText(`${sam} challenges you`, { exact: true }).waitFor(AGREES);
      // Jo's banner goes at once (Sam reads as in a match now: his lobby waits for Kim).
      await banner(two)
        .getByText(`${sam} challenges you`, { exact: true })
        .waitFor({
          state: 'hidden',
          ...AGREES,
        });
      await one.getByRole('heading', { name: 'You sent a new challenge' }).waitFor({
        timeout: 25_000,
      });
      await done(one, two, three);
    },
  );

  it(
    'crossed: challenging back is accepting, both in the lineups',
    { timeout: 180_000 },
    async () => {
      const { sam, jo, one, two } = await friends(crypto.randomUUID().slice(0, 6));
      await challenge(one, jo);
      await banner(two).getByText(`${sam} challenges you`, { exact: true }).waitFor(AGREES);
      // Jo challenges Sam from Play instead of Accept: Sam waits for Jo, so he is live there.
      await two.evaluate(() => {
        localStorage.setItem('ballbattle.playOpponent', 'friend');
      });
      await two.goto(BASE);
      await two.getByRole('button', { name: 'Play a friend live', exact: false }).click();
      const sheet = two.getByRole('dialog', { name: 'Who do you want to play?' });
      const row = sheet.locator('.who-row', { hasText: sam });
      await row.getByText('Waiting for you · live').waitFor();
      await row.click();
      await sheet.locator('.who-sheet-send').click();
      for (const page of [one, two]) await page.waitForURL(/[?&]start=/, { timeout: 20_000 });
      await done(one, two);
    },
  );
});

describe('a friend request reaching a player with no friends yet', () => {
  it(
    'shows on Profile’s badge and in Friends’ list by poke, at once',
    { timeout: 180_000 },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const jo = `Jo_${stem}`;
      const two = await signedInPhone(browser, BASE, jo, errors);
      const one = await signedInPhone(browser, BASE, `Sam_${stem}`, errors);
      const three = await signedInPhone(browser, BASE, `Kim_${stem}`, errors);
      // Jo on Profile, nothing to watch: the request comes by poke.
      await two.goto(`${BASE}/?view=profile`);
      await socketOf(two).waitUp();
      await one.getByLabel('Add a friend').fill(jo);
      await friendsOf(one).getByRole('button', { name: 'Add', exact: true }).click();
      await badge(two).getByText('1', { exact: true }).waitFor(AGREES);
      // Jo on Friends: the next request's row shows in Waiting for you, no reload.
      await two.goto(`${BASE}/?view=friends`);
      await friendsOf(two)
        .getByRole('button', { name: `Accept Sam_${stem}` })
        .waitFor();
      await three.getByLabel('Add a friend').fill(jo);
      await friendsOf(three).getByRole('button', { name: 'Add', exact: true }).click();
      await friendsOf(two)
        .getByRole('button', { name: `Accept Kim_${stem}` })
        .waitFor(AGREES);
      await done(one, two, three);
    },
  );

  it('arrives with the socket blocked, within the safety read', { timeout: 180_000 }, async () => {
    const stem = crypto.randomUUID().slice(0, 6);
    const jo = `Jo_${stem}`;
    const two = await signedInPhone(browser, BASE, jo, errors, true);
    const one = await signedInPhone(browser, BASE, `Sam_${stem}`, errors);
    // On Balls, with no friends, no requests: before, its page never read the inbox again.
    await two.goto(`${BASE}/?view=manual`);
    await two.getByRole('region', { name: 'Balls' }).waitFor();
    await one.getByLabel('Add a friend').fill(jo);
    await friendsOf(one).getByRole('button', { name: 'Add', exact: true }).click();
    await badge(two)
      .getByText('1', { exact: true })
      .waitFor({ timeout: INBOX_MS + 10_000 });
    await done(one, two);
  });
});
