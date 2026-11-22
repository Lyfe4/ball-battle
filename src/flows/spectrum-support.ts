// The matchup chart (ADR 0073 addendum of 2026-11-23) through the real page, for its browser flows at
// each layout: the phone's stacked bands with the reason under the tapped chip's row, the beside
// layout's panel next to the bands, and a desktop's five columns under the reason's strip.
import { expect } from 'vitest';
import page from '../../index.html?raw';
import { frames, settle, visible } from './page-support.ts';

export const box = (node: Element) => node.getBoundingClientRect();

/** Boots the real page on the manual's matchup chart. */
export async function openChart(): Promise<void> {
  window.localStorage.setItem('ballbattle.tips', 'off');
  const body = new DOMParser().parseFromString(page, 'text/html').body;
  document.body.replaceChildren(...body.children);
  history.replaceState(null, '', `${location.pathname}?view=manual&tab=chart`);
  await import('../main.ts');
  await settle();
}

export const bands = () => visible('.spectrum-band');
export const chips = () => visible('.spectrum-chip');
export const detail = () => visible('.spectrum-detail')[0];

/** Five bands, top to bottom (or left to right), each a heading with a count. */
export function checkBands(): void {
  expect(bands().map((band) => band.dataset['band'])).toStrictEqual([
    'beats',
    'edge',
    'even',
    'edged',
    'beaten',
  ]);
  for (const band of bands()) {
    const heading = band.querySelector('h3');
    expect(heading?.textContent, 'a heading in words').toMatch(/\w/);
    const count = Number(band.querySelector('.spectrum-band-count')?.textContent);
    expect(count).toBe(band.querySelectorAll('.spectrum-chip').length);
  }
}

/** Whether the bands sit side by side (a desktop's columns) rather than stacked. */
export function sideBySide(): boolean {
  const [first, second] = bands();
  if (first === undefined || second === undefined) return false;
  return Math.abs(box(first).top - box(second).top) < 2 && box(second).left > box(first).right;
}

/** At scroll 0 nothing of the screen is cut off above it, and the page never scrolls sideways. */
export async function checkTopAndWidth(where: string): Promise<void> {
  window.scrollTo(0, 0);
  await frames(2);
  const hud = document.querySelector('.hud');
  const tops = visible('.hud *').map((node) => box(node).top);
  expect({
    where,
    top: Math.min(...tops) >= 0 && (hud === null || box(hud).top >= 0),
    sideways: document.documentElement.scrollWidth > window.innerWidth,
  }).toStrictEqual({ where, top: true, sideways: false });
}

/** Taps (clicks) chip `index` and waits for the reason. */
export async function choose(index: number): Promise<HTMLElement> {
  const chip = chips()[index];
  if (chip === undefined) throw new Error(`No chip ${String(index)}`);
  chip.click();
  await frames(2);
  return chip;
}

/** The number of lines `node`'s text takes. */
export function linesOf(node: Element): number {
  const range = document.createRange();
  range.selectNodeContents(node);
  return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
}

/** Reads the chart against every ball in turn (Change ball, then its tile); calls `check` on each. */
export async function everyBall(check: (ball: string) => void): Promise<void> {
  const ids = visible('.spectrum-chooser .ball-tile').length;
  const all = [...document.querySelectorAll<HTMLElement>('.spectrum-chooser .ball-tile')].map(
    (tile) => tile.dataset['ballId'] ?? '',
  );
  expect(ids, 'the chooser is closed to start').toBe(0);
  for (const id of all) {
    visible('.spectrum-change')[0]?.click();
    await frames(1);
    document
      .querySelector<HTMLElement>(`.spectrum-chooser .ball-tile[data-ball-id="${id}"]`)
      ?.click();
    await frames(2);
    check(id);
  }
}

/** No band heading runs past two lines (a desktop's columns, 2026-11-23). */
export function headingLines(): number[] {
  return visible('.spectrum-band-title').map(linesOf);
}
