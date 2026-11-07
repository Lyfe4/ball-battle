// The settings gear on a screen (ADR 0040, 0044): one per screen; its menu opens fully inside the
// visible screen and closes by the gear, Close, Escape and a tap outside, with focus back on the
// gear each time. With a court on screen it stays off the court (always on a desktop), or the
// match is paused while it covers it and resumes on close.
import { expect } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import { settle, visible } from './page-support.ts';
import { notePanelLook } from './look-checks.ts';

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** A press at a point of the element marked `data-press-here`: a tap on touch, else a click. */
    pressAt: (x: number, y: number, touch: boolean) => Promise<void>;
  }
}

const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });

const DESKTOP = '(min-width: 64rem) and (min-aspect-ratio: 5/4)';

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, label, [tabindex], canvas';

/** A spot on screen that is no control, not the menu or gear and not the court: "outside". */
function emptySpot(panel: HTMLElement, gear: HTMLElement): { x: number; y: number } {
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  for (let y = height - 6; y > 6; y -= 23) {
    for (let x = 6; x < width - 6; x += 29) {
      const hit = document.elementFromPoint(x, y);
      if (hit === null || panel.contains(hit) || gear.contains(hit)) continue;
      if (hit.closest(FOCUSABLE) !== null || hit.closest('.arena-container') !== null) continue;
      return { x, y };
    }
  }
  throw new Error('No empty spot to tap');
}

/** Presses the page at a viewport point, as a finger or a mouse would. */
async function pressAt(x: number, y: number): Promise<void> {
  const hit = document.elementFromPoint(x, y);
  if (!(hit instanceof Element)) throw new Error('Nothing at the point');
  const box = hit.getBoundingClientRect();
  hit.setAttribute('data-press-here', '');
  try {
    await commands.pressAt(x - box.left, y - box.top, navigator.maxTouchPoints > 0);
  } finally {
    hit.removeAttribute('data-press-here');
  }
  await settle();
}

/** The drawn court, when one is on screen. */
function courtBox(): DOMRect | undefined {
  const canvas = document.getElementById('arena');
  if (canvas?.closest('[hidden]') !== null) return undefined;
  if (getComputedStyle(canvas.parentElement ?? canvas).display === 'none') return undefined;
  const box = canvas.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? box : undefined;
}

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

const frameOf = () => (document.getElementById('arena') as HTMLCanvasElement | null)?.toDataURL();

/** True when the court's picture changes within `ms`. */
async function courtMoves(ms: number): Promise<boolean> {
  const before = frameOf();
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (frameOf() !== before) return true;
  }
  return false;
}

/**
 * The gear on screen, opened and closed every way. `fight` is set mid-fight: then the menu must
 * keep off the court, or the match must stand still while it covers it and move again on close.
 */
export async function checkSettings(where: string, fight = false): Promise<void> {
  const gears = visible('.settings-toggle');
  expect(gears, where).toHaveLength(1);
  const [gear] = gears;
  if (gear === undefined) return;
  const panel = () => document.getElementById(gear.getAttribute('aria-controls') ?? '');
  const isOpen = () => gear.getAttribute('aria-expanded') === 'true' && panel()?.hidden === false;
  const closed = () => ({ where, open: isOpen(), focus: document.activeElement === gear });
  const shut = { where, open: false, focus: true };

  await click(gear);
  expect(isOpen(), where).toBe(true);
  const box = panel()?.getBoundingClientRect();
  const screen = window.visualViewport;
  const inside =
    box !== undefined &&
    box.left >= 0 &&
    box.top >= (screen?.offsetTop ?? 0) &&
    box.right <= document.documentElement.clientWidth &&
    box.bottom <= (screen?.offsetTop ?? 0) + (screen?.height ?? window.innerHeight);
  expect({ where, inside }).toStrictEqual({ where, inside: true });
  notePanelLook(`settings: ${where}`, panel());

  const court = courtBox();
  if (court !== undefined && box !== undefined) {
    const covers = overlaps(box, court);
    // On a desktop the menu sits over the side panel, never the court.
    if (window.matchMedia(DESKTOP).matches)
      expect({ where, covers }).toStrictEqual({ where, covers: false });
    if (fight) {
      // Covering the court pauses the match; clear of it, the match plays on.
      expect({ where, covers, moves: await courtMoves(covers ? 700 : 3000) }).toStrictEqual({
        where,
        covers,
        moves: !covers,
      });
    }
  }
  await click(gear);
  expect(isOpen(), where).toBe(false);
  if (fight && court !== undefined) {
    expect({ where, resumed: await courtMoves(3000) }).toStrictEqual({ where, resumed: true });
  }

  await click(gear);
  const close = panel()?.querySelector<HTMLElement>('.settings-close');
  if (close !== null && close !== undefined) await click(close);
  expect(closed()).toStrictEqual(shut);

  await click(gear);
  await userEvent.keyboard('{Escape}');
  expect(closed()).toStrictEqual(shut);

  // A tap outside, on nothing in particular: closed, and focus back on the gear.
  await click(gear);
  const openPanel = panel();
  if (openPanel === null) throw new Error(`${where}: no panel`);
  const spot = emptySpot(openPanel, gear);
  await pressAt(spot.x, spot.y);
  expect(closed()).toStrictEqual(shut);
}
