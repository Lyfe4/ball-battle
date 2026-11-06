// The real page in a real browser (`pnpm test:browsers`), at desktop size (the browsers-wide
// project, 1280 x 800): screens with nothing fighting use the width rather than a phone column
// (ADR 0031). No content scrolls inside a box of its own, where an overlay scrollbar would sit on
// top of it; every ball's manual entry fits the screen; the pickers set the grid beside the picks.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { BALLS } from '../sim/balls/index.ts';
import { settle, visible } from './page-support.ts';

/** Opens a link inside the page, as a Back or Forward to it would. */
async function open(search: string): Promise<void> {
  const entry: unknown = history.state;
  history.pushState(entry, '', `${location.pathname}${search}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
  await settle();
}

/** Every visible element whose content overflows a scroll box of its own. */
function innerScrollers(): string[] {
  return visible('#stage, #stage *')
    .filter((node) => {
      const style = getComputedStyle(node);
      const scrolls = /auto|scroll/.test(`${style.overflowX} ${style.overflowY}`);
      return (
        scrolls &&
        (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)
      );
    })
    .map((node) => node.className);
}

function box(selector: string): DOMRect {
  const node = visible(selector)[0];
  if (node === undefined) throw new Error(`Nothing visible for ${selector}`);
  return node.getBoundingClientRect();
}

describe('desktop layouts', () => {
  it('use the width, with no inner scroll boxes, and fit a manual entry on screen', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?view=manual';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    const screens = [
      '?view=manual',
      '?view=manual&tab=chart',
      '?view=pick&a=speedster&b=archer',
      '?mode=bo3',
      '?mode=bo3&fmt=blind&step=lineup',
      ...BALLS.map((ball) => `?view=manual&ball=${ball.id}`),
    ];
    for (const search of screens) {
      await open(search);
      expect({ search, scrollers: innerScrollers() }).toStrictEqual({ search, scrollers: [] });
    }

    // Each entry, the longest included, fits 1280 x 800 without scrolling the page.
    for (const ball of BALLS) {
      await open(`?view=manual&ball=${ball.id}`);
      const height = document.documentElement.scrollHeight;
      expect({ ball: ball.id, fits: height <= window.innerHeight }).toStrictEqual({
        ball: ball.id,
        fits: true,
      });
    }

    // The pickers: the grid beside what is picked, not under it.
    await open('?view=pick&a=speedster&b=archer');
    expect(box('.quick-setup .ball-grid').left).toBeGreaterThanOrEqual(box('.quick-slots').right);
    await open('?mode=bo3&fmt=blind&step=lineup');
    expect(box('.lineup-step .ball-grid').left).toBeGreaterThanOrEqual(box('.lineup-tray').right);
  });
});
