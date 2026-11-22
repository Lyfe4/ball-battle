// Reveal's coin toss in a live friend match (ADR 0061), two phones: both join, both say Get ready,
// both coins flip at the same moment (timed by the server's clock), both land together, and only
// then does the first pick open on both. Both phones run on this machine, so their clocks are one:
// each records when its own screen changed. Chromium only, against `netlify dev` (`pnpm test:online`).
import type { BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TOSS_FLIP_MS, TOSS_HOLD_MS } from '../api/live.ts';
import {
  closePhones,
  openPhones,
  phone,
  SIDEWAYS,
  SIDEWAYS_LARGE,
  startLiveMatch,
  type Phones,
} from './live-support.ts';

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

  it(
    'shows the whole toss without a scroll on phones turned sideways',
    { timeout: 120_000 },
    async () => {
      // On an iPhone sideways the toss opened below the fold (ADR 0061, 0067): both phones here
      // see the coin's whole stage and the result line at scroll 0 as it lands.
      const sender = await phone(phones, SIDEWAYS);
      const friend = await phone(phones, SIDEWAYS_LARGE);
      await startLiveMatch(BASE, sender, friend);
      const landed = '#online-series .coin-toss[data-stage="landed"]';
      const results = await Promise.all(
        [sender, friend].map(async (page) => {
          await page.locator(landed).waitFor({ timeout: 20_000 });
          return page.evaluate<Record<string, unknown>>(WHOLE_TOSS);
        }),
      );
      for (const seen of results) {
        expect(seen).toStrictEqual({ scrollY: 0, stage: true, words: true });
      }
      expect(phones.errors).toStrictEqual([]);
    },
  );

  it(
    'flips smoothly on a first game whose clock is still settling (playtest: first game)',
    { timeout: 120_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      for (const page of [sender, friend]) {
        await page.addInitScript(TOSS_PROBE);
        await page.addInitScript(FLIP_PROBE);
        await slowReads(page.context());
      }
      await startLiveMatch(BASE, sender, friend);
      for (const page of [sender, friend]) {
        await page
          .locator('#online-series .pick-clock:is([data-kind="yours"], [data-kind="theirs"])')
          .waitFor({ timeout: 30_000 });
      }
      for (const page of [sender, friend]) {
        const frames = await flipFrames(page);
        expect(frames.length, 'the coin flipped').toBeGreaterThan(20);
        // Each frame moves the flip by the real time that passed, at most 1.5x: never backwards,
        // never a jump (a slow frame moves it further, but no faster).
        const steps = frames.slice(1).map(([at, real], index) => {
          const [was = 0, wasReal = 0] = frames[index] ?? [];
          return { flip: at - was, ahead: at - was - 1.5 * (real - wasReal) };
        });
        expect(Math.min(...steps.map((one) => one.flip)), 'never back').toBeGreaterThanOrEqual(0);
        expect(Math.max(...steps.map((one) => one.ahead)), 'never a jump').toBeLessThan(30);
        const seen = await seenOn(page);
        expect(seen.words.filter((words) => words === 'Get ready')).toHaveLength(1);
      }
      // Answers still held back when the phones close are dropped, not left to fail.
      for (const page of [sender, friend]) {
        await page.context().unrouteAll({ behavior: 'ignoreErrors' });
      }
      expect(phones.errors).toStrictEqual([]);
    },
  );
});

/** At this moment: the page's scroll, and whether the toss's stage and words are whole on screen. */
const WHOLE_TOSS = `(() => {
  const whole = (selector) => {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    return box !== undefined && box.top >= 0 && box.bottom <= window.innerHeight + 0.5;
  };
  return {
    scrollY: window.scrollY,
    stage: whole('#online-series .coin-toss-stage'),
    words: whole('#online-series .coin-toss-words'),
  };
})()`;

/** Records the coin flip's own time on every frame it runs (its animation's currentTime). */
const FLIP_PROBE = `
  window.__flip = [];
  const frame = () => {
    const coin = document.querySelector('#online-series .coin-toss-coin');
    const flip = coin?.getAnimations()[0];
    if (flip !== undefined && flip.playState === 'running') window.__flip.push([Number(flip.currentTime), performance.now()]);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
`;

const flipFrames = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __flip: [number, number][] }).__flip);

/**
 * A phone's network on a first game: the series' answers come back late and unevenly, the first
 * ones slowest (a cold function, a radio waking up), so the page's estimate of the server's clock
 * moves by hundreds of ms in the seconds the toss plays.
 */
async function slowReads(context: BrowserContext): Promise<void> {
  const delays = [1_400, 900, 600, 1_100, 400, 700, 300, 500, 350];
  let next = 0;
  await context.route(/\/api\/v1\/series\/[^/]+$/, async (route) => {
    const delay = delays[next] ?? 250;
    next += 1;
    try {
      const response = await route.fetch();
      await new Promise((done) => setTimeout(done, delay));
      await route.fulfill({ response });
    } catch (error) {
      // The phone closed with this answer held back (the test is over): nothing to answer.
      if (!context.pages().every((page) => page.isClosed())) throw error;
    }
  });
}
