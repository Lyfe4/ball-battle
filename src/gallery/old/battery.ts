// The Battery's look (ADR 0056).
import { theme } from '../../render/theme.ts';
import type { BallDesign } from '../../render/ball-designs/types.ts';

/** Charge it can hold (the sim's cap), and how many cells show it. */
const CAPACITY = 40;
const CELLS = 4;

/** Its stored charge, read from any ball state (0 for other balls). */
function storedOf(state: Readonly<Record<string, unknown>>): number {
  const stored = state['stored'];
  return typeof stored === 'number' ? stored : 0;
}

/**
 * A battery seen side on: a dark casing with a terminal nub and four cells that light from the
 * bottom up as it stores the hits it soaks; its next bump empties them. At phone size the casing
 * thickens and the cells merge into one gauge.
 */
export const oldBatteryDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const width = (simple ? 0.62 : 0.56) * r;
    const height = (simple ? 1.04 : 0.98) * r;
    const left = -width / 2;
    const top = -height / 2 + 0.06 * r;
    p.fillStyle = accent;
    p.beginPath();
    p.rect(left, top, width, height);
    p.rect(-0.14 * r, top - 0.14 * r, 0.28 * r, 0.14 * r);
    p.fill();

    const inset = (simple ? 0.1 : 0.08) * r;
    const innerHeight = height - 2 * inset;
    const filled = Math.min(1, storedOf(ball.abilityState) / CAPACITY);
    p.fillStyle = theme.highlight;
    if (simple) {
      const level = innerHeight * filled;
      if (level <= 0) return;
      p.beginPath();
      p.rect(left + inset, top + inset + innerHeight - level, width - 2 * inset, level);
      p.fill();
      return;
    }
    const gap = 0.05 * r;
    const cell = (innerHeight - gap * (CELLS - 1)) / CELLS;
    const lit = filled * CELLS;
    for (let index = 0; index < CELLS; index++) {
      const glow = Math.min(1, Math.max(0, lit - index));
      if (glow <= 0) break;
      p.globalAlpha = 0.35 + 0.65 * glow;
      p.beginPath();
      p.rect(
        left + inset,
        top + inset + innerHeight - (index + 1) * cell - index * gap,
        width - 2 * inset,
        cell,
      );
      p.fill();
    }
    p.globalAlpha = 1;
  },
};
