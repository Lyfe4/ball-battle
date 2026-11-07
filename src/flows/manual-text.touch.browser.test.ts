// Every ball's description fits in two lines on a phone (ADR 0041), measured where it is longest
// to read: the manual's ball page at 375 x 812, beside the ball's drawing, with 12 px to spare.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { BALLS } from '../sim/balls/index.ts';
import { settle } from './page-support.ts';

async function open(search: string): Promise<void> {
  const entry: unknown = history.state;
  history.pushState(entry, '', `${location.pathname}${search}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
  await settle();
}

describe('ball descriptions', () => {
  it('fit in two lines on a phone', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?view=manual';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();
    const long: string[] = [];
    for (const ball of BALLS) {
      await open(`?view=manual&ball=${ball.id}`);
      const text = document.querySelector<HTMLElement>('.ball-detail-description');
      if (text === null) throw new Error(`No description for ${ball.id}`);
      // With 12 px to spare: text metrics differ a little between systems (Linux CI wrapped one).
      text.style.width = '';
      text.style.flex = '';
      text.style.width = `${String(text.getBoundingClientRect().width - 12)}px`;
      text.style.flex = 'none';
      const style = getComputedStyle(text);
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      if (Math.round(text.getBoundingClientRect().height / line) > 2) long.push(ball.id);
    }
    expect(long).toStrictEqual([]);
  }, 60_000);
});
