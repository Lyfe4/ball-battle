// Every beside-layout screen on a phone turned sideways (both landscape projects: 812 x 375 and
// 667 x 320, ADR 0067 addendum of 2026-11-22) opens at its top: at scroll position 0 nothing of it
// is cut off above the screen, and everything is reachable by scrolling. A round screen whose
// action took focus once scrolled the page and sliced its header and track off at the top edge.
// Free play's picker shows a whole row of tiles above Start match, which never covers a tile.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { button, frames, settle, tossed, until, visible } from './page-support.ts';

const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });

/** The parts of the panel a player sees: drawn, not hidden. */
function shownParts(): Element[] {
  const hud = document.querySelector('.hud');
  return [...(hud?.querySelectorAll('*') ?? [])].filter(
    (part) => part.getClientRects().length > 0 && part.closest('[hidden]') === null,
  );
}

/** At scroll position 0: nothing cut off above the screen, everything within the page's scroll. */
async function checkTop(where: string): Promise<void> {
  await frames(2);
  const hud = document.querySelector('.hud');
  const boxes = shownParts().map((part) => part.getBoundingClientRect());
  const top = Math.min(...boxes.map((b) => b.top));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  const hudBox = hud?.getBoundingClientRect();
  expect({
    where,
    scrollY: window.scrollY,
    panelScroll: hud?.scrollTop ?? 0,
    topVisible: top >= 0 && (hudBox?.top ?? 0) >= 0,
    reachable:
      bottom <= document.documentElement.scrollHeight + 1 ||
      hud?.scrollHeight !== hud?.clientHeight,
    sideways: document.documentElement.scrollWidth > window.innerWidth,
  }).toStrictEqual({
    where,
    scrollY: 0,
    panelScroll: 0,
    topVisible: true,
    reachable: true,
    sideways: false,
  });
}

/** Free play's picker: a whole first row of tiles above Start match, which covers none. */
async function checkPicker(): Promise<void> {
  const start = button('Start match').closest('.screen-footer') ?? button('Start match');
  const tiles = visible('.quick-setup .ball-tile');
  const firstTop = Math.min(...tiles.map((tile) => tile.getBoundingClientRect().top));
  const firstRow = tiles.filter(
    (tile) => Math.abs(tile.getBoundingClientRect().top - firstTop) < 2,
  );
  const footer = start.getBoundingClientRect();
  const above = firstRow.filter((tile) => {
    const b = tile.getBoundingClientRect();
    return b.top >= 0 && b.bottom <= footer.top && b.bottom <= window.innerHeight;
  });
  expect(above.length, 'a whole row of tiles above Start match').toBe(firstRow.length);
  // Start match covers no tile, at the top, halfway and at the end of the page.
  const max = document.documentElement.scrollHeight - window.innerHeight;
  for (const y of [0, max / 2, max]) {
    window.scrollTo(0, y);
    await frames(2);
    const f = start.getBoundingClientRect();
    const covered = tiles.filter((tile) => {
      const b = tile.getBoundingClientRect();
      return b.left < f.right && f.left < b.right && b.top < f.bottom && f.top < b.bottom;
    });
    expect(
      covered.map((tile) => tile.textContent),
      `covered at ${String(y)}`,
    ).toStrictEqual([]);
  }
  window.scrollTo(0, 0);
}

describe('beside screens on a phone turned sideways', () => {
  it('each opens at its top, everything reachable, the picker with a row above Start', async () => {
    window.localStorage.setItem(BOT_LEVEL_STORAGE_KEY, 'normal');
    window.localStorage.setItem(SPEED_STORAGE_KEY, '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    history.replaceState(null, '', location.pathname);
    await import('../main.ts');
    await settle();
    await checkTop('home');

    await click(button('Free play'));
    await settle();
    await checkTop('Free play picker');
    await checkPicker();

    await click(visible('.screen-back')[0] ?? document.body);
    await settle();
    // The vs Bot setup, as an old link opens it (the Play tab's sheet sets rules in place).
    const setupEntry: unknown = history.state;
    history.pushState(setupEntry, '', `${location.pathname}?mode=bo3&fmt=reveal`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: setupEntry }));
    await settle();
    await checkTop('vs Bot setup');
    await click(button('Choose lineup'));
    await settle();
    await checkTop('lineup');

    // A Showdown round, then the round screen it ends on.
    // Opened as a Back or Forward to it would (consistency-flow.ts's open).
    const entry: unknown = history.state;
    history.pushState(
      entry,
      '',
      `${location.pathname}?mode=bo3&fmt=showdown&step=lineup&la=storm,venom,quake`,
    );
    window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
    await settle();
    button('Reveal lineups').click();
    await settle();
    await tossed();
    visible('.answer-step .pick-row-pick')[0]?.click();
    await until(() => visible('.ready-card').length === 1, 10_000, 'the ready card', false);
    await click(button('Fight!'));
    await settle();
    await checkTop('a round');
    const phase = () => document.querySelector<HTMLElement>('#series')?.dataset['phase'];
    await until(() => phase() !== 'playing', 90_000, 'the round to end', false);
    await until(
      () => document.getElementById('stage')?.hasAttribute('data-round-over') === true,
      10_000,
      'the round screen',
      false,
    );
    await settle();
    await checkTop('the round screen');
  }, 180_000);
});
