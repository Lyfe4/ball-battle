// The Slime in live friend matches, two phones (ADR 0053, 0059, 0060, 0062): it splits on both
// screens at the same moment, each HUD keeps one row a side reading both halves added up (checked
// against the series replayed here from its revealed seeds), the story of each round and the
// fair-play check work on both, and teaching shows the same as against the bot: the What to watch
// card during Get ready and the countdown, gone by Fight! on both phones at once, and the ability
// hints (the caption "Slime: Split"), only on a phone with them switched on. Chromium against `netlify dev`.
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SeriesView } from '../api/series.ts';
import { READY_CARD_STORAGE_KEY, TIPS_STORAGE_KEY } from '../app/tips.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { matchWorld, playToEnd } from '../sim/series-verify.ts';
import { sideHealth } from '../sim/side.ts';
import {
  closePhones,
  finished,
  openPhones,
  phone,
  pickIfDue,
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

/** What a phone showed over the match, recorded as it happened. */
interface Seen {
  readonly reasons: string[];
  readonly hints: string[];
  /** When the ready card went at each Fight! (Date.now(), one clock for both phones). */
  readonly lifts: number[];
  /** Each fight's end: the HUD's health line for each row. */
  readonly ends: string[][];
  readonly maxRows: number;
  readonly stories: number;
}

const PROBE = `
  const seen = { reasons: [], hints: [], lifts: [], ends: [], maxRows: 0, stories: 0 };
  window.__seen = seen;
  const shown = (node) => node !== null && node.getClientRects().length > 0;
  let held = false;
  let ended = false;
  const look = () => {
    const layer = document.querySelector('.ready-layer');
    const now = shown(layer) && !layer.classList.contains('ready-lift');
    if (held && !now) seen.lifts.push(Date.now());
    held = now;
    const reason = document.querySelector('.ready-reason');
    if (shown(reason) && !seen.reasons.includes(reason.textContent)) seen.reasons.push(reason.textContent);
    const hint = document.querySelector('#arena-caption:not([hidden]) .arena-caption-title');
    if (shown(hint) && !seen.hints.includes(hint.textContent)) seen.hints.push(hint.textContent);
    const rows = [...document.querySelectorAll('.hud-ball')].filter(shown);
    seen.maxRows = Math.max(seen.maxRows, rows.length);
    const over = rows.length > 0 && rows.some((row) => (row.dataset.outcome ?? '') !== '');
    if (over && !ended) {
      seen.ends.push(rows.map((row) => row.querySelector('.hud-ball-health')?.textContent ?? ''));
    }
    ended = over;
    if (shown(document.querySelector('#online-series .match-story'))) seen.stories += 1;
  };
  new MutationObserver(look).observe(document, {
    subtree: true, childList: true, attributes: true, characterData: true,
  });
`;

/** Teaching off on this device: no hints, no What to watch cards (the settings' two switches). */
const TEACHING_OFF = `
  localStorage.setItem('${TIPS_STORAGE_KEY}', 'off');
  localStorage.setItem('${READY_CARD_STORAGE_KEY}', 'off');
`;

const seenOn = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __seen: Seen }).__seen);

/** Plays the match out, each phone picking its own ball when it can. */
async function playOut(sides: readonly { page: Page; prefer: string }[]): Promise<void> {
  const [first, second] = sides;
  if (first === undefined || second === undefined) throw new Error('Two phones');
  for (let step = 0; !((await finished(first.page)) && (await finished(second.page))); step += 1) {
    expect(step, 'the match never ended').toBeLessThan(600);
    for (const side of sides) await pickIfDue(side.page, side.prefer);
    await first.page.waitForTimeout(500);
  }
}

/** Every fight of the series as this device should end it: each side's health, as the HUD says. */
async function expectedEnds(page: Page, id: string): Promise<string[][]> {
  const answer = await page.request.get(`${BASE}/api/v1/series/${id}`);
  const view = (await answer.json()) as SeriesView;
  return view.rounds.flatMap((record, round) =>
    record.seeds.map((seed, attempt) => {
      const end = playToEnd(
        matchWorld({ round, attempt, seed, a: record.a, b: record.b }, BALL_LOOKUP),
        BALL_LOOKUP,
      );
      return ['a', 'b'].map((_, index) => {
        const lead = end.balls[index];
        const max = BALL_LOOKUP.get(lead?.definitionId ?? '')?.maxHealth ?? 0;
        const total = lead === undefined ? 0 : sideHealth(end.balls, lead.id);
        return `${String(Math.ceil(total))} / ${String(max)}`;
      });
    }),
  );
}

/** Whether any round of the series had a Slime that split (two balls on one side). */
async function splitIn(page: Page, id: string): Promise<boolean> {
  const answer = await page.request.get(`${BASE}/api/v1/series/${id}`);
  const view = (await answer.json()) as SeriesView;
  return view.rounds.some((record, round) =>
    record.seeds.some(
      (seed, attempt) =>
        playToEnd(
          matchWorld({ round, attempt, seed, a: record.a, b: record.b }, BALL_LOOKUP),
          BALL_LOOKUP,
        ).balls.length > 2,
    ),
  );
}

describe('the Slime in a live friend match', () => {
  it(
    'splits on both phones, reads its halves as one side, and teaches only where switched on',
    { timeout: 420_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      for (const page of [sender, friend]) await page.addInitScript(PROBE);
      await friend.addInitScript(TEACHING_OFF);
      const id = await startLiveMatch(BASE, sender, friend, 'reveal', {
        sender: ['slime', 'archer', 'sniper'],
        // The Slime's round is the only one it plays, and its seeds are the server's, so the
        // friend answers it with the Thorns: the Slime split in all but 2 of 10,000 such fights
        // (the Spider let it win unsplit in 63, and once on CI).
        friend: ['thorns', 'vampire', 'archer'],
      });
      await playOut([
        { page: sender, prefer: 'slime' },
        { page: friend, prefer: 'thorns' },
      ]);
      for (const page of [sender, friend]) {
        await page.locator('#online-series .fair-play[data-result="fair"]').waitFor();
      }
      const [a, b] = await Promise.all([seenOn(sender), seenOn(friend)]);
      console.log('slime live (sender, friend):', JSON.stringify({ a, b }));
      const expected = await expectedEnds(sender, id);
      expect(await splitIn(sender, id)).toBe(true);
      for (const seen of [a, b]) {
        // One row a side, however many halves; each fight ends on its sides' totals.
        expect(seen.maxRows).toBe(2);
        expect(seen.ends).toStrictEqual(expected);
        // Each round's story, between rounds and at the end.
        expect(seen.stories).toBeGreaterThan(0);
      }
      // Both fights start at the same moment: each card lifts together.
      expect(a.lifts.length).toBe(b.lifts.length);
      a.lifts.forEach((at, index) => {
        expect(Math.abs(at - (b.lifts[index] ?? 0))).toBeLessThan(150);
      });
      // Teaching on: What to watch during the countdown, and the Slime's hint when it splits.
      expect(a.reasons.length).toBeGreaterThan(0);
      expect(a.reasons.every((line) => /^(What to watch: \S|Same ball)/.test(line))).toBe(true);
      expect(a.hints).toContain('Slime: Split');
      // Teaching off: neither.
      expect(b.reasons).toStrictEqual([]);
      expect(b.hints).toStrictEqual([]);
      expect(phones.errors).toStrictEqual([]);
    },
  );

  it(
    'plays a Slime mirror on both phones: two sides, each split and summed',
    { timeout: 420_000 },
    async () => {
      const sender = await phone(phones);
      const friend = await phone(phones);
      for (const page of [sender, friend]) await page.addInitScript(PROBE);
      const id = await startLiveMatch(BASE, sender, friend, 'reveal', {
        sender: ['slime', 'brawler', 'magnet'],
        friend: ['slime', 'magnet', 'brawler'],
      });
      await playOut([
        { page: sender, prefer: 'slime' },
        { page: friend, prefer: 'slime' },
      ]);
      for (const page of [sender, friend]) {
        await page.locator('#online-series .fair-play[data-result="fair"]').waitFor();
      }
      const [a, b] = await Promise.all([seenOn(sender), seenOn(friend)]);
      console.log('slime mirror (sender, friend):', JSON.stringify({ a, b }));
      const expected = await expectedEnds(sender, id);
      expect(await splitIn(sender, id)).toBe(true);
      for (const seen of [a, b]) {
        expect(seen.maxRows).toBe(2);
        expect(seen.ends).toStrictEqual(expected);
        // The mirror's card on each phone, and the hint once per device.
        expect(seen.reasons).toContain('Same ball, same tricks.');
        expect(seen.hints).toContain('Slime: Split');
      }
      expect(phones.errors).toStrictEqual([]);
    },
  );
});
