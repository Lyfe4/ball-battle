// The matchup chart on a desktop (ADR 0073 addendum of 2026-11-23), shared by the 1280 x 800 and
// 1920 x 1080 flows: the five bands as columns left to right, the reason a strip above them, pinned
// like a header (opaque, nothing of the columns seen through or above it, at scroll 0 or scrolled),
// and against every ball no column heading past two lines.
import { expect } from 'vitest';
import { frames, visible } from './page-support.ts';
import {
  bands,
  box,
  checkBands,
  checkTopAndWidth,
  choose,
  detail,
  everyBall,
  headingLines,
  openChart,
  sideBySide,
} from './spectrum-support.ts';

/**
 * The strip (the hint, or a reason) pinned over the columns like a header (2026-11-23: it was
 * see-through, and the columns showed through and above it): opaque; at scroll 0 above the column
 * headings; scrolled, at the top of the screen, every heading it passes over hidden under it.
 */
async function checkStrip(state: string): Promise<void> {
  const strip = visible('.spectrum-aside')[0];
  if (strip === undefined) throw new Error('No strip');
  const heads = () => visible('.spectrum-band-head');
  window.scrollTo(0, 0);
  await frames(2);
  expect(getComputedStyle(strip).backgroundColor, `${state}: an opaque strip`).toMatch(/^rgb\(/);
  const below = heads().every((head) => box(head).top >= box(strip).bottom);
  expect(below, `${state}: the headings below the strip at scroll 0`).toBe(true);
  // Scrolled as far as the page goes towards the headings meeting the top (a tall screen may not
  // scroll that far: the strip then rests where it is, still over nothing).
  const wanted = box(heads()[0] ?? strip).top + window.scrollY - 4;
  const most = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, wanted);
  await frames(2);
  if (wanted <= most) {
    expect(box(strip).top, `${state}: pinned at the top`).toBeLessThanOrEqual(0.5);
  }
  const seen = heads().filter((head) => {
    const { left, right, top } = box(head);
    const y = Math.max(top, 1);
    if (y >= box(strip).bottom) return false;
    const hit = document.elementFromPoint((left + right) / 2, y);
    return hit !== null && !strip.contains(hit);
  });
  expect(seen.length, `${state}: no heading seen through or above the strip`).toBe(0);
  window.scrollTo(0, 0);
  await frames(2);
}

export async function checkDesktopChart(where: string): Promise<void> {
  await openChart();
  checkBands();
  expect(sideBySide(), 'five columns side by side').toBe(true);
  await checkTopAndWidth(where);
  await checkStrip('the hint');
  await choose(2);
  await checkStrip('a reason');
  const card = detail();
  const first = bands()[0];
  if (card === undefined || first === undefined) throw new Error('No reason or band');
  expect(box(card).bottom, 'the reason is a strip above the columns').toBeLessThanOrEqual(
    box(first).top,
  );
  expect(box(card).width).toBeGreaterThan(box(first).width * 4);
  const long: string[] = [];
  await everyBall((ball) => {
    if (headingLines().some((lines) => lines > 2)) long.push(ball);
  });
  expect(long, 'headings over two lines').toStrictEqual([]);
}
