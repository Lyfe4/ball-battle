// The Battery's look (ADR 0056).
import { CAPACITY } from '../../sim/balls/battery.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** How many cells show its charge: each is a quarter of CAPACITY. */
const CELLS = 4;

/** Its stored charge, read from any ball state (0 for other balls). */
function storedOf(state: Readonly<Record<string, unknown>>): number {
  const stored = state['stored'];
  return typeof stored === 'number' ? stored : 0;
}

/** How full each of its cells is, 0 to 1, from the casing's back to its terminal. */
export function batteryCells(stored: number): readonly number[] {
  const lit = (Math.min(CAPACITY, Math.max(0, stored)) / CAPACITY) * CELLS;
  return Array.from({ length: CELLS }, (_, index) => Math.min(1, Math.max(0, lit - index)));
}

/**
 * A battery lying across the ball, as on a phone's status bar: a dark casing with its terminal to
 * the right and four cells that fill with electric yellow from the left as it stores part of each
 * big strike, blast or burst, a cell filling as far as its charge goes. Its next bump empties them
 * all. The empty cells stay as dark slots, so it always reads as how full of four. The same four
 * cells at every size; at small size the casing is a little larger.
 */
export const batteryDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const width = (simple ? 1.26 : 1.18) * r;
    const height = (simple ? 0.7 : 0.62) * r;
    const nub = (simple ? 0.14 : 0.12) * r;
    const left = -width / 2 - nub / 2;
    const top = -height / 2;
    p.fillStyle = accent;
    p.beginPath();
    p.rect(left, top, width, height);
    p.rect(left + width, -height * 0.25, nub, height * 0.5);
    p.fill();

    const inset = (simple ? 0.09 : 0.08) * r;
    const gap = (simple ? 0.07 : 0.06) * r;
    const innerWidth = width - 2 * inset;
    const cell = (innerWidth - gap * (CELLS - 1)) / CELLS;
    const cellHeight = height - 2 * inset;
    const cells = batteryCells(storedOf(ball.abilityState));
    p.fillStyle = theme.batteryCharge;
    p.beginPath();
    cells.forEach((fill, index) => {
      if (fill <= 0) return;
      p.rect(left + inset + index * (cell + gap), top + inset, cell * fill, cellHeight);
    });
    p.fill();
  },
};
