// Best of 5 (ADR 0048) through the real page, in a frame it can reload (reload-support.ts). Run at
// 390 x 664 (Safari's iPhone with its toolbars, touch) and 1280 x 800. From home, Other modes'
// remembered Best of 5 opens each format's lineup; five balls fill one row of the tray; the pick
// chart shows every ball left against every one of the bot's, each mark a 44 px target and every
// name whole; mid-fight the score line and the five-round track fit with no sideways scroll; the
// series stops at three wins, a reload and a Back with Resume carry on where it was, and the
// decided link replays as a Best of 5.
import { expect } from 'vitest';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { SERIES_SETUP_STORAGE_KEY, SERIES_STORAGE_KEY } from '../app/series-save.ts';
import { SERIES_LENGTH_STORAGE_KEY } from '../app/series-length.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { READY_CARD_STORAGE_KEY, TIPS_STORAGE_KEY } from '../app/tips.ts';
import type { Format } from '../sim/series.ts';
import { settle } from './page-support.ts';
import { comesBackTo, reloadsTo, steady, storage, tapBall, wait } from './reload-screen.ts';
import {
  backIn,
  buttonIn,
  openFramed,
  paramOf,
  reload,
  seriesPhase,
  shown,
  visit,
  waitFor,
  type Framed,
} from './reload-support.ts';

const NAMES: Readonly<Record<Format, string>> = {
  blind: 'Blind',
  reveal: 'Reveal',
  showdown: 'Showdown',
};

/** No sideways scroll anywhere on the page. */
function fitsWidth(framed: Framed, where: string): void {
  const doc = framed.doc().documentElement;
  expect({ where, wider: doc.scrollWidth > doc.clientWidth }).toStrictEqual({
    where,
    wider: false,
  });
}

/** Other modes, from home: the length remembered, then a tap on the format's card. */
async function fromOtherModes(framed: Framed, format: Format): Promise<void> {
  await visit(framed, '');
  buttonIn(framed, 'Other modes').click();
  await settle();
  const five = buttonIn(framed, 'Best of 5');
  if (five.getAttribute('aria-pressed') !== 'true') {
    five.click();
    await settle();
    // Remembered across a reload, like the bot level.
    await reload(framed);
    expect(buttonIn(framed, 'Best of 5').getAttribute('aria-pressed')).toBe('true');
  }
  expect(shown(framed, '.modes-length-rule')[0]?.textContent).toBe(
    '5 balls each · first to 3 wins',
  );
  const card = shown(framed, '.modes-card').find(
    (node) => node.querySelector('.modes-card-name')?.textContent === NAMES[format],
  );
  card?.click();
  await settle();
  expect({ mode: paramOf(framed, 'mode'), step: paramOf(framed, 'step') }).toStrictEqual({
    mode: 'bo5',
    step: 'lineup',
  });
}

/** Five balls, one row of the tray, then on to the series. */
async function buildLineup(framed: Framed, own: readonly string[]): Promise<void> {
  expect(shown(framed, '.lineup-mode-name')[0]?.textContent).toMatch(/^Best of 5 · /);
  for (const id of own) tapBall(framed, id);
  await settle();
  const slots = shown(framed, '.lineup-tray-slot');
  expect(slots).toHaveLength(5);
  const tops = new Set(slots.map((slot) => Math.round(slot.getBoundingClientRect().top)));
  expect(tops.size).toBe(1);
  fitsWidth(framed, 'lineup');
  shown(framed, '.lineup-step .screen-footer .hud-button-primary')[0]?.click();
  await settle();
}

/** The pick chart: every ball left against every one of the bot's, readable and tappable. */
function checkChart(framed: Framed, where: string): void {
  const rows = shown(framed, '.pick-row');
  const heads = shown(framed, '.pick-head-ball');
  const badges = shown(framed, '.pick-row-badge');
  expect(badges.length).toBe(rows.length * heads.length);
  for (const badge of badges) {
    const box = badge.getBoundingClientRect();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  // Every name whole on its line: none cut short or wrapped mid-word.
  const cut = shown(framed, '.pick-row-name').filter(
    (name) => name.scrollWidth > name.clientWidth + 1 || name.getClientRects().length > 1,
  );
  expect({ where, cut: cut.map((name) => name.textContent) }).toStrictEqual({ where, cut: [] });
  fitsWidth(framed, where);
}

/** Mid-fight: the score line, and the track with all five rounds. */
async function checkFight(framed: Framed, round: number): Promise<void> {
  const where = `fight ${String(round)}`;
  const line = shown(framed, '.series-bar-score-text')[0];
  if (line !== undefined) {
    // A phone: the compact score line opens the full track under the court.
    // The round on screen: a drawn round is fought again, so it can lag the fights counted here.
    expect(line.textContent).toMatch(/^Round [1-5] · You [0-2]–[0-2] Bot$/);
    shown(framed, '.series-bar-score')[0]?.click();
    await settle();
  }
  const heads = shown(framed, '#series .series-track-round').map((head) => head.textContent);
  expect(heads).toStrictEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
  fitsWidth(framed, where);
  if (line !== undefined) {
    shown(framed, '.series-bar-score')[0]?.click();
    await settle();
  }
}

/** Plays the series to its end: each round fought, reloaded and resumed once along the way. */
async function playOut(framed: Framed, format: Format): Promise<void> {
  if (format !== 'blind') {
    expect(paramOf(framed, 'step')).toBe('answer');
    checkChart(framed, `${format} round 1 pick`);
    shown(framed, '.answer-step .pick-row-pick')[0]?.click();
    await settle();
  }
  for (let round = 1; ; round += 1) {
    const where = `${format} fight ${String(round)}`;
    await waitFor(
      framed,
      () => shown(framed, '.ready-fight').length === 1,
      15_000,
      `${where} Fight!`,
    );
    shown(framed, '.ready-fight')[0]?.click();
    await wait(500);
    if (seriesPhase(framed) === 'playing') await checkFight(framed, round);
    await waitFor(framed, () => seriesPhase(framed) !== 'playing', 150_000, `${where} to end`);
    if (seriesPhase(framed) === 'finished') break;
    const between = await steady(framed, false);
    if (round === 2) {
      // A reload, then a Back and Resume, carry on exactly where it was (ADR 0042).
      await reloadsTo(framed, `${where} between rounds`, false, between);
      await backIn(framed);
      expect({ mode: paramOf(framed, 'mode'), step: paramOf(framed, 'step') }).toStrictEqual({
        mode: 'bo5',
        step: 'lineup',
      });
      buttonIn(framed, 'Resume series').click();
      await settle();
      await comesBackTo(framed, `${where} resumed`, false, between);
    }
    const pick = shown(framed, '#series .pick-row-pick')[0];
    if (pick !== undefined) {
      checkChart(framed, `${where} next pick`);
      pick.click();
    } else {
      shown(framed, '#series .hud-button-primary')[0]?.click();
    }
    await settle();
  }
}

/** The result: first to three, a Best of 5 link that names both lineups of five. */
function checkResult(framed: Framed, format: Format): string {
  const [you = 0, bot = 0] = (shown(framed, '#series .series-track-points')[0]?.textContent ?? '')
    .split('–')
    .map((side) => Number(side.trim()));
  expect({ format, top: Math.max(you, bot), low: Math.min(you, bot) < 3 }).toStrictEqual({
    format,
    top: 3,
    low: true,
  });
  expect(paramOf(framed, 'mode')).toBe('bo5');
  expect(paramOf(framed, 'lb')?.split(',')).toHaveLength(5);
  expect(shown(framed, '#series .series-bar-about')[0]?.textContent).toMatch(/^Best of 5 · /);
  fitsWidth(framed, `${format} result`);
  return framed.win().location.search;
}

export async function runBestOf5Flow(): Promise<void> {
  storage().setItem(SPEED_STORAGE_KEY, '2');
  storage().setItem(READY_CARD_STORAGE_KEY, 'off');
  storage().setItem(TIPS_STORAGE_KEY, 'off');
  storage().setItem(BOT_LEVEL_STORAGE_KEY, 'hard');
  for (const key of [SERIES_STORAGE_KEY, SERIES_SETUP_STORAGE_KEY, SERIES_LENGTH_STORAGE_KEY]) {
    storage().removeItem(key);
  }
  const framed = await openFramed('');
  const lineups: Readonly<Record<Format, readonly string[]>> = {
    reveal: ['necromancer', 'berserker', 'boomerang', 'storm', 'frost'],
    showdown: ['spartan', 'archer', 'venom', 'ghost', 'titan'],
    blind: ['brawler', 'sniper', 'quake', 'magnet', 'bloom'],
  };
  for (const format of ['reveal', 'showdown', 'blind'] as const) {
    await fromOtherModes(framed, format);
    await buildLineup(framed, lineups[format]);
    await playOut(framed, format);
    const link = checkResult(framed, format);
    // The decided link, opened afresh with nothing saved, replays as the same Best of 5.
    if (format === 'reveal') {
      for (const key of [SERIES_STORAGE_KEY, SERIES_SETUP_STORAGE_KEY]) storage().removeItem(key);
      await visit(framed, link);
      await waitFor(framed, () => seriesPhase(framed) !== 'none', 10_000, 'the link replayed');
      expect(shown(framed, '#series .series-bar-about')[0]?.textContent).toMatch(/^Best of 5/);
    }
  }
  // Home's Play is still Best of 3 Reveal, whatever length Other modes remembers.
  storage().removeItem(SERIES_STORAGE_KEY);
  await visit(framed, '');
  shown(framed, '.home-play')[0]?.click();
  await settle();
  expect({ mode: paramOf(framed, 'mode'), fmt: paramOf(framed, 'fmt') }).toStrictEqual({
    mode: 'bo3',
    fmt: 'reveal',
  });
  for (const key of [
    SERIES_STORAGE_KEY,
    SERIES_SETUP_STORAGE_KEY,
    SERIES_LENGTH_STORAGE_KEY,
    SPEED_STORAGE_KEY,
    READY_CARD_STORAGE_KEY,
    TIPS_STORAGE_KEY,
    BOT_LEVEL_STORAGE_KEY,
  ]) {
    storage().removeItem(key);
  }
}
