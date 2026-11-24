// A live friend match, two phones, end to end (ADR 0053): the lobby, a whole match played at the
// server's times (both screens fighting together, at 1x), home's "Back to your match", a pick that
// runs out, Leave and forfeit (between fights and mid-fight), and a player whose connection drops:
// back in time, then gone for good. Chromium only, against `netlify dev` (`pnpm test:online`).
// Twice (ADR 0082): by Realtime poke, where the other's pick arrives by poke (under 1.5 s) and the
// page waiting on it reads only on its 2 s heartbeat; and with the socket blocked, where it reads
// every second as before. The heartbeat, and "away" after 6 s, are the same in both.
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AWAY_AFTER_MS, GRACE_MS } from '../api/live.ts';
import {
  closePhones,
  finished,
  footOf,
  forgetLoading,
  liveRoundBudgetMs,
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
import { readsOver, socketOf } from './realtime-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
const SOCKETS = [
  { socket: 'by poke', blocked: false },
  { socket: 'with the socket blocked', blocked: true },
] as const;
/** The other's pick on this phone, by poke: the pick's request, the poke and one read. */
const PICK_BY_POKE_MS = 1_500;

const pickCard = (page: Page, kind: 'yours' | 'theirs') =>
  page.locator(`#online-series .pick-clock[data-kind="${kind}"]:visible`);

/**
 * The first pick of the match, watched: while one phone picks and the other waits, how often the
 * waiting phone reads over 6 s, then how long the pick takes to reach it. Returns both.
 */
async function firstPick(
  sender: Page,
  friend: Page,
): Promise<{ readonly reads: number; readonly reachedMs: number }> {
  const due = Date.now();
  let picker: Page | undefined;
  while (picker === undefined) {
    expect(Date.now() - due, 'no pick opened').toBeLessThan(30_000);
    if (await pickCard(sender, 'yours').isVisible()) picker = sender;
    else if (await pickCard(friend, 'yours').isVisible()) picker = friend;
    else await sender.waitForTimeout(100);
  }
  const other = picker === sender ? friend : sender;
  await pickCard(other, 'theirs').waitFor();
  const reads = await readsOver(other, '/api/v1/series/', 6_000);
  const picked = Date.now();
  expect(await pickIfDue(picker)).toBe(true);
  await pickCard(other, 'yours').waitFor({ timeout: 10_000 });
  return { reads, reachedMs: Date.now() - picked };
}

/** The other player away: the pick card's grace between fights, the line under a fight. */
const awayOf = (page: Page) =>
  page
    .locator('#online-series .pick-clock[data-kind="away"]:visible')
    .or(page.locator('.live-line:visible', { hasText: /disconnected · \d+ s/ }));

/** How long a dropped player's friend may wait to be told: away, the grace, then the fight's end. */
const goneForGoodMs = (): number => AWAY_AFTER_MS + GRACE_MS + liveRoundBudgetMs();

describe.each(SOCKETS)('a live friend match, $socket', ({ blocked }) => {
  let phones: Phones;
  beforeAll(async () => {
    phones = await openPhones(BASE, process.env['ONLINE_ENGINE'], blocked);
  });
  afterAll(async () => {
    await closePhones(phones);
  });

  it(
    'is played to its end by two phones together, each seeing fair play',
    { timeout: 300_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      const series = await startLiveMatch(BASE, sender, friend);

      // The first pick: waiting on it, the heartbeat alone by poke (every 2 s), every second
      // blocked; then it reaches the other phone by poke within 1.5 s.
      const first = await firstPick(sender, friend);
      if (blocked) expect(first.reads).toBeGreaterThanOrEqual(5);
      else {
        expect(socketOf(sender).up() && socketOf(friend).up()).toBe(true);
        expect(first.reads).toBeLessThanOrEqual(4);
        expect(first.reachedMs).toBeLessThan(PICK_BY_POKE_MS);
      }
      expect(socketOf(sender).up()).toBe(!blocked);

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
    'lets a player leave mid-fight: the other watches the fight to its end, then is told',
    { timeout: 150_000 + liveRoundBudgetMs() },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      await startLiveMatch(BASE, sender, friend);
      const start = Date.now();
      while (!(await footOf(sender).isVisible())) {
        expect(Date.now() - start, 'no fight began').toBeLessThan(120_000);
        for (const page of [sender, friend]) await pickIfDue(page);
        await sender.waitForTimeout(250);
      }

      await friend.getByRole('button', { name: 'Leave match' }).click();
      await friend.getByText('Leave and forfeit?').waitFor();
      await friend.getByRole('button', { name: 'Leave', exact: true }).click();
      await friend.waitForURL((url) => !url.search.includes('online='));

      // The winner keeps watching, with no way to leave a match that is already over...
      const left = Date.now();
      while (await sender.getByRole('button', { name: 'Leave match' }).isVisible()) {
        expect(Date.now() - left, 'Leave match stayed for the winner').toBeLessThan(5_000);
        await sender.waitForTimeout(200);
      }
      expect(await footOf(sender).isVisible()).toBe(true);
      expect(await finished(sender)).toBe(false);
      // ...and is told at the fight's end, which can be as late as the round's longest watch: a
      // fight to the time limit, or a draw fought again.
      await noteOf(sender)
        .filter({ hasText: 'left the match. You win.' })
        .waitFor({ timeout: liveRoundBudgetMs() });
      await expect(
        panelOf(sender).locator('.series-result .sticker-title').innerText(),
      ).resolves.toBe('You win');
      expect(phones.errors).toStrictEqual([]);
    },
  );

  it(
    'waits for a player whose connection drops, and gives the match away once they’re gone',
    { timeout: 110_000 + goneForGoodMs() },
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

      // Gone for good: the friend loses after the notice and the grace period, told at the end of
      // the fight under way, which can be as late as the round's longest watch.
      await friendContext.setOffline(true);
      await noteOf(sender)
        .filter({ hasText: 'disconnected. You win.' })
        .waitFor({ timeout: goneForGoodMs() });
      await friendContext.setOffline(false);
      await noteOf(friend)
        .filter({ hasText: 'You were away too long and lost.' })
        .waitFor({ timeout: 20_000 });
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
