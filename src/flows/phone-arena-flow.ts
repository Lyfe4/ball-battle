// The phone arena (ADR 0039), through the real page on a touch phone: run at 375 x 812, 390 x 844
// and 390 x 664 (what Safari leaves of a 390 x 844 iPhone with its toolbars shown). In every state
// with a court, the court is as wide as the screen allows; mid-fight the court, both health bars and
// the speed control are on screen without scrolling; and opening something mid-fight (the legend,
// the full track) scrolls the page rather than squeezing the court.
import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { READY_CARD_STORAGE_KEY, READY_SEEN_STORAGE_KEY, TIPS_STORAGE_KEY } from '../app/tips.ts';
import { button, settle, until, visible } from './page-support.ts';

const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });
const phase = () => document.querySelector<HTMLElement>('#series')?.dataset['phase'];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Opens a link inside the page, as a Back or Forward to it would. */
async function open(search: string): Promise<void> {
  const entry: unknown = history.state;
  history.pushState(entry, '', `${location.pathname}${search}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
  await settle();
}

/** The width a court can have: the stage's, less its gutters. */
function availableWidth(): number {
  const stage = document.getElementById('stage');
  if (stage === null) throw new Error('No stage');
  const style = getComputedStyle(stage);
  return stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

/** The court, once laid out (it is sized a frame after a change), within 2 px of its full width. */
async function checkCourt(where: string): Promise<void> {
  await wait(300);
  const court = document.getElementById('arena')?.getBoundingClientRect();
  if (court === undefined) throw new Error('No court');
  const full = availableWidth();
  expect(
    { where, court: Math.abs(court.width - full) <= 2 },
    `${String(court.width)} of ${String(full)}`,
  ).toStrictEqual({
    where,
    court: true,
  });
}

/** Mid-fight: the court, both health bars and the speed control fit on screen, unscrolled. */
function checkFits(where: string): void {
  const parts = [
    document.getElementById('arena'),
    ...visible('.hud-ball'),
    visible('#hud-speed')[0],
  ];
  expect(
    parts.filter((part) => part !== null && part !== undefined),
    where,
  ).toHaveLength(4);
  const outside = parts
    .map((part) => part?.getBoundingClientRect())
    .filter((box) => box !== undefined && (box.top < 0 || box.bottom > window.innerHeight));
  expect({ where, outside: outside.length, scrollY: window.scrollY }).toStrictEqual({
    where,
    outside: 0,
    scrollY: 0,
  });
}

/** A round being fought: court full width and everything that matters on screen. */
async function checkFight(where: string): Promise<void> {
  await click(button('Fight!'));
  await wait(400);
  await checkCourt(where);
  checkFits(where);
}

/** Opens `toggle` mid-fight: the court keeps its size; closed again, everything fits again. */
async function checkOpened(where: string, toggle: HTMLElement | undefined): Promise<void> {
  expect(toggle, where).toBeTruthy();
  if (toggle === undefined) return;
  await click(toggle);
  await settle();
  await checkCourt(`${where} open`);
  await click(toggle);
  await settle();
  window.scrollTo(0, 0);
  checkFits(`${where} closed`);
}

export async function runPhoneArenaFlow(): Promise<void> {
  window.localStorage.setItem(BOT_LEVEL_STORAGE_KEY, 'hard');
  window.localStorage.setItem(SPEED_STORAGE_KEY, '2');
  for (const key of [READY_SEEN_STORAGE_KEY, READY_CARD_STORAGE_KEY, TIPS_STORAGE_KEY]) {
    window.localStorage.removeItem(key);
  }
  const body = new DOMParser().parseFromString(page, 'text/html').body;
  document.body.replaceChildren(...body.children);
  const start = new URL(location.href);
  start.search = '?mode=bo3&fmt=showdown&step=lineup&la=storm,venom,quake';
  history.replaceState(null, '', start);
  await import('../main.ts');
  await settle();

  // A Showdown on Hard, as the bug was found: the ready moment and rounds 1 and 2 mid-fight.
  button('Reveal lineups').click();
  await settle();
  visible('.answer-step .pick-row-pick')[0]?.click();
  for (let round = 1; round <= 2; round += 1) {
    const where = `series round ${String(round)}`;
    await until(() => visible('.ready-card').length === 1, 10_000, false);
    await checkCourt(`${where} ready`);
    await checkFight(where);
    await checkOpened(`${where} legend`, visible('#series .symbol-legend-toggle')[0]);
    await checkOpened(`${where} track`, visible('#series .series-bar-score')[0]);
    await until(() => phase() !== 'playing', 90_000);
    await settle();
    if (phase() === 'finished') break;
    const pick = visible('#series .pick-row-pick')[0];
    if (pick !== undefined) await click(pick);
    else await click(button(visible('#series .hud-button-primary')[0]?.textContent ?? ''));
  }

  // Free play: a new pairing's ready card, the fight and the result.
  await open('?view=pick&a=venom&b=titan');
  await click(button('Start match'));
  await until(() => visible('.ready-card').length === 1, 10_000, false);
  await checkCourt('Free play ready');
  await checkFight('Free play');
  await until(() => visible('.match-story').length === 1, 90_000);
  await settle();
  await checkCourt('Free play result');
}
