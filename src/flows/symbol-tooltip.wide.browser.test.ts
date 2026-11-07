// The real page in a real browser (`pnpm test:browsers`): hovering a matchup mark with a mouse, or
// moving keyboard focus onto a control that shows one, names both balls and who has the edge
// (ADR 0037); a click on a tile still picks it, and a click on a symbol outside a control explains
// it in the legend's words. Taps on a touch phone are in pick-badges.touch.browser.test.ts. Runs
// at desktop size (the browsers-wide project).
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { matchupTip } from '../ui/balls/matchups.ts';
import { markSymbol } from '../ui/symbol-tooltip.ts';
import { SYMBOLS } from '../ui/symbols.ts';
import { settle, visible } from './page-support.ts';

const lines = () =>
  visible('.symbol-tooltip').flatMap((tip) => [...tip.children].map((line) => line.textContent));
const nameOf = (id: string) => BALL_LOOKUP.get(id)?.name ?? id;

describe('the symbol tooltip', () => {
  it('names both balls and the edge on hover and focus; a click on a tile still picks', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    // Free play's setup: the grid marks every ball against the Speedster in the other slot.
    start.search = '?view=pick&a=speedster&b=speedster';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    const marked = (lean: string) => {
      const mark = visible(`.ball-grid [data-symbol="${lean}"]`)[0];
      if (mark === undefined) throw new Error(`No ${lean} mark in the grid`);
      return mark;
    };
    const tileBall = (mark: HTMLElement) =>
      mark.closest<HTMLElement>('.ball-tile')?.dataset['ballId'] ?? '';
    expect(lines()).toStrictEqual([]);

    // A touch passing over a mark opens nothing.
    marked('unfavoured').dispatchEvent(
      new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }),
    );
    expect(lines()).toStrictEqual([]);

    // A mouse over a red ▼: "Frost vs Speedster: Speedster is favoured", then why.
    const weak = marked('unfavoured');
    await userEvent.hover(weak);
    await settle();
    expect(lines()).toStrictEqual([...matchupTip(tileBall(weak), 'speedster', nameOf, 'neutral')]);
    expect(lines()[0]).toBe(`${nameOf(tileBall(weak))} vs Speedster: Speedster is favoured`);
    const strong = marked('favoured');
    await userEvent.hover(strong);
    await settle();
    expect(lines()[0]).toBe(
      `${nameOf(tileBall(strong))} vs Speedster: ${nameOf(tileBall(strong))} is favoured`,
    );
    await userEvent.keyboard('{Escape}');
    expect(lines()).toStrictEqual([]);

    // Keyboard focus on a tile with one mark: the same words as hovering it.
    const tile = marked('unfavoured').closest('button');
    if (tile === null) throw new Error('The mark is not on a tile');
    await userEvent.keyboard('{Tab}');
    tile.focus();
    await settle();
    expect(tile.matches(':focus-visible')).toBe(true);
    expect(lines()).toStrictEqual([...matchupTip(tileBall(weak), 'speedster', nameOf, 'neutral')]);
    tile.blur();
    expect(lines()).toStrictEqual([]);

    // A click on a tile picks it (the slot fills), and explains nothing.
    const before = location.search;
    marked('unfavoured').click();
    await settle();
    expect(location.search).not.toBe(before);

    // A click on a symbol that is not part of a control explains it, in the legend's words.
    const loose = document.createElement('span');
    loose.textContent = '?';
    markSymbol(loose, 'unknown');
    document.body.append(loose);
    loose.click();
    expect(lines()).toStrictEqual([SYMBOLS.unknown.meaning]);
    loose.remove();
  });
});
