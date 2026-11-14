import { pausedUntilOf } from '../../sim/balls/bloom.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** Petals as fractions of r: how far out each sits and how big it is, open and closed. */
const PETAL = { distance: 0.4, size: 0.24 } as const;
const CLOSED = { distance: 0.17, size: 0.2 } as const;
/** The petals open again over the last ticks of its wait, so a reopening reads as a movement. */
const REOPEN_TICKS = 20;
/** The petals' directions: five, evenly spaced, the first straight up. */
const PETALS = [0, 1, 2, 3, 4].map((index) => {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
  return [Math.cos(angle), Math.sin(angle)] as const;
});

/** How closed a Bloom's petals are at `tick`, 1 shut down to 0 open: its wait to regrow. */
export function petalsClosed(pausedUntil: number | undefined, tick: number): number {
  if (pausedUntil === undefined || tick >= pausedUntil) return 0;
  return Math.min(1, (pausedUntil - tick) / REOPEN_TICKS);
}

/**
 * A flower in the dark accent with a pale centre (ADR 0045). Every regrowth shows as the heal pulse;
 * every hit closes it into a bud that stays shut through its whole wait, and it opens again as the
 * regrowth comes back. At small size the petals are bigger and the centre smaller.
 */
export const bloomDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, tick, radius: r, accent, simple }) {
    const closed = petalsClosed(pausedUntilOf(ball), tick);
    const distance = PETAL.distance + (CLOSED.distance - PETAL.distance) * closed;
    const size = PETAL.size + (CLOSED.size - PETAL.size) * closed;
    const grow = simple ? 1.2 : 1;
    p.fillStyle = accent;
    for (const [x, y] of PETALS) {
      p.beginPath();
      p.arc(x * distance * r, y * distance * r, size * grow * r, 0, Math.PI * 2);
      p.fill();
    }
    if (closed >= 1) return;
    p.globalAlpha = 1 - closed;
    p.fillStyle = theme.bloomCentre;
    p.beginPath();
    p.arc(0, 0, (simple ? 0.12 : 0.15) * r, 0, Math.PI * 2);
    p.fill();
    p.globalAlpha = 1;
  },
};
