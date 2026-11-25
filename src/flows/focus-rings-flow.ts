// Focus rings for the keyboard only (ADR 0086, input-modality.ts), with real taps on a touch phone.
// A script still moves focus (Play on arrival, the sheet's title, the box when the sheet closes),
// but after a tap no element on the page draws a ring, in any engine: WebKit, iPhone Safari's,
// calls a script's focus visible after a tap, which is what rang the sheet's chosen option and
// Play. The keyboard still gets its rings: Tab after the taps rings what it reaches, and Escape
// rings the box it returns to.
import { expect } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import { settle, until, visible } from './page-support.ts';
import { onScreen, openAs } from './shell-routes-support.ts';

declare module 'vitest/browser' {
  interface BrowserCommands {
    tap: (selector: string) => Promise<void>;
  }
}

const sheet = () => {
  const found = document.querySelector('dialog.play-sheet');
  if (!(found instanceof HTMLDialogElement)) throw new Error('No sheet');
  return found;
};

/** The focus colour as the browser computes it (rgb), read from the tokens. */
function focusColour(): string {
  const probe = document.createElement('span');
  probe.style.color = 'var(--color-focus)';
  document.body.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

/**
 * Every element on screen drawing a focus ring now: the --focus-ring halo (its outer 6 px in the
 * focus colour; a chosen option's ring is another shape), or the browser's outline on the focused
 * element (a chosen option's outline is its own look, not focus).
 */
function ringed(): string[] {
  const halo = `${focusColour()} 0px 0px 0px 6px`;
  return [...document.querySelectorAll<HTMLElement>('*')]
    .filter((node) => node.getClientRects().length > 0 && node.closest('[hidden]') === null)
    .filter((node) => {
      const style = getComputedStyle(node);
      const outline =
        node === document.activeElement &&
        style.outlineStyle !== 'none' &&
        Number.parseFloat(style.outlineWidth) > 0 &&
        node.getAttribute('aria-pressed') !== 'true';
      return style.boxShadow.includes(halo) || outline;
    })
    .map((node) => `${node.tagName.toLowerCase()}.${node.className}`);
}

/** The element focus is on, named. */
const focused = () => {
  const node = document.activeElement;
  return node === null ? 'none' : `${node.tagName.toLowerCase()}.${node.className}`;
};

export async function checkFocusRings(): Promise<void> {
  await openAs({ online: true, accounts: false }, '');
  await onScreen('home');

  // Play on arrival: focused for the keyboard, ringed for nobody.
  const play = visible('.home-play')[0];
  expect(document.activeElement, 'Play is focused on arrival').toBe(play);
  expect(ringed(), 'nothing rings on arrival').toStrictEqual([]);

  // A tap on the box opens the sheet: focus on its title, and no ring anywhere.
  await commands.tap('.play-box');
  await until(() => sheet().open, 2_000, 'the sheet to open', false);
  await settle();
  expect(document.activeElement?.id, 'the sheet focuses its title').toBe('play-sheet-title');
  expect(ringed(), 'nothing rings after a tap opens the sheet').toStrictEqual([]);

  // A tap on a choice: it is chosen, and still nothing rings.
  await commands.tap('dialog.play-sheet [role="group"]:not([hidden]) button[aria-pressed="false"]');
  await settle();
  expect(ringed(), 'nothing rings after a tap on a choice').toStrictEqual([]);

  // The keyboard: Tab rings what it reaches.
  await userEvent.keyboard('{Tab}');
  await settle();
  expect(ringed(), `Tab rings what it reaches (${focused()})`).toHaveLength(1);
  // Escape closes the sheet; focus is back on the box, ringed for the keyboard that closed it.
  await userEvent.keyboard('{Escape}');
  await until(() => !sheet().open, 2_000, 'the sheet to close', false);
  await settle();
  expect(focused()).toContain('play-box');
  expect(ringed(), 'the box rings after Escape').toHaveLength(1);

  // A tap elsewhere, then back to Play by taps: Play is focused on arrival again, with no ring.
  await commands.tap('nav.tab-bar a[data-tab="balls"]');
  await onScreen('manual');
  await settle();
  expect(ringed(), 'nothing rings on Balls after a tap').toStrictEqual([]);
  await commands.tap('nav.tab-bar a[data-tab="play"]');
  await onScreen('home');
  await settle();
  expect(document.activeElement, 'Play is focused on arrival again').toBe(visible('.home-play')[0]);
  expect(ringed(), 'nothing rings on Play after taps').toStrictEqual([]);

  // And a key afterwards rings what it reaches.
  await userEvent.keyboard('{Tab}');
  await settle();
  expect(ringed(), `a key rings again (${focused()})`).toHaveLength(1);
}
