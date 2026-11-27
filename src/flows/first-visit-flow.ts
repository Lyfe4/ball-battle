// The first five minutes (ADR 0090) through the real page, as a brand-new device in a build with
// online play and accounts (the API refuses everything: nothing waits on a server). Play is the one
// action, with the pitch and the skip; the lineup teaches a series and offers Pick for me; the bot
// shows first and the first pick says what ▲ means; round 2 says what showing first means; the
// result names the new ways to play once; then home is the whole tab, Best of 5 against the Normal
// bot (the first series alone is Best of 3, ADR 0090 addendum), the
// sheet says each format in a sentence and tags the two new ones, and the first Showdown and Blind
// each say how they go. Show all tips again starts it over; the skip shows everything at once;
// leaving the first series ends it. Each new state passes the button system (controls-look) and axe,
// and the first visit's header row sits on the full tab's pixels (frame-anchors).
import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { FIRST_SERIES_STORAGE_KEY, PLAYED_KEYS } from '../app/first-series.ts';
import { STARTER_TRIO } from '../app/first-series-setup.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { FIRST_VISIT } from '../ui/first-series-text.ts';
import { FORMAT_LINES } from '../ui/series-text.ts';
import { check, linesOf, serious } from './a11y-flow.ts';
import { controlProblems } from './controls-look-flow.ts';
import { headerAnchors } from './frame-anchors-flow.ts';
import { back, button, settle, tossed, until, visible } from './page-support.ts';
import { closeSheet, openSheet, playMeta } from './play-sheet-support.ts';
import { follow, onScreen, openAs } from './shell-routes-support.ts';

const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });
const textOf = (selector: string) => visible(selector)[0]?.textContent.trim();
const textsOf = (selector: string) => visible(selector).map((node) => node.textContent.trim());
const phase = () => document.querySelector<HTMLElement>('#series')?.dataset['phase'];
const stored = () => localStorage.getItem(FIRST_SERIES_STORAGE_KEY);
const upright = () => !matchMedia('(min-aspect-ratio: 5/4)').matches;

/** What the look and axe checks found, by state: one list, so every state is reported. */
const found: string[] = [];

/** The button and row system and axe on the state on show. */
async function checkState(where: string): Promise<void> {
  await settle();
  found.push(...controlProblems(where, document.getElementById('stage') ?? document));
  const a11y = serious(await check(where));
  if (a11y.length > 0) found.push(`${where}: ${linesOf(a11y)}`);
}

/** Starts the page as a brand-new device: no BallBattle key at all, fights at 2x. */
export async function openAsNewDevice(search = ''): Promise<void> {
  localStorage.removeItem(FIRST_SERIES_STORAGE_KEY);
  localStorage.setItem(SPEED_STORAGE_KEY, '2');
  await openAs({ online: true, accounts: true }, search);
}

/** Home on a first visit: Play alone, its line, the pitch in the demo's place, and the skip. */
async function checkFirstHome(where: string): Promise<void> {
  await onScreen('home');
  expect(visible('.play-box'), `${where}: no box`).toHaveLength(0);
  expect(textsOf('.home-link'), `${where}: the skip in Free play's place`).toStrictEqual([
    FIRST_VISIT.skip,
  ]);
  expect(textOf('.home-demo-line')).toBe(FIRST_VISIT.pitch);
  expect(textOf('.home-play-meta')).toBe(FIRST_VISIT.play);
  expect(visible('.home-play')[0]?.getAttribute('aria-label')).toBe(FIRST_VISIT.playSpoken);
  // Play whole on screen above the tab bar, the demo court at least 180 px (ADR 0081).
  const play = visible('.home-play')[0]?.getBoundingClientRect();
  const bar = visible('nav.tab-bar')[0]?.getBoundingClientRect();
  if (play === undefined || bar === undefined) throw new Error('No Play or no tab bar');
  const floor = upright() ? bar.top : window.innerHeight;
  expect(Math.round(play.bottom) <= Math.round(floor) && play.top >= 0, `${where}: Play`).toBe(
    true,
  );
  if (upright()) {
    const court = document.getElementById('arena')?.getBoundingClientRect();
    expect(Math.round(court?.height ?? 0)).toBeGreaterThanOrEqual(180);
  }
  await checkState(where);
}

/** The first series from Play to its result, Pick for me's balls. */
async function playFirstSeries(): Promise<void> {
  await click(visible('.home-play')[0] ?? document.body);
  await settle();
  expect(location.search).toBe('?mode=bo3&fmt=reveal&step=lineup');
  // Play starts it, remembered before the series writes keys of its own.
  expect(stored()).toBe('guided');
  expect(textOf('.lineup-guide .coach-title')).toBe('How a series goes');
  expect(textOf('.lineup-guide .coach-step')).toBe('1 of 3');
  expect(textOf('.lineup-mode-name')).toBe(FIRST_VISIT.play);
  expect(visible('.lineup-level-toggle'), 'Pick for me in the level’s place').toHaveLength(0);
  await checkState('the first lineup');
  await click(button('Pick for me'));
  const names = STARTER_TRIO.map((id) => BALL_LOOKUP.get(id)?.name);
  expect(textsOf('.lineup-tray-name')).toStrictEqual(names);
  await click(button('Reveal lineups'));
  // The first series' seed is searched for this lineup between frames (ADR 0090 addendum).
  await until(() => location.search.includes('step=answer'), 10_000, 'round 1’s pick');
  await tossed();
  // The bot shows first (ADR 0090, D2): the first choice is an answer.
  expect(textOf('.answer-step .series-banner')).toMatch(/^Coin toss: the bot shows/);
  expect(textOf('.answer-guide .coach-title')).toBe('Your first pick');
  expect(textOf('.answer-guide .coach-step')).toBe('2 of 3');
  // The coach points at the best answer: one lit row, favoured against the shown ball.
  const lit = visible('.answer-step .pick-row[data-coached]');
  expect(lit, 'one lit row').toHaveLength(1);
  expect(lit[0]?.querySelector('.pick-row-badge[data-facing]')?.textContent).toMatch(/▲/);
  if (upright()) {
    // A phone: the banner, the coach and every pick row show without a scroll (1c).
    const parts = ['.answer-step .series-banner', '.answer-guide', '.answer-step .pick-row'];
    for (const node of parts.flatMap((selector) => visible(selector))) {
      const box = node.getBoundingClientRect();
      expect(box.top >= 0 && Math.round(box.bottom) <= window.innerHeight, node.className).toBe(
        true,
      );
    }
  }
  await checkState('the first pick');
  // The lit row: the answer a newcomer is shown.
  await click(lit[0]?.querySelector('.pick-row-pick') ?? document.body);
  let coached = 0;
  for (;;) {
    await until(() => phase() !== 'playing', 90_000, 'the round to end');
    if (phase() === 'finished') break;
    const picks = visible('#series .pick-row-pick');
    if (picks.length > 0) {
      // Round 2: the player shows first, and the line says what that means.
      expect(textOf('#series .series-coach .coach-note')).toBe(
        'The bot sees your ball before it answers.',
      );
      expect(textOf('#series .series-coach .coach-step')).toBe('3 of 3');
      coached += 1;
      await checkState('the first series’ round 2 pick');
      await click(picks[0] ?? document.body);
    } else await click(button(textOf('#series .hud-actions .hud-button-primary') ?? 'Play round'));
    await until(() => phase() === 'playing', 5_000, 'the next round');
  }
  expect(coached, 'round 2’s line showed').toBe(1);
  // The result: the new ways to play, once, and no link to copy yet.
  expect(textOf('.unlock-card .unlock-title')).toBe('New: more ways to play');
  // Folded under the sticker: Rematch and Home stay on screen; a tap opens the ways.
  for (const name of ['Rematch', 'Home']) {
    const box = button(name).getBoundingClientRect();
    expect(Math.round(box.bottom) <= window.innerHeight, `${name} on screen`).toBe(true);
  }
  await click(visible('.unlock-summary')[0] ?? document.body);
  expect(textsOf('.unlock-card li')).toContain('Play a friend with a link.');
  expect(textsOf('.unlock-card li')[0]).toBe('From now on a series is Best of 5: first to 3 wins.');
  expect(visible('.series-share')).toHaveLength(0);
  expect(stored()).toBe('graduated');
  await checkState('the first series’ result');
}

/** A format's row in the open sheet, by its name, with any tag. */
const formatChoice = (name: string) =>
  visible('dialog.play-sheet .play-sheet-format .segmented-button').find((node) =>
    node.querySelector('.segmented-text')?.textContent.startsWith(name),
  );
const tagged = () =>
  visible('dialog.play-sheet .segmented-tag').map(
    (tag) =>
      tag.closest('.segmented-button')?.querySelector('.segmented-text')?.firstChild?.textContent,
  );

/** The sheet after the first series: each format in a sentence, the two new ones tagged. */
async function sheetAfter(): Promise<void> {
  await openSheet();
  expect(tagged()).toStrictEqual(['Showdown', 'Blind']);
  expect(formatChoice('Showdown')?.getAttribute('aria-label')).toBe('Showdown, winner shows, new');
  expect(textOf('.play-sheet-rule')).toBe(FORMAT_LINES.reveal);
  await checkState('What to play, after the first series');
  await click(formatChoice('Showdown') ?? document.body);
  expect(textOf('.play-sheet-rule')).toBe(FORMAT_LINES.showdown);
  expect(tagged()).toStrictEqual(['Blind']);
  await closeSheet();
}

/** Each later format's first time says how it goes, once. */
async function firstFormats(): Promise<void> {
  await click(visible('.home-play')[0] ?? document.body);
  await settle();
  expect(location.search).toBe('?mode=bo5&fmt=showdown&step=lineup');
  expect(visible('.lineup-guide')).toHaveLength(0);
  // The tray keeps the first series' balls: fill what is left of the five.
  for (const tile of visible('.lineup-step .ball-tile')) {
    if (visible('.lineup-step .lineup-tray-empty').length === 0) break;
    if (tile.getAttribute('aria-pressed') !== 'true') await click(tile);
  }
  await click(button('Reveal lineups'));
  await until(() => visible('.answer-guide').length > 0, 5_000, 'Showdown’s box');
  expect(textOf('.answer-guide .coach-title')).toBe('How Showdown goes');
  await checkState('the first Showdown pick');
  await back();
  await back();
  await onScreen('home');
  await openSheet();
  await click(formatChoice('Blind') ?? document.body);
  expect(tagged()).toStrictEqual([]);
  await closeSheet();
  await click(visible('.home-play')[0] ?? document.body);
  await settle();
  expect(textOf('.lineup-guide .coach-title')).toBe('How Blind goes');
  await checkState('the first Blind lineup');
  await back();
  await onScreen('home');
}

/** Show all tips again, from the gear: the next visit to Play is a first one. */
async function showAllTipsAgain(): Promise<void> {
  await click(visible('.settings-toggle')[0] ?? document.body);
  // Its words change once used ("All tips will show again"): found by its place.
  await click(visible('.settings-again')[0] ?? document.body);
  await userEvent.keyboard('{Escape}');
  await follow('?view=manual');
  await follow('');
  await checkFirstHome('Play after Show all tips again');
}

export async function runFirstVisitFlow(): Promise<void> {
  await openAsNewDevice();
  await checkFirstHome('Play, a first visit');
  const first = headerAnchors('Play, a first visit', 'skip');
  // A first load writes nothing that means play (ADR 0090, D6): still new after the demo runs.
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  expect(PLAYED_KEYS.filter((key) => localStorage.getItem(key) !== null)).toStrictEqual([]);
  expect(stored(), 'a first load writes no state of its own').toBeNull();

  await playFirstSeries();
  await click(button('Home'));
  await onScreen('home');
  // A new series is Best of 5 from now on (ADR 0090 addendum).
  expect(playMeta()).toBe('vs Normal bot · Best of 5 · Reveal');
  expect(textsOf('.home-link')).toStrictEqual(['Free play']);
  // The first visit's header row is the whole tab's (ADR 0087).
  const after = headerAnchors('Play, after the first series', 'skip');
  for (const part of ['lead', 'gear'] as const) {
    expect(Math.abs(first[part].x - after[part].x) + Math.abs(first[part].y - after[part].y)).toBe(
      0,
    );
  }
  await sheetAfter();
  await firstFormats();

  // Again from the start, then the skip: the whole tab at once, nothing marked new.
  await showAllTipsAgain();
  await click(button(FIRST_VISIT.skip));
  expect(visible('.play-box')).toHaveLength(1);
  expect(document.activeElement).toBe(visible('.home-play')[0]);
  expect(stored()).toBe('done');
  await openSheet();
  expect(tagged()).toStrictEqual([]);
  await closeSheet();

  // Leaving the first series part-way ends it: home is the whole tab, the new formats tagged.
  await showAllTipsAgain();
  await click(visible('.home-play')[0] ?? document.body);
  await settle();
  await click(button('Pick for me'));
  await click(button('Reveal lineups'));
  await tossed();
  await click(visible('.answer-step .pick-row-pick')[0] ?? document.body);
  await click(button('Leave series'));
  await click(button('Leave'));
  await settle();
  if (location.search !== '') await back();
  await onScreen('home');
  expect(visible('.play-box')).toHaveLength(1);
  expect(stored()).toBe('graduated');

  expect(found).toStrictEqual([]);
}
