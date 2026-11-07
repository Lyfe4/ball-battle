// One flow through the real page (ADR 0038), run at phone (375 x 812), desktop (1280 x 800) and a
// full HD screen (1920 x 1080): the same screen state must look and behave the same everywhere. On
// every screen with a legend, the legend opens without pushing its ? out of reach and closes with
// the ?, its own Close and Escape. Every ready moment's card sits centred on the court, and Escape
// never starts the fight. Every "How it was won" is the one design: closed, led by the result.
import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { READY_CARD_STORAGE_KEY, READY_SEEN_STORAGE_KEY, TIPS_STORAGE_KEY } from '../app/tips.ts';
import { button, settle, until, visible } from './page-support.ts';

/** A real click; a control that can't be reached fails fast rather than at the test's timeout. */
const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });

const phase = () => document.querySelector<HTMLElement>('#series')?.dataset['phase'];

/** Opens a link inside the page, as a Back or Forward to it would. */
async function open(search: string): Promise<void> {
  const entry: unknown = history.state;
  history.pushState(entry, '', `${location.pathname}${search}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
  await settle();
}

const legendOpen = (toggle: HTMLElement) => toggle.getAttribute('aria-expanded') === 'true';

/** The ? on screen, opened: it stays on the page and every way of closing it works. */
async function checkLegend(where: string): Promise<void> {
  const toggles = visible('.symbol-legend-toggle');
  expect(toggles, where).toHaveLength(1);
  const [toggle] = toggles;
  if (toggle === undefined) return;
  const panel = () => document.getElementById(toggle.getAttribute('aria-controls') ?? '');
  const reachable = () => {
    const box = toggle.getBoundingClientRect();
    return { where, top: box.top + window.scrollY >= 0, left: box.left >= 0 };
  };

  // The ?, clicked as a player would: opened, it is still on the page, so it closes it again.
  await click(toggle);
  expect(legendOpen(toggle), where).toBe(true);
  expect(reachable()).toStrictEqual({ where, top: true, left: true });
  await click(toggle);
  expect(legendOpen(toggle), where).toBe(false);
  expect(panel()?.hidden, where).toBe(true);

  // The legend's own Close, at its end: closed, and focus back on the ?.
  await click(toggle);
  const close = panel()?.querySelector<HTMLElement>('.symbol-legend-close');
  expect(close, where).toBeTruthy();
  if (close !== null && close !== undefined) await click(close);
  expect(legendOpen(toggle), where).toBe(false);
  expect(document.activeElement, where).toBe(toggle);

  // Escape.
  await click(toggle);
  await userEvent.keyboard('{Escape}');
  expect(legendOpen(toggle), where).toBe(false);
}

/** The ready moment: its card centred on the court, and Escape leaves it waiting. */
async function checkReady(where: string): Promise<void> {
  await until(() => visible('.ready-card').length === 1, 10_000, false);
  const card = visible('.ready-card')[0]?.getBoundingClientRect();
  const court = document.getElementById('arena-container')?.getBoundingClientRect();
  if (card === undefined || court === undefined) throw new Error('No card or court');
  const centre = (box: DOMRect) => [box.left + box.width / 2, box.top + box.height / 2];
  const [cx = 0, cy = 0] = centre(card);
  const [ax = 0, ay = 0] = centre(court);
  expect({ where, x: Math.abs(cx - ax) <= 2, y: Math.abs(cy - ay) <= 2 }).toStrictEqual({
    where,
    x: true,
    y: true,
  });
  // Escape only closes things: the match still waits on Fight!.
  await userEvent.keyboard('{Escape}');
  await settle();
  expect(visible('.ready-card'), where).toHaveLength(1);
  await click(button('Fight!'));
  expect(visible('.ready-card'), where).toHaveLength(0);
}

/** "How it was won": closed, its summary the result (with `prefix`), and opened, one design. */
async function checkStory(where: string, prefix: RegExp): Promise<void> {
  const stories = visible('.match-story');
  expect(stories, where).toHaveLength(1);
  const story = stories[0];
  if (!(story instanceof HTMLDetailsElement)) throw new Error(`${where}: no story`);
  expect(story.open, where).toBe(false);
  expect(story.querySelector('.match-story-line')?.textContent, where).toMatch(prefix);
  expect(story.querySelector('.match-story-more')?.textContent, where).toBe('How it was won');
  const summary = story.querySelector('summary');
  if (summary !== null) await click(summary);
  expect(story.open, where).toBe(true);
  expect(story.querySelectorAll('.match-story-side'), where).toHaveLength(2);
  expect(story.querySelectorAll('ol.match-story-moments > li').length, where).toBeGreaterThan(0);
}

/**
 * A Reveal series against the Hard bot, set up and played live to its result (whatever the seed
 * makes of it: wins, losses, draws), then Free play and the manual.
 */
export async function runConsistencyFlow(): Promise<void> {
  window.localStorage.setItem(BOT_LEVEL_STORAGE_KEY, 'hard');
  window.localStorage.setItem(SPEED_STORAGE_KEY, '2');
  for (const key of [READY_SEEN_STORAGE_KEY, READY_CARD_STORAGE_KEY, TIPS_STORAGE_KEY]) {
    window.localStorage.removeItem(key);
  }
  const body = new DOMParser().parseFromString(page, 'text/html').body;
  document.body.replaceChildren(...body.children);
  const start = new URL(location.href);
  start.search = '?mode=bo3';
  history.replaceState(null, '', start);
  await import('../main.ts');
  await settle();

  visible('.rules-card')
    .find((card) => card.textContent.startsWith('Reveal'))
    ?.click();
  await settle();
  button('Hard bot').click();
  button('Choose lineup').click();
  await settle();
  for (const id of ['storm', 'berserker', 'brawler']) {
    visible('.ball-tile')
      .find((tile) => tile.dataset['ballId'] === id)
      ?.click();
  }
  button('Reveal lineups').click();
  await settle();

  // Round 1's pick: the same bar as every later pick, with what is played and the ?.
  expect(visible('.answer-step .series-bar-about')[0]?.textContent).toBe(
    'Best of 3 · Reveal · Hard',
  );
  await checkLegend('round 1 pick');
  visible('.answer-step .pick-row-pick')[0]?.click();

  for (let round = 1; ; round += 1) {
    await checkReady(`series round ${String(round)}`);
    await until(() => phase() !== 'playing', 90_000);
    await settle();
    const finished = phase() === 'finished';
    const where = finished ? 'series result' : `after round ${String(round)}`;
    await checkStory(where, /^Round \d: \S/);
    if (!finished && visible('#series .pick-row').length > 0) {
      expect(visible('#series .series-bar-about')[0]?.textContent, where).toBe(
        'Best of 3 · Reveal · Hard',
      );
    }
    // With the story open the panel is at its tallest.
    await checkLegend(where);
    if (finished) break;
    const pick = visible('#series .pick-row-pick')[0];
    if (pick !== undefined) await click(pick);
    else await click(button(visible('#series .hud-button-primary')[0]?.textContent ?? ''));
  }

  // Free play: the setup's legend, a new pairing's card, and the result's story (no round).
  await open('?view=pick&a=venom&b=titan');
  await checkLegend('Free play setup');
  await click(button('Start match'));
  await checkReady('Free play');
  await until(() => visible('.match-story').length === 1, 90_000);
  await checkStory('Free play result', /^(?!Round)\S/);

  await open('?view=manual');
  await checkLegend('manual');
}
