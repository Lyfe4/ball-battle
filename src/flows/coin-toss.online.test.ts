// Reveal's coin toss in a live friend match (ADR 0061), two phones: both join, both say Get ready,
// both coins flip at the same moment (timed by the server's clock), both land together, and only
// then does the first pick open on both. Both phones run on this machine, so their clocks are one:
// each records when its own screen changed. Chromium only, against `netlify dev` (`pnpm test:online`).
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TOSS_FLIP_MS, TOSS_HOLD_MS } from '../api/live.ts';
import { closePhones, openPhones, phone, startLiveMatch, type Phones } from './live-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
let phones: Phones;
beforeAll(async () => {
  phones = await openPhones(BASE, process.env['ONLINE_ENGINE']);
});
afterAll(async () => {
  await closePhones(phones);
});

/** When this phone first showed each stage of the toss, and the first pick card (Date.now()). */
interface Seen {
  ready?: number;
  flipping?: number;
  landed?: number;
  pick?: number;
  words: string[];
}

/** Watches the series screen from the page's start, recording each change as it happens. */
const TOSS_PROBE = `
  const seen = { words: [] };
  window.__toss = seen;
  const shown = (node) => node !== null && node.closest('[hidden]') === null;
  const look = () => {
    const toss = document.querySelector('#online-series .coin-toss');
    const stage = shown(toss) ? toss.getAttribute('data-stage') : null;
    if (stage === 'ready' || stage === 'flipping' || stage === 'landed') {
      seen[stage] ??= Date.now();
      const words = toss.querySelector('.coin-toss-words')?.textContent ?? '';
      if (seen.words.at(-1) !== words) seen.words.push(words);
    }
    const card = document.querySelector(
      '#online-series .pick-clock:is([data-kind="yours"], [data-kind="theirs"])',
    );
    if (shown(card)) seen.pick ??= Date.now();
  };
  new MutationObserver(look).observe(document, {
    subtree: true, childList: true, attributes: true, characterData: true,
  });
`;

const seenOn = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __toss: Seen }).__toss);

describe('a live Reveal match’s coin toss', () => {
  it(
    'flips on both phones at the same moment, then opens the first pick on both',
    {
      timeout: 120_000,
    },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      for (const page of [sender, friend]) await page.addInitScript(TOSS_PROBE);
      await startLiveMatch(BASE, sender, friend);
      for (const page of [sender, friend]) {
        await page
          .locator('#online-series .pick-clock:is([data-kind="yours"], [data-kind="theirs"])')
          .waitFor({ timeout: 20_000 });
      }
      const [a, b] = await Promise.all([seenOn(sender), seenOn(friend)]);
      console.log('toss timing (ms, one clock):', JSON.stringify({ sender: a, friend: b }));
      for (const seen of [a, b]) {
        if (seen.flipping === undefined || seen.landed === undefined || seen.pick === undefined) {
          throw new Error(`A phone missed part of the toss: ${JSON.stringify(seen)}`);
        }
        // A watchable flip, the result held to be read, then the first pick (the card's ticker
        // draws every 250 ms).
        expect(seen.landed - seen.flipping).toBeGreaterThanOrEqual(TOSS_FLIP_MS - 50);
        expect(seen.pick - seen.landed).toBeGreaterThanOrEqual(TOSS_HOLD_MS - 50);
        expect(seen.words).toContain('Coin toss…');
        expect(seen.words.at(-1)).toMatch(/^(You show first|Player \d+ shows first)$/);
      }
      // Both together: the same moment, to within a frame or two of each phone's timer.
      expect(Math.abs((a.flipping ?? 0) - (b.flipping ?? 0))).toBeLessThan(150);
      expect(Math.abs((a.landed ?? 0) - (b.landed ?? 0))).toBeLessThan(150);
      expect(Math.abs((a.pick ?? 0) - (b.pick ?? 0))).toBeLessThan(600);
      // Each phone names the same winner: one "You", the other the player across.
      const results = [a, b].map((seen) => seen.words.at(-1));
      expect(results.filter((line) => line === 'You show first')).toHaveLength(1);
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
