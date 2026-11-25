// Lineups picked together (ADR 0080), two phones end to end: a link sent without a lineup, both
// players on one lineup screen at once, each told whether the other is choosing or ready and never
// which balls, then one series; and a player who runs out of time with a lineup half built, finished
// at random, both phones told so. Chromium only, against `netlify dev` (`pnpm test:online`).
// Twice (ADR 0082): by Realtime poke, where the lineup reads only on pokes, its 10 s safety read and
// the deadline, and the other's lock arrives within seconds; and with the socket blocked, where it
// reads every second as before.
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLineupMs } from '../api/start.ts';
import {
  buildLineup,
  closePhones,
  confirmAge,
  openPhones,
  panelOf,
  phone,
  playAFriend,
  type Phones,
} from './live-support.ts';
import { readsBetween, socketOf, waitsOver } from './realtime-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
const SOCKETS = [
  { socket: 'by poke', blocked: false },
  { socket: 'with the socket blocked', blocked: true },
] as const;

const statusOf = (page: Page) => page.locator('#online-lineup .lineup-step:visible .lineup-status');
const SENDER = ['storm', 'quake', 'ghost'] as const;

/** The sender sends a link from vs Friend; the friend opens it and accepts: both on the lineups. */
async function agreed(sender: Page, friend: Page): Promise<void> {
  await sender.goto(`${BASE}/`);
  await playAFriend(sender);
  await confirmAge(sender);
  // No lineup and no rules step before the friend accepts: Play sends it.
  await sender.getByRole('heading', { name: 'Waiting for your friend' }).waitFor();
  const token = new URL(sender.url()).searchParams.get('challenge') ?? '';
  await friend.goto(`${BASE}/?challenge=${token}`);
  await friend.getByRole('heading', { name: /challenges you$/ }).waitFor();
  await friend.getByRole('button', { name: 'Accept' }).click();
  await confirmAge(friend);
  // Both on the same lineups, the sender's lobby moved there by itself.
  await friend.waitForURL(/[?&]start=/);
  await sender.waitForURL(/[?&]start=/, { timeout: 20_000 });
  expect(new URL(sender.url()).searchParams.get('start')).toBe(
    new URL(friend.url()).searchParams.get('start'),
  );
}

describe.each(SOCKETS)('lineups picked together, $socket', ({ blocked }) => {
  let phones: Phones;
  beforeAll(async () => {
    phones = await openPhones(BASE, process.env['ONLINE_ENGINE'], blocked);
  });
  afterAll(async () => {
    await closePhones(phones);
  });

  it(
    'puts both phones on one lineup at once: ready without the balls, then one series',
    { timeout: 120_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      await agreed(sender, friend);
      for (const page of [sender, friend]) {
        await statusOf(page)
          .getByText(/^Player \d+ is choosing · \d+ s$/)
          .waitFor();
      }
      // While nothing changes: by poke, the safety read at most; blocked, a read a second. Blocked,
      // the waits between reads are what the page chose (a count over 5 s also counts how long
      // each read took: 3 where 4 was wanted on CI, 2026-11-24).
      await (blocked ? Promise.resolve() : socketOf(friend).waitUp());
      const from = Date.now();
      const waits = [...(await waitsOver(friend, '/api/v1/starts/', 5_000))].sort((a, b) => a - b);
      if (blocked) {
        expect(waits.length, `waits ${waits.join(', ')}`).toBeGreaterThanOrEqual(2);
        expect(waits[Math.floor(waits.length / 2)], `waits ${waits.join(', ')}`).toBeLessThan(
          1_500,
        );
      } else expect(readsBetween(friend, '/api/v1/starts/', from)).toBeLessThanOrEqual(1);
      // The sender locks in first: the friend is told they are ready, never which balls.
      await buildLineup(sender, 'Lock in', SENDER);
      await sender.getByText(/^Waiting for Player \d+’s lineup$/).waitFor();
      await statusOf(friend)
        .getByText(/^Player \d+ is ready · \d+ s$/)
        .waitFor({ timeout: blocked ? 5_000 : 3_000 });
      expect(socketOf(friend).up()).toBe(!blocked);
      const shown = await friend
        .locator('#online-lineup .lineup-step:visible .lineup-tray')
        .innerText();
      expect(shown).not.toMatch(/Storm|Quake|Ghost/);
      // Back holds the lineups: home leads back to them, the draft kept.
      await friend
        .locator('#online-lineup .lineup-step:visible .ball-grid button[data-ball-id="spartan"]')
        .click();
      await friend
        .locator('#online-lineup .lineup-step:visible')
        .getByRole('button', { name: 'Back' })
        .click();
      await friend.getByRole('button', { name: /^Back to your lineup/ }).click({ timeout: 15_000 });
      await friend.waitForURL(/[?&]start=/);
      await expect
        .poll(() => friend.locator('#online-lineup .lineup-step:visible .lineup-tray').innerText())
        .toMatch(/Spartan/);
      await buildLineup(friend, 'Lock in', ['titan', 'venom']);
      for (const page of [sender, friend]) {
        await page.waitForURL(/[?&]online=/, { timeout: 20_000 });
      }
      const ids = [sender, friend].map((page) => new URL(page.url()).searchParams.get('online'));
      expect(ids[0]).toBe(ids[1]);
      await panelOf(friend).waitFor();
      expect(phones.errors).toStrictEqual([]);
    },
  );

  it(
    'finishes a half-built lineup at random when time runs out, and tells both phones',
    { timeout: startLineupMs(3) + 90_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      await agreed(sender, friend);
      await buildLineup(sender, 'Lock in', SENDER);
      // The friend picks one ball and lets the clock run out.
      await friend
        .locator('#online-lineup .lineup-step:visible .ball-grid button[data-ball-id="spartan"]')
        .click();
      const told = { timeout: startLineupMs(3) + 20_000 };
      await friend.getByText('Time ran out: your lineup was finished at random.').waitFor(told);
      await sender
        .getByText(/^Time ran out: Player \d+’s lineup was finished at random\.$/)
        .waitFor(told);
      // Then both go into the match, which plays on (nobody forfeits a lineup they opened).
      for (const page of [sender, friend]) {
        await page.waitForURL(/[?&]online=/, { timeout: 20_000 });
      }
      await expect
        .poll(
          () =>
            panelOf(friend)
              .getByText(/forfeit|didn’t arrive/i)
              .count(),
          {
            timeout: 5_000,
          },
        )
        .toBe(0);
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
