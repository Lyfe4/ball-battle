// The real page in a real browser (`pnpm test:browsers`): hovering a symbol with a mouse, or moving
// keyboard focus onto a control that shows one, says what it means in the legend's own words. A
// touch adds nothing (ADR 0030).
import { describe, expect, it } from 'vitest';
import { page as browserPage, userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { SYMBOLS } from '../ui/symbols.ts';
import { settle, visible } from './page-support.ts';

const tooltip = () => visible('.symbol-tooltip').map((tip) => tip.textContent);

describe('the symbol tooltip', () => {
  it('shows on mouse hover and keyboard focus, and not on touch', async () => {
    await browserPage.viewport(1280, 800);
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
    expect(tooltip()).toStrictEqual([]);

    // A touch on a mark is a press: nothing new appears.
    marked('unfavoured').dispatchEvent(
      new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }),
    );
    expect(tooltip()).toStrictEqual([]);

    // A mouse over the red ▼: the legend's words for it.
    await userEvent.hover(marked('unfavoured'));
    await settle();
    expect(tooltip()).toStrictEqual([SYMBOLS.unfavoured.meaning]);
    await userEvent.hover(marked('favoured'));
    await settle();
    expect(tooltip()).toStrictEqual([SYMBOLS.favoured.meaning]);
    await userEvent.keyboard('{Escape}');
    expect(tooltip()).toStrictEqual([]);

    // Keyboard focus on a tile with a mark: the same words.
    const tile = marked('unfavoured').closest('button');
    if (tile === null) throw new Error('The mark is not on a tile');
    // Tab into the page, then put focus on the tile as the grid's arrow keys would.
    await userEvent.keyboard('{Tab}');
    tile.focus();
    await settle();
    expect(tile.matches(':focus-visible')).toBe(true);
    expect(tooltip()).toStrictEqual([SYMBOLS.unfavoured.meaning]);
    tile.blur();
    expect(tooltip()).toStrictEqual([]);
  });
});
