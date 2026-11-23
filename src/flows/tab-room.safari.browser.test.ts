// Every tab screen leaves room at its end for the tab bar and the phone's home bar (ADR 0081,
// requirement 1), at 390 x 664: scrolled to the end, its last item lies wholly above the bar. And
// every ball's name fits its tile on the Balls tab (requirement 2).
import { describe, expect, it } from 'vitest';
import { BALLS } from '../sim/balls/index.ts';
import { settle } from './page-support.ts';
import { follow, onScreen, openAs, screenOn, tabBar } from './shell-routes-support.ts';

/** The last thing a player can see on a screen: its last leaf element in document order with a size. */
function lastItem(root: Element): HTMLElement {
  const shown = [...root.querySelectorAll<HTMLElement>('*')].filter((node) => {
    if (node.closest('[hidden]') !== null || node.children.length > 0) return false;
    const box = node.getBoundingClientRect();
    return box.width > 1 && box.height > 1 && getComputedStyle(node).visibility !== 'hidden';
  });
  const last = shown.at(-1);
  if (last === undefined) throw new Error('Nothing shown');
  return last;
}

async function toEnd(): Promise<void> {
  window.scrollTo(0, document.documentElement.scrollHeight);
  await settle();
}

describe('room for the tab bar on a phone', () => {
  it.each([
    ['Play', '', 'home', '#home'],
    ['Balls', '?view=manual', 'manual', '#manual'],
    ['the matchup chart', '?view=manual&tab=chart', 'manual', '#manual'],
    ['Friends', '?view=friends', 'friends', '#online-friends'],
    ['Ranks', '?view=ranks', 'ranks', '#shell-screen'],
  ])('shows %s’s last item whole above the bar', async (_name, search, screen, root) => {
    if (screenOn() === undefined) await openAs({ online: true, accounts: true }, search);
    else await follow(search);
    await onScreen(screen);
    await toEnd();
    const bar = tabBar();
    if (bar === undefined) throw new Error('No tab bar');
    const top = bar.getBoundingClientRect().top;
    const container = document.querySelector(root);
    if (container === null) throw new Error(`No ${root}`);
    const last = lastItem(container);
    expect(
      last.getBoundingClientRect().bottom,
      `${last.tagName}.${last.className}`,
    ).toBeLessThanOrEqual(top);
    const box = last.getBoundingClientRect();
    expect(
      box.top,
      `${last.tagName}.${last.className} ${String(Math.round(box.height))} px tall`,
    ).toBeGreaterThanOrEqual(0);
  });

  it('fits every ball’s name in its tile on the Balls tab', async () => {
    await follow('?view=manual');
    await onScreen('manual');
    const names = [...document.querySelectorAll<HTMLElement>('#manual .ball-tile-name')].filter(
      (name) => name.closest('[hidden]') === null && name.getBoundingClientRect().width > 0,
    );
    expect(names.length).toBe(BALLS.length);
    const cut = names
      .filter((name) => name.scrollWidth > name.clientWidth)
      .map((name) => name.textContent);
    expect(cut).toStrictEqual([]);
  });
});
