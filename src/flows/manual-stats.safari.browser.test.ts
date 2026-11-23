// Every stat the manual shows is a whole number (2026-11-23: the Vampire's speed read
// "750–1012.5000000000001", and the long number squashed its bar), measured on a phone at
// 390 x 664: each value is digits (or a range of two), never a decimal or "e" notation, and
// every bar is as wide as every other, whatever number sits beside it.
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

/** A whole number, or a range of two ("750–1013"). */
const WHOLE = /^\d+(?:–\d+)?$/;

describe('the manual’s stats', () => {
  it('are whole numbers on every ball, and every bar keeps its width', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?view=manual';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();
    const wrong: string[] = [];
    const widths = new Set<number>();
    for (const ball of BALLS) {
      await open(`?view=manual&ball=${ball.id}`);
      const numbers = [...document.querySelectorAll<HTMLElement>('.ball-detail-number')];
      const bars = [...document.querySelectorAll<HTMLElement>('.ball-detail-bar')];
      expect(numbers, ball.id).toHaveLength(3);
      for (const number of numbers) {
        const text = number.textContent.trim();
        if (!WHOLE.test(text)) wrong.push(`${ball.id}: ${text}`);
        // The whole number fits its place, never cut or spilling over.
        if (number.scrollWidth > number.clientWidth) wrong.push(`${ball.id}: ${text} overflows`);
      }
      for (const bar of bars) widths.add(Math.round(bar.getBoundingClientRect().width));
    }
    expect(wrong).toStrictEqual([]);
    // One width for every bar of every ball: a longer number never squeezes its bar.
    expect([...widths]).toHaveLength(1);
    expect([...widths][0]).toBeGreaterThan(80);
  }, 90_000);
});
