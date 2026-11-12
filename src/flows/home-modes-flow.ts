// Home's one tap into Reveal and the Other modes screen (ADR 0046), through the real page. Run at
// 375 x 812 and 390 x 664 with touch, 1280 x 800 and 1920 x 1080: one tap from home reaches
// Reveal's lineup against the remembered bot level; the level is seen and changed there, in place,
// and remembered; Other modes reaches every other way to play; Back from every screen lands where
// it should, by the browser's Back and the in-app ‹; every stop has a way forward and nothing
// scrolls sideways; old links still open the rules step; a held series is still resumed.
import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { back, button, settle, until, visible } from './page-support.ts';

const search = () => location.search;
const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });

/** Opens a URL inside the page, as a Back or Forward to it would. */
async function open(query: string): Promise<void> {
  const entry: unknown = history.state;
  history.pushState(entry, '', `${location.pathname}${query}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
  await settle();
}

/** Lands on a URL as a visitor following a link does: nothing in this page's history before it. */
async function arrive(query: string): Promise<void> {
  history.replaceState(null, '', `${location.pathname}${query}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  await settle();
}

/** The in-app ‹ of the screen on show. */
async function inAppBack(): Promise<void> {
  const backs = visible('.screen-back');
  expect(backs).toHaveLength(1);
  const [chevron] = backs;
  if (chevron !== undefined) await click(chevron);
  await settle();
}

const levelToggle = () => visible('.lineup-level-toggle')[0];
const setupLine = () => visible('.lineup-mode-name')[0]?.textContent;

/**
 * Every stop: one gear, a control that moves the player on (not Back, the gear or the ?), and
 * nothing wider than the screen.
 */
function checkStop(where: string): void {
  expect(visible('.settings-toggle'), where).toHaveLength(1);
  const forward = visible('button, a[href]').filter(
    (control) =>
      !control.matches('.screen-back, .settings-toggle, .symbol-legend-toggle') &&
      !(control instanceof HTMLButtonElement && control.disabled),
  );
  expect(forward.length, where).toBeGreaterThan(0);
  expect(
    { where, sideways: document.documentElement.scrollWidth > window.innerWidth },
    where,
  ).toStrictEqual({ where, sideways: false });
}

async function pickLineup(ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    const tile = visible('.lineup-step .ball-tile').find((node) => node.dataset['ballId'] === id);
    if (tile === undefined) throw new Error(`No tile for ${id}`);
    await click(tile);
  }
}

/** One tap from home: Reveal's lineup, the remembered level shown and changed in place. */
async function mainMode(): Promise<void> {
  expect(search()).toBe('');
  checkStop('home');
  const play = visible('.home-play');
  expect(play).toHaveLength(1);
  expect(play[0]?.getAttribute('aria-label')).toBe('Play Best of 3, Reveal, against the bot');
  expect(visible('.rules-step')).toHaveLength(0);
  if (play[0] !== undefined) await click(play[0]);
  await settle();

  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');
  expect(visible('.rules-step')).toHaveLength(0);
  expect(setupLine()).toBe('Best of 3 · Reveal');
  expect(levelToggle()?.textContent).toContain('vs Hard bot');
  checkStop('Reveal lineup');

  // Changing the level is part of this screen, and it is remembered. It adds no history step: the
  // one Back after round 1's pick lands here, and the next on home.
  const toggle = levelToggle();
  if (toggle === undefined) throw new Error('No level toggle');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  checkStop('Reveal lineup, level open');
  await click(button('Easy bot'));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(toggle.textContent).toContain('vs Easy bot');
  expect(document.activeElement).toBe(toggle);
  expect(window.localStorage.getItem(BOT_LEVEL_STORAGE_KEY)).toBe('easy');
  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');
  // Escape only closes it (ADR 0038).
  await click(toggle);
  await userEvent.keyboard('{Escape}');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');

  // The series is played against the level chosen here.
  await pickLineup(['storm', 'berserker', 'brawler']);
  await click(button('Reveal lineups'));
  await settle();
  expect(visible('.answer-step .series-bar-about')[0]?.textContent).toBe(
    'Best of 3 · Reveal · Easy',
  );
  await back();
  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');
  expect(levelToggle()?.textContent).toContain('vs Easy bot');
  await inAppBack();
  expect(search()).toBe('');
}

/** Other modes: every other way to play, one step in and one step out. */
async function otherModes(): Promise<void> {
  await click(button('Other modes'));
  await settle();
  expect(search()).toBe('?view=modes');
  expect(visible('.modes .screen-title')[0]?.textContent).toBe('Other modes');
  expect(visible('.modes .symbol-legend-toggle')).toHaveLength(0);
  checkStop('Other modes');
  expect(visible('.modes-section-title').map((title) => title.textContent)).toStrictEqual([
    'Series vs bot',
    'One match',
  ]);
  // The series length (ADR 0048): Best of 3 unless chosen, with the rule it plays by.
  expect(button('Best of 3').getAttribute('aria-pressed')).toBe('true');
  expect(visible('.modes-length-rule')[0]?.textContent).toBe('3 balls each · first to 2 wins');
  const cards = () => visible('.modes-card');
  expect(cards().map((card) => card.querySelector('.modes-card-name')?.textContent)).toStrictEqual([
    'Reveal',
    'Showdown',
    'Blind',
    'Free play',
  ]);
  const levels = cards().map((card) => card.querySelector('.modes-card-level')?.textContent);
  expect(levels).toStrictEqual(['vs Easy bot', 'vs Easy bot', undefined, undefined]);
  // Within the screen, and side by side on a desktop.
  for (const card of cards()) {
    expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
  }
  const desktop = matchMedia('(min-width: 64rem) and (min-aspect-ratio: 5/4)').matches;
  const [first, second] = cards().map((card) => card.getBoundingClientRect().top);
  expect({ desktop, sideBySide: first === second }).toStrictEqual({
    desktop,
    sideBySide: desktop,
  });

  const card = (name: string) =>
    cards().find((node) => node.querySelector('.modes-card-name')?.textContent === name);
  const go = async (name: string) => {
    const target = card(name);
    if (target === undefined) throw new Error(`No ${name} card`);
    await click(target);
    await settle();
  };

  await go('Showdown');
  expect(search()).toBe('?mode=bo3&fmt=showdown&step=lineup');
  expect(setupLine()).toBe('Best of 3 · Showdown');
  expect(levelToggle()?.textContent).toContain('vs Easy bot');
  checkStop('Showdown lineup');
  await inAppBack();
  expect(search()).toBe('?view=modes');

  await go('Blind');
  expect(search()).toBe('?mode=bo3&step=lineup');
  expect(setupLine()).toBe('Best of 3 · Blind');
  expect(levelToggle()).toBeUndefined();
  checkStop('Blind lineup');
  await back();
  expect(search()).toBe('?view=modes');

  await go('Free play');
  expect(search()).toMatch(/^\?view=pick&a=\w+&b=\w+$/);
  checkStop('Free play');
  await inAppBack();
  expect(search()).toBe('?view=modes');

  await inAppBack();
  expect(search()).toBe('');
}

/** Old links open what they always did; a lineup reached by a link goes back to its parent. */
async function oldLinks(): Promise<void> {
  const pressed = () =>
    visible('.rules-card[aria-pressed="true"] .rules-card-name').map((name) => name.textContent);
  await open('?mode=bo3');
  expect(visible('.rules-step')).toHaveLength(1);
  expect(pressed()).toStrictEqual(['Blind order']);
  checkStop('rules from a link');
  await open('?mode=bo3&fmt=showdown');
  expect(pressed()).toStrictEqual(['Showdown']);
  await open('?mode=bo3&fmt=loser');
  expect(pressed()).toStrictEqual(['Showdown']);
  await open('?mode=bo3&fmt=reveal');
  expect(pressed()).toStrictEqual(['Reveal, then take turns']);
  await click(button('Choose lineup'));
  await settle();
  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');
  expect(levelToggle()?.textContent).toContain('vs Easy bot');
  // A lineup link with no format is Blind, whatever was on screen before.
  await open('?mode=bo3&step=lineup');
  expect(setupLine()).toBe('Best of 3 · Blind');

  await arrive('?mode=bo3&fmt=showdown&step=lineup');
  await inAppBack();
  expect(search()).toBe('?view=modes');
  await arrive('?mode=bo3&fmt=reveal&step=lineup');
  await inAppBack();
  expect(search()).toBe('');
}

/** A Reveal series left with Back is still held, and home's Play resumes it. */
async function resume(): Promise<void> {
  await click(button('Play Best of 3, Reveal, against the bot'));
  await settle();
  await click(button('Reveal lineups'));
  await settle();
  const pick = visible('.answer-step .pick-row-pick')[0];
  if (pick === undefined) throw new Error('No round-1 pick');
  await click(pick);
  await settle();
  expect(new URL(location.href).searchParams.get('step')).toBe('play');
  await back();
  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');
  await back();
  expect(search()).toBe('');
  // Home's Play now resumes it (its own flow, home-resume-flow.ts, covers the rest).
  const play = visible('.home-play')[0];
  expect(play?.querySelector('.home-play-label')?.textContent).toBe('Resume series');
  if (play !== undefined) await click(play);
  await until(() => new URL(location.href).searchParams.get('step') === 'play', 5000, false);
  expect(visible('#series')).toHaveLength(1);
}

export async function runHomeModesFlow(): Promise<void> {
  window.localStorage.setItem(BOT_LEVEL_STORAGE_KEY, 'hard');
  const body = new DOMParser().parseFromString(page, 'text/html').body;
  document.body.replaceChildren(...body.children);
  const start = new URL(location.href);
  start.search = '';
  // Home's entry is made by a real click, as a visitor's own visit is. WebKit's Back skips entries
  // a script added without user activation, so with earlier test files in this tab's history a
  // scripted entry here was skipped and the flow's last Back left the page.
  const visit = document.createElement('button');
  visit.textContent = 'Visit';
  visit.addEventListener('click', () => {
    history.pushState(null, '', start);
  });
  document.body.append(visit);
  await click(visit);
  visit.remove();
  await import('../main.ts');
  await settle();

  await mainMode();
  await otherModes();
  await oldLinks();
  await resume();
}
