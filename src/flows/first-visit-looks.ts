// Looks the first-visit flow checks on the real page (first-visit-flow.ts): the lit answer's two
// rings breathing as one, and a fold's header filling in its card's shape.
import { expect } from 'vitest';

/**
 * The lit row and its ▲ mark breathe as one (coach.css): the same token, curve and direction,
 * started on the same frame; with reduced motion neither moves.
 */
export function checkGlowInStep(row: HTMLElement | undefined): void {
  const cell = row?.querySelector<HTMLElement>('.pick-row-badge[data-facing]');
  if (row === undefined || cell === null || cell === undefined) throw new Error('No lit mark');
  const glows = [row, cell].map((node) => node.getAnimations({ subtree: false }));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    expect(glows.flat(), 'still rings').toHaveLength(0);
    return;
  }
  const timing = (node: HTMLElement) => {
    const style = getComputedStyle(node);
    const [name, ...rest] = [
      style.animationName,
      style.animationDuration,
      style.animationTimingFunction,
      style.animationIterationCount,
      style.animationDirection,
    ];
    return { breathing: name !== 'none', rest };
  };
  expect(timing(cell)).toStrictEqual(timing(row));
  expect(timing(row).breathing).toBe(true);
  expect(glows[1]?.[0]?.startTime, 'in step').toBe(glows[0]?.[0]?.startTime);
}

/**
 * A fold's header fills in its card's shape (base.css): its top corners are the card's, and its
 * bottom ones too while folded; open, square along the edge the card opens under it.
 */
export function checkFoldShape(cardSelector: string, headerSelector: string): void {
  const card = document.querySelector<HTMLDetailsElement>(cardSelector);
  const header = card?.querySelector(headerSelector);
  if (card === null || header === null || header === undefined) {
    throw new Error(`No ${cardSelector} ${headerSelector}`);
  }
  const corners = (node: Element) => {
    const style = getComputedStyle(node);
    return {
      top: [style.borderTopLeftRadius, style.borderTopRightRadius],
      bottom: [style.borderBottomLeftRadius, style.borderBottomRightRadius],
    };
  };
  const want = corners(card);
  expect(want.top[0], `${cardSelector} is rounded`).not.toBe('0px');
  expect(corners(header), `${headerSelector}, ${card.open ? 'open' : 'folded'}`).toStrictEqual({
    top: want.top,
    bottom: card.open ? ['0px', '0px'] : want.bottom,
  });
}
