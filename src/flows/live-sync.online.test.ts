// Two phones stay on the same moment of a live fight (ADR 0053, 0063) even when one of them is slow:
// the friend's phone draws at an uneven 25/42 ms beat (iPhone Low Power Mode holds Safari near 30
// frames a second) and its page is busy for half a second across Fight!, so its start timer fires
// late. It catches up with the server's moment gently, and from then on both phones draw each ball
// in the same place at the same time. Both phones run on this machine, so their clocks are one.
// Chromium against `netlify dev`.
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NOW_HEADER } from '../api/live.ts';
import {
  closePhones,
  openPhones,
  pickIfDue,
  phone,
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

interface Point {
  readonly at: number;
  readonly x: number;
  readonly y: number;
}

/** Records where the first round ball is drawn on each frame of the arena, by the clock. */
const RECORD = `
  window.__drawn = [];
  let frame = -1;
  const raf = window.requestAnimationFrame.bind(window);
  window.__frame = 0;
  const arc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function (x, y, radius, ...rest) {
    if (radius === 50 && this.canvas.id === 'arena' && frame !== window.__frame) {
      frame = window.__frame;
      window.__drawn.push({ at: Date.now(), x, y });
    }
    return arc.call(this, x, y, radius, ...rest);
  };
  const count = () => { window.__frame += 1; raf(count); };
  raf(count);
`;

/**
 * Counts the sound this page makes (each sound makes at least one oscillator, ADR 0064): sound is on
 * by default, so the timing below is measured with both phones heard, countdown and Fight! included.
 */
const HEARD = `
  window.__sounds = 0;
  if ('AudioContext' in window) {
    const make = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...rest) {
      window.__sounds += 1;
      return make.apply(this, rest);
    };
  }
`;

/** Holds this page's animation frames to an uneven 25/42 ms beat. */
const UNEVEN_FRAMES = `
  let queue = [];
  let n = 0;
  const beat = () => {
    const due = queue;
    queue = [];
    window.__frame = (window.__frame ?? 0) + 1;
    for (const callback of due) callback(performance.now());
    n += 1;
    setTimeout(beat, n % 2 === 0 ? 25 : 42);
  };
  window.requestAnimationFrame = (callback) => { queue.push(callback); return queue.length; };
  setTimeout(beat, 25);
`;

const drawnOn = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __drawn: Point[] }).__drawn);

/** Where `points` put the ball at `at`, between the frames either side of it. */
function placeAt(points: readonly Point[], at: number): Point | undefined {
  const after = points.findIndex((point) => point.at >= at);
  const next = points[after];
  const last = points[after - 1];
  if (after <= 0 || next === undefined || last === undefined) return undefined;
  const t = (at - last.at) / Math.max(1, next.at - last.at);
  return { at, x: last.x + (next.x - last.x) * t, y: last.y + (next.y - last.y) * t };
}

/**
 * Ms until round 1's Fight! by the server's clock, read through `page` as it reads its series
 * (ADR 0053); undefined until the round is scheduled.
 */
async function msUntilFirstFight(page: Page, id: string): Promise<number | undefined> {
  return page.evaluate(
    async ([series, header]) => {
      const answer = await fetch(`/api/v1/series/${series}`, { cache: 'no-store' });
      if (!answer.ok) return undefined;
      const body = (await answer.json()) as {
        live?: { fights?: { round: number; fightAt: number }[] } | null;
      };
      const fight = body.live?.fights?.find((scheduled) => scheduled.round === 0);
      const now = Number(answer.headers.get(header));
      return fight === undefined || !Number.isFinite(now) ? undefined : fight.fightAt - now;
    },
    [id, NOW_HEADER] as const,
  );
}

describe('a live fight on a slow phone', () => {
  it(
    'catches up with the server’s moment and stays with the other phone',
    {
      timeout: 180_000,
    },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      await friend.addInitScript(UNEVEN_FRAMES);
      for (const page of [sender, friend]) {
        await page.addInitScript(RECORD);
        await page.addInitScript(HEARD);
      }
      const id = await startLiveMatch(BASE, sender, friend, 'reveal', {
        sender: ['brawler', 'magnet', 'titan'],
        friend: ['magnet', 'brawler', 'titan'],
      });
      // Round 1's picks, then the friend's page is busy across its Fight!. The moment comes from the
      // server's fight time, as the friend's page reads it, not from the countdown on screen: a page
      // that learns of a round late (a slow answer on a loaded machine) rightly says "Get ready"
      // until Fight! and never shows the 3-2-1, which left this waiting for a "1" that by design
      // never came (CI, 2026-11-17 and 18).
      let untilFight: number | undefined;
      for (let tries = 0; untilFight === undefined; tries += 1) {
        expect(tries, 'round 1 was never scheduled').toBeLessThan(120);
        await pickIfDue(sender, 'brawler');
        await pickIfDue(friend, 'magnet');
        await friend.waitForTimeout(250);
        untilFight = await msUntilFirstFight(friend, id);
      }
      await friend.waitForTimeout(Math.max(0, untilFight - 300));
      await friend.evaluate(() => {
        const end = Date.now() + 500;
        while (Date.now() < end) {
          // Busy: no timer, no frame.
        }
      });
      await sender.waitForTimeout(4_000);
      const [a, b] = await Promise.all([drawnOn(sender), drawnOn(friend)]);
      // The last 1.5 s drawn on both: from 2 s after the friend's late start on.
      const end = Math.min(a.at(-1)?.at ?? 0, b.at(-1)?.at ?? 0) - 100;
      const gaps = (from: number, to: number) => {
        const found: number[] = [];
        for (let at = end - from; at < end - to; at += 50) {
          const here = placeAt(a, at);
          const there = placeAt(b, at);
          if (here !== undefined && there !== undefined) {
            found.push(Math.hypot(here.x - there.x, here.y - there.y));
          }
        }
        return found.sort((p, q) => p - q);
      };
      // Settled: within about a tick's travel (12.7 world units at the Brawler's speed).
      const settled = gaps(1_500, 0);
      const median = settled[Math.floor(settled.length / 2)] ?? Infinity;
      console.log(
        `live sync: median gap ${median.toFixed(1)} world units over ${String(settled.length)} samples`,
      );
      expect(settled.length).toBeGreaterThan(10);
      expect(median).toBeLessThan(20);
      // ...with sound playing on both phones all along.
      const heard = await Promise.all(
        [sender, friend].map((page) => page.evaluate<number>('window.__sounds')),
      );
      console.log(`live sync: sounds made, sender ${String(heard[0])}, friend ${String(heard[1])}`);
      for (const sounds of heard) expect(sounds).toBeGreaterThan(0);
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
