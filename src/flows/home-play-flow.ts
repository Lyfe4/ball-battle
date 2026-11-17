// Home by opponent (ADR 0055), through the real page. Run at 375 x 812 and 390 x 664 with touch,
// 1280 x 800 and 1920 x 1080: Play opens the remembered series' lineup in one tap (a first visit:
// Best of 3 · Reveal · vs Normal bot), the level is changed there and remembered; the vs Bot card
// opens its setup, whose choices survive Back from the lineup and become Play's; Free play and the
// manual are one step in; Back from every screen lands where the ADR's table says, by the browser's
// Back and the in-app ‹, and Escape only ever closes; every stop has a way forward and nothing
// scrolls sideways; old links open what they should (Other modes opens home); a held series is
// still resumed.
import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { PLAY_FORMAT_STORAGE_KEY } from '../app/modes.ts';
import { SERIES_LENGTH_STORAGE_KEY } from '../app/series-length.ts';
import { back, button, settle, tossed, until, visible } from './page-support.ts';

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
const playMeta = () => visible('.home-play-meta')[0]?.textContent;
/** What the setup shows as chosen: the length, the format card's name, the level. */
const pressed = () =>
  visible('.rules-step [aria-pressed="true"]').map((node) =>
    (node.querySelector('.rules-card-name') ?? node).textContent.trim(),
  );

async function card(name: string): Promise<void> {
  const target = visible('.rules-card').find(
    (node) => node.querySelector('.rules-card-name')?.textContent === name,
  );
  if (target === undefined) throw new Error(`No ${name} card`);
  await click(target);
}

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

/**
 * The opponent cards are two compact buttons under Play (the old Best of 3 / Best of 5 toggles'
 * size): the title alone, centred, a card no taller than Play.
 */
function checkCards(): void {
  const play = visible('.home-play')[0]?.getBoundingClientRect();
  for (const card of visible('.home-card')) {
    expect(card.querySelectorAll('span')).toHaveLength(1);
    const box = card.getBoundingClientRect();
    const name = card.querySelector('.home-card-name')?.getBoundingClientRect();
    expect(
      Math.abs((name?.left ?? 0) + (name?.width ?? 0) / 2 - (box.left + box.width / 2)),
    ).toBeLessThan(2);
    expect(
      Math.abs((name?.top ?? 0) + (name?.height ?? 0) / 2 - (box.top + box.height / 2)),
    ).toBeLessThan(2);
    expect(box.height).toBeLessThan(play?.height ?? 0);
  }
}

/** Play: the remembered series' lineup in one tap; the level changed there is Play's next time. */
async function play(): Promise<void> {
  expect(search()).toBe('');
  checkStop('home');
  const plays = visible('.home-play');
  expect(plays).toHaveLength(1);
  expect(plays[0]?.getAttribute('aria-label')).toBe(
    'Play Best of 3, Reveal, against the Normal bot',
  );
  expect(playMeta()).toBe('Best of 3 · Reveal · vs Normal bot');
  // One card per opponent under Play: the bot in every build (vs Friend needs online play).
  expect(visible('.home-card-name').map((name) => name.textContent)).toContain('vs Bot');
  checkCards();
  if (plays[0] !== undefined) await click(plays[0]);
  await settle();

  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');
  expect(visible('.rules-step')).toHaveLength(0);
  expect(setupLine()).toBe('Best of 3 · Reveal');
  expect(levelToggle()?.textContent).toContain('vs Normal bot');
  checkStop('Play lineup');

  // Changing the level is part of this screen and adds no history step.
  const toggle = levelToggle();
  if (toggle === undefined) throw new Error('No level toggle');
  await click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  checkStop('Play lineup, level open');
  await click(button('Easy bot'));
  expect(toggle.textContent).toContain('vs Easy bot');
  expect(document.activeElement).toBe(toggle);
  expect(window.localStorage.getItem(BOT_LEVEL_STORAGE_KEY)).toBe('easy');
  // Escape only closes it (ADR 0038).
  await click(toggle);
  await userEvent.keyboard('{Escape}');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');

  // The series is played against the level chosen here.
  await pickLineup(['storm', 'berserker', 'brawler']);
  await click(button('Reveal lineups'));
  await settle();
  expect(visible('.answer-step .series-bar-about')[0]?.textContent).toBe(
    'Best of 3 · Reveal · Easy',
  );
  await back();
  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');
  // A lineup reached from Play goes back home.
  await inAppBack();
  expect(search()).toBe('');
  expect(playMeta()).toBe('Best of 3 · Reveal · vs Easy bot');
}

/** The vs Bot card: its setup, its choices kept through the lineup and Back, then Play's. */
async function botSetup(): Promise<void> {
  await click(visible('.home-card[data-opponent="bot"]')[0] ?? document.body);
  await settle();
  expect(search()).toBe('?mode=bo3&fmt=reveal');
  expect(visible('.rules-step .screen-title')[0]?.textContent).toBe('vs Bot');
  expect(document.title).toBe('vs Bot · BallBattle');
  checkStop('vs Bot setup');
  expect(pressed()).toStrictEqual(['Best of 3', 'Reveal', 'Easy']);
  expect(visible('.rules-card-name').map((name) => name.textContent)).toStrictEqual([
    'Reveal',
    'Showdown',
    'Blind',
  ]);

  // Each choice rewrites this entry: the URL follows, and no step is added.
  await click(button('Best of 5'));
  expect(search()).toBe('?mode=bo5&fmt=reveal');
  expect(visible('.rules-rule')[0]?.textContent).toBe('5 balls each · first to 3 wins');
  await card('Blind');
  expect(search()).toBe('?mode=bo5');
  // Blind has no choices a level changes.
  expect(visible('.rules-level')).toHaveLength(0);
  await card('Showdown');
  expect(search()).toBe('?mode=bo5&fmt=showdown');
  await click(button('Hard bot'));
  expect(pressed()).toStrictEqual(['Best of 5', 'Showdown', 'Hard']);
  // Escape only ever closes things: it leaves the setup where it is.
  await userEvent.keyboard('{Escape}');
  expect(search()).toBe('?mode=bo5&fmt=showdown');

  await click(button('Choose lineup'));
  await settle();
  expect(search()).toBe('?mode=bo5&fmt=showdown&step=lineup');
  expect(setupLine()).toBe('Best of 5 · Showdown');
  expect(levelToggle()?.textContent).toContain('vs Hard bot');
  // Back to the setup finds it as it was left; one more Back is home.
  await back();
  expect(search()).toBe('?mode=bo5&fmt=showdown');
  expect(pressed()).toStrictEqual(['Best of 5', 'Showdown', 'Hard']);
  await click(button('Choose lineup'));
  await settle();
  await inAppBack();
  expect(search()).toBe('?mode=bo5&fmt=showdown');
  await inAppBack();
  expect(search()).toBe('');

  // Going on to the lineup made it Play's.
  expect(playMeta()).toBe('Best of 5 · Showdown · vs Hard bot');
  expect(window.localStorage.getItem(PLAY_FORMAT_STORAGE_KEY)).toBe('showdown');
  expect(window.localStorage.getItem(SERIES_LENGTH_STORAGE_KEY)).toBe('5');
  const plays = visible('.home-play');
  if (plays[0] !== undefined) await click(plays[0]);
  await settle();
  expect(search()).toBe('?mode=bo5&fmt=showdown&step=lineup');
  await back();
  expect(search()).toBe('');
}

/** Free play and the manual: quiet links, one step in and one Back out. */
async function quietLinks(): Promise<void> {
  await click(button('Free play'));
  await settle();
  expect(search()).toMatch(/^\?view=pick&a=\w+&b=\w+$/);
  checkStop('Free play');
  await inAppBack();
  expect(search()).toBe('');
  await click(button('Ball manual'));
  await settle();
  expect(search()).toBe('?view=manual');
  checkStop('manual');
  await back();
  expect(search()).toBe('');
}

/** Old links open what they always did; Other modes opens home; a linked lineup's Back is its setup. */
async function oldLinks(): Promise<void> {
  await open('?mode=bo3');
  expect(visible('.rules-step')).toHaveLength(1);
  expect(pressed()).toStrictEqual(['Best of 3', 'Blind']);
  checkStop('setup from a link');
  await open('?mode=bo3&fmt=loser');
  expect(pressed()).toStrictEqual(['Best of 3', 'Showdown', 'Hard']);
  await open('?mode=bo3&fmt=reveal');
  await click(button('Choose lineup'));
  await settle();
  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');
  // A lineup link with no format is Blind, whatever was on screen before.
  await open('?mode=bo3&step=lineup');
  expect(setupLine()).toBe('Best of 3 · Blind');

  // Arriving on a lineup from a link, Back is the setup that leads to it, on the link's choices.
  await arrive('?mode=bo5&fmt=showdown&step=lineup');
  await inAppBack();
  expect(search()).toBe('?mode=bo5&fmt=showdown');
  expect(pressed()).toStrictEqual(['Best of 5', 'Showdown', 'Hard']);
  await inAppBack();
  expect(search()).toBe('');

  // Other modes went (ADR 0055): its old link opens home, and says so in the address.
  await arrive('?view=modes');
  expect(search()).toBe('');
  expect(visible('.home-play')).toHaveLength(1);
}

/** A Reveal series left with Back is still held, and home's Play resumes it. */
async function resume(): Promise<void> {
  await click(visible('.home-card[data-opponent="bot"]')[0] ?? document.body);
  await settle();
  await click(button('Best of 3'));
  await card('Reveal');
  await click(button('Choose lineup'));
  await settle();
  await click(button('Reveal lineups'));
  await settle();
  await tossed();
  const pick = visible('.answer-step .pick-row-pick')[0];
  if (pick === undefined) throw new Error('No round-1 pick');
  await click(pick);
  await settle();
  expect(new URL(location.href).searchParams.get('step')).toBe('play');
  await back();
  expect(search()).toBe('?mode=bo3&fmt=reveal&step=lineup');
  await back();
  expect(search()).toBe('?mode=bo3&fmt=reveal');
  await back();
  expect(search()).toBe('');
  // Home's Play now resumes it (its own flow, home-resume-flow.ts, covers the rest).
  const resumed = visible('.home-play')[0];
  expect(resumed?.querySelector('.home-play-label')?.textContent).toBe('Resume series');
  if (resumed !== undefined) await click(resumed);
  await until(
    () => new URL(location.href).searchParams.get('step') === 'play',
    5000,
    'the series to start',
    false,
  );
  expect(visible('#series')).toHaveLength(1);
}

export async function runHomePlayFlow(): Promise<void> {
  for (const key of [BOT_LEVEL_STORAGE_KEY, PLAY_FORMAT_STORAGE_KEY, SERIES_LENGTH_STORAGE_KEY]) {
    window.localStorage.removeItem(key);
  }
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

  await play();
  await botSetup();
  await quietLinks();
  await oldLinks();
  await resume();
}
