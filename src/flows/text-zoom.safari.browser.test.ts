// Text at 200% on a phone (WCAG 1.4.4, 2026-11-27): with the page's text twice its size, every
// screen where nothing fights still fits its width, with no sideways scroll; words wrap instead.
// The viewport is never resized in a test, so the text grows instead, as a browser's text zoom
// does.
import { afterAll, describe, expect, it } from 'vitest';
import { FRAME_SCREENS } from './frame-anchors-flow.ts';
import { settle, until } from './page-support.ts';
import { follow, onScreen, openAs, screenOn } from './shell-routes-support.ts';

afterAll(() => {
  document.documentElement.style.fontSize = '';
});

describe('text at 200% on a phone', () => {
  it('leaves no screen scrolling sideways', { timeout: 60_000 }, async () => {
    await openAs({ online: true, accounts: true }, '');
    await onScreen('home');
    document.documentElement.style.fontSize = '200%';
    await document.fonts.ready;
    const wide: string[] = [];
    for (const [name, search, screen] of FRAME_SCREENS) {
      if (search !== '') await follow(search);
      await until(() => screenOn() === screen, 5_000, name, false);
      await settle();
      const page = document.scrollingElement ?? document.documentElement;
      if (page.scrollWidth > page.clientWidth + 1) {
        const over = [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((node) => node.getBoundingClientRect().right > page.clientWidth + 1)
          .slice(0, 3)
          .map((node) => `${node.tagName.toLowerCase()}.${node.className}`);
        wide.push(
          `${name}: ${String(page.scrollWidth)} > ${String(page.clientWidth)} (${over.join(', ')})`,
        );
      }
    }
    expect(wide).toStrictEqual([]);
  });
});
