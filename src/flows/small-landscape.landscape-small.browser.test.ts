// The smallest common phone turned sideways in Safari (667 x 320 with touch, the
// browsers-landscape-small project, ADR 0067 addendum of 2026-11-22): an iPhone SE's width and an
// iPhone 13's height once Safari's bar at the top and the safe areas are taken off. On a real
// iPhone 13 the ready card's longest lines ran off its right edge, the card spilled past the court
// and Free play's picker scrolled inside a box that cut tiles in half. Here: a strong pairing's
// card whole inside the court with no line wider than its box, the ability caption (its title in
// the ball's colour) and its ring in the tip's cream, settings' headings and rows, and Free
// play's picker scrolling the page.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { atRest, button, settle, until, visible } from './page-support.ts';

const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });

const box = (node: Element | null | undefined) => {
  if (node === null || node === undefined) throw new Error('Missing part');
  return node.getBoundingClientRect();
};

/** Parts of `root` (itself included) whose content is wider than their own box: clipped text. */
function tooWide(root: Element): string[] {
  return [root, ...root.querySelectorAll('*')]
    .filter((part) => part.clientWidth > 0 && part.scrollWidth > part.clientWidth + 1)
    .map((part) => `${part.className} (${String(part.scrollWidth)} > ${String(part.clientWidth)})`);
}

/** Boxes inside the page that scroll on their own: none on a setup screen. */
function innerScrollers(): string[] {
  return [...document.querySelectorAll<HTMLElement>('body *')]
    .filter((part) => {
      const overflow = getComputedStyle(part).overflowY;
      return /auto|scroll/.test(overflow) && part.scrollHeight > part.clientHeight + 1;
    })
    .map((part) => part.className);
}

describe('the smallest phone turned sideways', () => {
  it('fits the ready card, the caption, settings and the picker', async () => {
    window.localStorage.setItem(SPEED_STORAGE_KEY, '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    // The pairing from the iPhone 13: a strong counter, the longest edge line.
    start.search = '?a=archer&b=necromancer';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    // The card: whole inside the court, and no line wider than its box.
    await until(() => visible('.ready-card').length === 1, 10_000, 'the ready card', false);
    const card = visible('.ready-card')[0];
    await atRest(() => JSON.stringify(box(card)));
    expect(card?.querySelector('.ready-edge')?.textContent).toBe(
      '▲▲ Necromancer is strongly favoured',
    );
    const court = box(document.getElementById('arena'));
    const c = box(card);
    expect({
      inside: c.top >= court.top && c.bottom <= court.bottom,
      across: c.left >= court.left && c.right <= court.right,
      clipped: card === undefined ? ['no card'] : tooWide(card),
    }).toStrictEqual({ inside: true, across: true, clipped: [] });
    // Hide tips is a compact secondary beside Fight! (ADR 0086), on one row inside the card. The
    // sticker is tilted, so the row is read from the layout's own boxes, not the drawn ones.
    const hide = button('Hide tips');
    const fight = button('Fight!');
    const middle = (node: HTMLElement) => node.offsetTop + node.offsetHeight / 2;
    expect({
      row: Math.abs(middle(hide) - middle(fight)) < 2,
      apart: fight.offsetLeft - (hide.offsetLeft + hide.offsetWidth) >= 12,
      inside:
        hide.getBoundingClientRect().left >= c.left &&
        fight.getBoundingClientRect().right <= c.right,
    }).toStrictEqual({ row: true, apart: true, inside: true });

    // The caption and its ring appear together (its title in the ball's colour, the ring in the
    // tip's cream), the caption's ball drawn beside its title, and the caption whole on screen,
    // inside the panel.
    await click(button('Fight!'));
    await until(
      () => visible('#arena-caption')[0]?.textContent.includes(':') === true,
      30_000,
      'a caption',
      false,
    );
    const caption = visible('#arena-caption')[0];
    const title = caption?.querySelector<HTMLElement>('.arena-caption-title');
    const ring = visible('.tip-ring')[0];
    expect(ring, 'the ring shows with the caption').toBeDefined();
    const titleColor = getComputedStyle(title ?? document.body).color;
    expect(titleColor).not.toBe(getComputedStyle(caption ?? document.body).color);
    // The ring wears the tip's own cream, the colour of the caption's "i" (ADR 0036 addendum).
    const cream = getComputedStyle(caption?.querySelector('.tip-i') ?? document.body);
    expect(getComputedStyle(ring ?? document.body).borderTopColor).toBe(cream.backgroundColor);
    expect(caption?.querySelector('canvas.arena-caption-mark')).not.toBeNull();
    // Measured once its entrance (a few pixels of slide) is over: its own animations finished, not
    // a still box, which it also is for a frame or two before the slide starts.
    await Promise.all(caption?.getAnimations().map((animation) => animation.finished) ?? []);
    const hud = box(document.querySelector('.hud'));
    const cap = box(caption);
    expect({
      onScreen: cap.top >= 0 && cap.bottom <= window.innerHeight,
      inPanel: cap.bottom <= hud.bottom + 1,
      clipped: caption === undefined ? ['no caption'] : tooWide(caption),
    }).toStrictEqual({ onScreen: true, inPanel: true, clipped: [] });

    // Settings: inside the screen; the group headings differ from the rows, the rows share a look.
    await click(button('Settings'));
    await settle();
    const panel = visible('.settings-panel')[0];
    const p = box(panel);
    expect(p.top >= 0 && p.left >= 0 && p.right <= window.innerWidth).toBe(true);
    const look = (part: Element | null | undefined) => {
      const style = getComputedStyle(part ?? document.body);
      return `${style.color} ${style.fontWeight} ${style.fontSize}`;
    };
    const rows = [
      panel?.querySelector('.settings-speed .segmented-label'),
      panel?.querySelector('.settings-sound-label'),
      ...(panel?.querySelectorAll('.settings-switch') ?? []),
    ];
    expect(new Set(rows.map(look)).size, 'every row label looks the same').toBe(1);
    const headings = [...(panel?.querySelectorAll('.settings-heading') ?? [])];
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) expect(look(heading)).not.toBe(look(rows[0]));
    await click(button('Close'));
    await settle();

    // Free play's picker: the page scrolls, not a box beside an empty court, and every name keeps
    // to one line.
    await click(button('Change balls'));
    await settle();
    await until(() => visible('.ball-tile').length > 0, 10_000, 'the ball grid', false);
    expect(innerScrollers()).toStrictEqual([]);
    const arena = document.querySelector('.arena-container');
    expect(getComputedStyle(arena ?? document.body).display, 'no court behind it').toBe('none');
    expect(document.documentElement.scrollHeight).toBeGreaterThan(window.innerHeight);
    const twoLines = visible('.ball-tile-name').filter((name) => {
      const range = document.createRange();
      range.selectNodeContents(name);
      return range.getClientRects().length > 1;
    });
    expect(twoLines.map((name) => name.textContent)).toStrictEqual([]);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  }, 120_000);
});
