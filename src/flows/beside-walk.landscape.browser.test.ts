// Fixes from the owner's iPhone 13 sideways and the 2026-11-23 screen walk, at 812 x 375 and 667 x
// 320 (both landscape projects, ADR 0067):
//
// - home: the page scrolls, never a box inside it whose scroll bar clipped Play and the gear; its
//   top whole at scroll 0, the court its full size while the page scrolls, Free play and Ball
//   manual above the fold;
// - the manual's matchup chart: its bands use the column, every name on one line (first written
//   for the old chart's grid, which Free play's beside rules squeezed into three a row);
// - the lineup: a whole row of tiles with their names above the fold, and Reveal lineups, sticky
//   in its own column, covering no tile at the top, the middle or the end of the page;
// - the account: Done ends the page rather than sticking over the Friends section.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import type { FriendsResponse } from '../api/friends.ts';
import { callApi } from '../app/api.ts';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { signedInCard } from '../screens/account-text.ts';
import { createFriendsSection } from '../ui/online/friends-section.ts';
import { createNotice } from '../ui/notice.ts';
import { button, frames, settle, visible } from './page-support.ts';
import { tabLink } from './shell-routes-support.ts';

const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });
const box = (node: Element) => node.getBoundingClientRect();
const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Every tile `footer` covers, at the top, the middle and the end of the page. */
async function coveredTiles(tiles: readonly HTMLElement[], footer: Element): Promise<string[]> {
  const covered = new Set<string>();
  const max = document.documentElement.scrollHeight - window.innerHeight;
  for (const y of [0, max / 2, max]) {
    window.scrollTo(0, y);
    await frames(2);
    for (const tile of tiles) {
      if (overlaps(box(tile), box(footer))) covered.add(tile.textContent);
    }
  }
  window.scrollTo(0, 0);
  await frames(2);
  return [...covered];
}

describe('beside screens from the iPhone and the screen walk', () => {
  it('home scrolls the page, the chart and the lineup use the width', async () => {
    window.localStorage.setItem(BOT_LEVEL_STORAGE_KEY, 'normal');
    window.localStorage.setItem(SPEED_STORAGE_KEY, '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    history.replaceState(null, '', location.pathname);
    await import('../main.ts');
    await settle();

    // Home: no box of its own scrolling, its top whole, the court kept still by the page's scroll.
    const hud = document.querySelector<HTMLElement>('.hud');
    const court = document.querySelector<HTMLElement>('.arena-container');
    if (hud === null || court === null) throw new Error('no panel or court');
    expect({
      overflow: getComputedStyle(hud).overflowY,
      boxScrolls: hud.scrollHeight > hud.clientHeight + 1,
      top: box(hud).top >= 0,
    }).toStrictEqual({ overflow: 'visible', boxScrolls: false, top: true });
    // Play, Change rules and Free play on screen without a scroll (667 x 320 too).
    const play = visible('.home-play')[0] ?? document.body;
    expect(box(play).bottom, 'Play above the fold').toBeLessThanOrEqual(window.innerHeight);
    for (const name of ['Change rules', 'Free play']) {
      expect(box(button(name)).bottom, `${name} above the fold`).toBeLessThanOrEqual(
        window.innerHeight,
      );
    }
    // The page scrolls to the footer; the court keeps its size.
    const courtBefore = box(court);
    window.scrollTo(0, document.documentElement.scrollHeight);
    await frames(2);
    expect(box(court).height, 'the court keeps its size').toBeCloseTo(courtBefore.height, 0);
    window.scrollTo(0, 0);

    // The matchup chart: every ball against the one chosen, using the column.
    await click(tabLink('Balls'));
    await settle();
    await click(button('Matchup chart'));
    await settle();
    // (Replaced 2026-11-23 with the new chart: its bands span the column, no name wraps.)
    const spectrum = visible('.matchup-spectrum')[0];
    if (spectrum === undefined) throw new Error('no chart');
    const column = box(spectrum.closest('.manual') ?? spectrum);
    for (const band of visible('.spectrum-bands')) {
      expect(box(band).width, 'the bands span their column').toBeGreaterThan(column.width / 2);
    }
    const wrapped = visible('.spectrum-chip-name').filter(
      (name) => name.getClientRects().length > 1 || box(name).height > 24,
    );
    expect(wrapped.map((name) => name.textContent)).toStrictEqual([]);

    // The lineup: a whole first row with its names above the fold, Reveal lineups over no tile.
    const entry: unknown = history.state;
    history.pushState(
      entry,
      '',
      `${location.pathname}?mode=bo3&fmt=reveal&step=lineup&la=storm,venom,quake`,
    );
    window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
    await settle();
    const tiles = visible('.lineup-step .ball-tile');
    const footer = button('Reveal lineups').closest('.screen-footer') ?? button('Reveal lineups');
    const firstTop = Math.min(...tiles.map((tile) => box(tile).top));
    const firstRow = tiles.filter((tile) => Math.abs(box(tile).top - firstTop) < 2);
    const whole = firstRow.filter((tile) => {
      const name = tile.querySelector('.ball-tile-name');
      return (
        box(tile).top >= 0 &&
        box(tile).bottom <= window.innerHeight &&
        name !== null &&
        !overlaps(box(name), box(footer))
      );
    });
    expect(whole.length, 'a whole row of tiles with names').toBe(firstRow.length);
    expect(firstRow.length).toBeGreaterThanOrEqual(3);
    expect(await coveredTiles(tiles, footer)).toStrictEqual([]);
  }, 120_000);

  it('ends the account screen with Done rather than sticking it over the Friends section', async () => {
    const list: FriendsResponse = {
      code: '7KQ2M9XD',
      friends: [
        { id: 'f-1', name: 'Robin', status: 'online' },
        { id: 'f-2', name: 'Sam_R', status: 'offline' },
      ],
      incoming: [{ id: 'r-1', name: 'Jo_2' }],
      outgoing: [],
    };
    const send = () =>
      Promise.resolve(
        new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } }),
      );
    const friends = createFriendsSection({
      api: (method, path, body) => callApi(method, path, body, {}, send),
      line: () => 'offline',
      copy: () => Promise.resolve(true),
    });
    // The account screen as the page lays it out: the sign-in screen's stage and panel.
    const stage = document.createElement('main');
    stage.className = 'stage';
    stage.dataset['screen'] = 'signin';
    stage.toggleAttribute('data-setup', true);
    const hud = document.createElement('div');
    hud.className = 'hud';
    const root = document.createElement('section');
    hud.append(root);
    stage.append(hud);
    document.body.replaceChildren(stage);
    window.scrollTo(0, 0);
    const notice = createNotice(root, () => undefined);
    const actions = { logOut: () => Promise.resolve(), deleteAccount: () => undefined };
    notice.show(
      signedInCard(
        'Sam_1',
        () => undefined,
        () => undefined,
        actions,
        friends.element,
      ),
    );
    await friends.open();
    await frames(2);

    const done = button('Done').closest('.screen-footer') ?? button('Done');
    const field = root.querySelector('.friends-add-row') ?? root;
    const parts = [...root.querySelectorAll('.notice-body > *, .friends > *')].filter(
      (part) => part.getClientRects().length > 0 && !part.contains(done),
    );
    const max = document.documentElement.scrollHeight - window.innerHeight;
    for (const y of [0, max / 2, max]) {
      window.scrollTo(0, y);
      await frames(2);
      const under = parts.filter((part) => overlaps(box(part), box(done)));
      expect(
        under.map((part) => part.className),
        `covered at ${String(y)}`,
      ).toStrictEqual([]);
    }
    // Done comes after Add a friend, never over it.
    expect(box(done).top).toBeGreaterThanOrEqual(box(field).bottom);
  });
});
