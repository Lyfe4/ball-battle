// Flight mode mid-lineup (the owner's two-device check, automated): two phones on one lineup screen
// (ADR 0080); the friend's phone goes offline, finishes its lineup and taps Lock in. It says it is
// offline, with Try again, never a blank screen or a spinner without end; the other phone still
// sees "choosing". Back online, Try again locks the lineup in once: the other phone is told
// "ready", the friend waits with the one waiting ball, and the match both enter has the balls the
// friend picked, nothing lost or sent twice. No refresh anywhere. Chromium, against `netlify dev`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SeriesView } from '../api/series.ts';
import {
  agreed,
  buildLineup,
  closePhones,
  openPhones,
  panelOf,
  phone,
  type Phones,
} from './live-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
const FRIEND = ['spartan', 'venom', 'frost'] as const;

describe('a phone that goes offline mid-lineup', () => {
  let phones: Phones;
  beforeAll(async () => {
    phones = await openPhones(BASE, process.env['ONLINE_ENGINE']);
  });
  afterAll(async () => {
    await closePhones(phones);
  });

  it(
    'says it is offline, and locks its lineup in once when back, nothing lost',
    { timeout: 120_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      await agreed(BASE, sender, friend);
      const start = new URL(friend.url()).searchParams.get('start');
      // Every lock the server answered (an offline tap never gets an answer).
      const locks: number[] = [];
      friend.on('response', (response) => {
        const request = response.request();
        if (request.method() === 'POST' && (request.postData() ?? '').includes('"lock":true')) {
          locks.push(response.status());
        }
      });

      await friend.context().setOffline(true);
      await buildLineup(friend, 'Lock in', FRIEND);
      await friend.getByRole('heading', { name: 'You’re offline' }).waitFor({ timeout: 15_000 });
      await sender
        .locator('#online-lineup .lineup-step:visible .lineup-status')
        .getByText(/^Player \d+ is choosing/)
        .waitFor();
      // No refresh: the same page, the same lineup screen's address.
      expect(new URL(friend.url()).searchParams.get('start')).toBe(start);

      await friend.context().setOffline(false);
      await friend.getByRole('button', { name: 'Try again' }).click();
      await sender
        .locator('#online-lineup .lineup-step:visible .lineup-status')
        .getByText(/^Player \d+ is ready/)
        .waitFor({ timeout: 15_000 });
      await friend.getByText(/^Waiting for Player \d+’s lineup$/).waitFor();
      await friend.locator('.waiting-ball').first().waitFor();

      await buildLineup(sender, 'Lock in', ['storm', 'quake', 'ghost']);
      for (const page of [sender, friend]) {
        await page.waitForURL(/[?&]online=/, { timeout: 20_000 });
      }
      await panelOf(friend).waitFor();
      const id = new URL(friend.url()).searchParams.get('online') ?? '';
      const seen = (await friend.evaluate(
        (path) => fetch(path).then((answer) => answer.json()),
        `/api/v1/series/${id}`,
      )) as SeriesView;
      const mine = seen.lineups[seen.you] ?? [];
      expect([...mine].sort()).toStrictEqual([...FRIEND].sort());
      // One lock reached the server, and it was taken (the offline tap never left the phone).
      expect(locks).toStrictEqual([200]);
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
