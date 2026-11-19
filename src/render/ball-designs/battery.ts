// The Battery's look (ADR 0056).
import { CAPACITY } from '../../sim/balls/battery.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** Its stored charge, read from any ball state (0 for other balls). */
function storedOf(state: Readonly<Record<string, unknown>>): number {
  const stored = state['stored'];
  return typeof stored === 'number' ? stored : 0;
}

/** How full it is, 0 to 1: its stored charge as a share of CAPACITY. */
function batteryLevel(stored: number): number {
  return Math.min(CAPACITY, Math.max(0, stored)) / CAPACITY;
}

/**
 * A battery lying across the ball, as on a phone: a thick dark casing with its terminal to the
 * right, its inside an empty, faintly tinted well from the start. Electric yellow fills it smoothly from the
 * left in proportion to what it has stored (a third of each big strike, blast or burst, up to
 * CAPACITY), and drains on its next bump. One fill, no cells: a hit stores a share, not a unit. At
 * small size the casing is a little larger and its walls thicker.
 */
export const batteryDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const width = (simple ? 1.26 : 1.18) * r;
    const height = (simple ? 0.7 : 0.62) * r;
    const nub = (simple ? 0.15 : 0.12) * r;
    const wall = (simple ? 0.11 : 0.08) * r;
    const left = -width / 2 - nub / 2;
    const top = -height / 2;
    const inner = { x: left + wall, y: top + wall, w: width - 2 * wall, h: height - 2 * wall };
    // The inside first, a faint tint of the casing, then the casing as a thick outline with its
    // terminal: plainly an empty battery before any charge.
    p.fillStyle = accent;
    const alpha = p.globalAlpha;
    p.globalAlpha = alpha * theme.batteryWellAlpha;
    p.beginPath();
    p.rect(inner.x, inner.y, inner.w, inner.h);
    p.fill();
    p.globalAlpha = alpha;
    p.beginPath();
    p.rect(left, top, width, wall);
    p.rect(left, top + height - wall, width, wall);
    p.rect(left, top + wall, wall, height - 2 * wall);
    p.rect(left + width - wall, top + wall, wall, height - 2 * wall);
    p.rect(left + width, -height * 0.25, nub, height * 0.5);
    p.fill();

    const level = batteryLevel(storedOf(ball.abilityState));
    if (level <= 0) return;
    p.fillStyle = theme.batteryCharge;
    p.beginPath();
    p.rect(inner.x, inner.y, inner.w * level, inner.h);
    p.fill();
  },
};
