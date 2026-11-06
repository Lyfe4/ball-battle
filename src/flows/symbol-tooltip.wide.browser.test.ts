// The real page in a real browser (`pnpm test:browsers`): hovering a symbol with a mouse, or moving
// keyboard focus onto a control that shows one, says what it means in the legend's own words. On
// touch, a held press on a control's symbol explains it without pressing the control, while a tap
// still presses it, and a tap on a symbol outside a control explains it (ADR 0035). Runs at
// desktop size (the browsers-wide project).
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { HOLD_MS, markSymbol } from '../ui/symbol-tooltip.ts';
import { SYMBOLS } from '../ui/symbols.ts';
import { settle, visible } from './page-support.ts';

const tooltip = () => visible('.symbol-tooltip').map((tip) => tip.textContent);

describe('the symbol tooltip', () => {
  it('shows on mouse hover, keyboard focus, a held press and a tap outside a control', async () => {
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

    // Touch: a held press on the tile's ▼ explains it, and the click that ends it picks nothing.
    const touch = (type: string, on: Element) => {
      const box = on.getBoundingClientRect();
      on.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerType: 'touch',
          clientX: box.x + 2,
          clientY: box.y + 2,
        }),
      );
    };
    const mark = marked('unfavoured');
    const before = location.search;
    touch('pointerdown', mark);
    await new Promise((resolve) => setTimeout(resolve, HOLD_MS + 100));
    expect(tooltip()).toStrictEqual([SYMBOLS.unfavoured.meaning]);
    touch('pointerup', mark);
    mark.click();
    await settle();
    expect(location.search).toBe(before);
    expect(tooltip()).toStrictEqual([SYMBOLS.unfavoured.meaning]);

    // A quick tap presses the tile as always (it is chosen), and explains nothing.
    const tapped = marked('unfavoured');
    touch('pointerdown', tapped);
    touch('pointerup', tapped);
    tapped.click();
    await settle();
    expect(location.search).not.toBe(before);

    // A tap on a symbol that is not part of a control explains it.
    const loose = document.createElement('span');
    loose.textContent = '▲';
    markSymbol(loose, 'favoured');
    document.body.append(loose);
    touch('pointerdown', loose);
    touch('pointerup', loose);
    expect(tooltip()).toStrictEqual([SYMBOLS.favoured.meaning]);
    loose.remove();
  });
});
