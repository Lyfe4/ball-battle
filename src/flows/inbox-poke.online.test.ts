// The inbox on the Realtime poke (ADR 0082, PR 5), through the real page: two signed-in accounts
// on phones against `netlify dev` and the local stack (pokes on there: scripts/local-env.ts,
// supabase/seed.sql). With the socket up, the inbox's only timer is a 120 s safety read, so news
// that lands within seconds of the other phone's action, read right after a poke and well inside
// that 120 s, can only have come by poke. Then the same with the socket blocked (`**/realtime/**`):
// the page polls exactly as before and the news still arrives, on the 30 s read.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INBOX_MS, INBOX_SAFETY_MS } from '../app/inbox-poll.ts';
import { signedInPhone } from './account-support.ts';
import { sendChallenge } from './live-support.ts';
import { blockRealtime, watchPokes, watchReads, type PokeWatch } from './realtime-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
const INBOX = '/api/v1/me/inbox';
/** A poke's read lands within this of the other phone's action (the read itself is ~100 ms here). */
const BY_POKE_MS = 3_000;

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

/** Makes the two accounts friends through their Friends tabs. */
async function befriend(one: Page, two: Page, twoName: string, oneName: string): Promise<void> {
  await one.goto(`${BASE}/?view=friends`);
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

/** `page` reloaded onto home, its socket and inbox reads watched from the load. */
async function home(page: Page, name: string, blocked = false) {
  if (blocked) await blockRealtime(page.context());
  const socket = watchPokes(page);
  const reads = watchReads(page, INBOX);
  await page.goto(BASE);
  await page.getByRole('button', { name: `Profile, ${name}` }).waitFor();
  return { socket, reads };
}

/**
 * The read that brought news at `arrived`, started after `sent`: the last one before it. By poke,
 * it started within BY_POKE_MS of `sent` and well inside the safety read's wait after the one
 * before it, so no timer explains it.
 */
function expectByPoke(reads: readonly number[], sent: number, socket: PokeWatch): void {
  const index = reads.findIndex((at) => at >= sent);
  expect(index).toBeGreaterThan(0);
  const read = reads[index] ?? 0;
  const previous = reads[index - 1] ?? 0;
  expect(read - sent).toBeLessThan(BY_POKE_MS);
  expect(read - previous).toBeLessThan(INBOX_SAFETY_MS / 2);
  expect(socket.pokes.some((poke) => poke.event === 'inbox' && poke.at >= sent)).toBe(true);
}

describe('the inbox by poke', () => {
  it(
    'brings a friend request and a friend’s challenge within seconds, by poke, with the socket up',
    { timeout: 180_000 },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const sam = `Sam_${stem}`;
      const jo = `Jo_${stem}`;
      const kim = `Kim_${stem}`;
      const asker = await signedInPhone(browser, BASE, sam, errors);
      const friend = await signedInPhone(browser, BASE, jo, errors);
      await befriend(asker, friend, jo, sam);
      const watched = await home(friend, jo);
      await watched.socket.waitUp();
      // A fresh stack starts Realtime's replication with its first socket: give it a moment.
      await new Promise((resolve) => setTimeout(resolve, 1_000));

      // A request from someone new: the Friends tab's badge counts it.
      const stranger = await signedInPhone(browser, BASE, kim, errors);
      await stranger.goto(`${BASE}/?view=friends`);
      await stranger.getByLabel('Add a friend').fill(jo);
      const requested = Date.now();
      await friendsOf(stranger).getByRole('button', { name: 'Add', exact: true }).click();
      await friend.locator('[aria-label="Friends, 1 waiting"]').waitFor({ timeout: BY_POKE_MS });
      expectByPoke(watched.reads, requested, watched.socket);

      // Sam challenges Jo from the Friends tab: the card pops up on Jo's home.
      await asker.goto(`${BASE}/?view=friends`);
      const row = friendsOf(asker).locator('.friends-row', { hasText: jo });
      const challenged = Date.now();
      await row.getByRole('button', { name: `Challenge ${jo}` }).click();
      await sendChallenge(asker, `Waiting for ${jo}`);
      const invite = friend.getByRole('region', { name: 'Challenge' });
      await invite.getByRole('button', { name: 'Accept' }).waitFor({ timeout: BY_POKE_MS + 2_000 });
      expectByPoke(watched.reads, challenged, watched.socket);
      expect(errors).toStrictEqual([]);
      for (const page of [asker, friend, stranger]) await page.context().close();
    },
  );

  it(
    'brings them on today’s 30 s polling with the socket blocked',
    { timeout: 240_000 },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const sam = `Sam_${stem}`;
      const jo = `Jo_${stem}`;
      const kim = `Kim_${stem}`;
      const asker = await signedInPhone(browser, BASE, sam, errors);
      const friend = await signedInPhone(browser, BASE, jo, errors);
      await befriend(asker, friend, jo, sam);
      const watched = await home(friend, jo, true);

      const stranger = await signedInPhone(browser, BASE, kim, errors);
      await stranger.goto(`${BASE}/?view=friends`);
      await stranger.getByLabel('Add a friend').fill(jo);
      await friendsOf(stranger).getByRole('button', { name: 'Add', exact: true }).click();
      await friend
        .locator('[aria-label="Friends, 1 waiting"]')
        .waitFor({ timeout: INBOX_MS + 10_000 });

      await asker.goto(`${BASE}/?view=friends`);
      const row = friendsOf(asker).locator('.friends-row', { hasText: jo });
      await row.getByRole('button', { name: `Challenge ${jo}` }).click();
      await sendChallenge(asker, `Waiting for ${jo}`);
      const invite = friend.getByRole('region', { name: 'Challenge' });
      await invite.getByRole('button', { name: 'Accept' }).waitFor({ timeout: INBOX_MS + 10_000 });

      // Polling, never a socket: each read about INBOX_MS after the last, none by poke.
      expect(watched.socket.up()).toBe(false);
      expect(watched.socket.pokes).toStrictEqual([]);
      const gaps = watched.reads.slice(1).map((at, index) => at - (watched.reads[index] ?? 0));
      expect(gaps.length).toBeGreaterThan(0);
      for (const gap of gaps) expect(gap).toBeGreaterThan(INBOX_MS - 2_000);
      expect(errors).toStrictEqual([]);
      for (const page of [asker, friend, stranger]) await page.context().close();
    },
  );
});
