import { bloomStateOf, isCalm } from '../../sim/balls/bloom.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** Petals as fractions of r: how far out each sits and how big it is, open and closed. */
const OPEN = { distance: 0.4, size: 0.24 } as const;
const BUD = { distance: 0.2, size: 0.17 } as const;
/** The petals' directions: five, evenly spaced, the first straight up. */
const PETALS = [0, 1, 2, 3, 4].map((index) => {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
  return [Math.cos(angle), Math.sin(angle)] as const;
});

/** True when a ball's petals are open: a Bloom that has rested long enough to regrow. */
export function petalsOpen(ball: Parameters<typeof bloomStateOf>[0], tick: number): boolean {
  const state = bloomStateOf(ball);
  return state !== undefined && isCalm(state.lastHitTick, tick);
}

/**
 * A flower in the dark accent with a pale centre: its petals open wide while the Bloom rests and
 * regrows, and close into a bud whenever it is hit (ADR 0043), so a viewer can see when it heals.
 * At small size the petals are bigger and the centre smaller.
 */
export const bloomDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, tick, simple }) {
    const petal = petalsOpen(ball, tick) ? OPEN : BUD;
    const grow = simple ? 1.2 : 1;
    p.fillStyle = accent;
    for (const [x, y] of PETALS) {
      p.beginPath();
      p.arc(x * petal.distance * r, y * petal.distance * r, petal.size * grow * r, 0, Math.PI * 2);
      p.fill();
    }
    p.fillStyle = theme.bloomCentre;
    p.beginPath();
    p.arc(0, 0, (simple ? 0.12 : 0.15) * r, 0, Math.PI * 2);
    p.fill();
  },
};
