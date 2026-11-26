// The privacy policy and terms on a phone (390 x 664, ADR 0069; 2026-11-27): each page, drawn with
// its own stylesheet, has no serious or critical axe finding and no sideways scroll, also with its
// text at 200%.
import { afterEach, describe, expect, it } from 'vitest';
import './legal.css';
import privacy from '../../privacy.html?raw';
import terms from '../../terms.html?raw';
import { check, linesOf, serious } from '../flows/a11y-flow.ts';

afterEach(() => {
  document.documentElement.style.fontSize = '';
  document.body.replaceChildren();
});

/** The page's body and title in this document, as the browser would show it. */
function show(html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.title = parsed.title;
  document.documentElement.lang = parsed.documentElement.lang;
  document.body.replaceChildren(...parsed.body.children);
}

/** What runs past the page's width, if anything: none means no sideways scroll. */
const sideways = (): string[] => {
  const page = document.scrollingElement ?? document.documentElement;
  if (page.scrollWidth <= page.clientWidth + 1) return [];
  return [...document.querySelectorAll<HTMLElement>('body *')]
    .filter((node) => node.getBoundingClientRect().right > page.clientWidth + 1)
    .slice(0, 3)
    .map(
      (node) =>
        node.tagName.toLowerCase() + '.' + node.className + ' ' + node.textContent.slice(0, 40),
    );
};

describe.each([
  ['the privacy policy', privacy],
  ['the terms', terms],
])('%s on a phone', (name, html) => {
  it('has no serious or critical axe finding and fits the width, also at 200%', async () => {
    show(html);
    await document.fonts.ready;
    const found = await check(name);
    expect(serious(found), linesOf(found)).toStrictEqual([]);
    expect(sideways()).toStrictEqual([]);
    document.documentElement.style.fontSize = '200%';
    expect(sideways()).toStrictEqual([]);
  });
});
