import { boostAfter, MOST_BOOST } from '../../sim/balls/comet.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** Streaks behind the head, as fractions of r: their rows, and how far back they reach at most. */
const STREAK_ROWS = [-0.42, 0, 0.42] as const;
const STREAK_FROM = 0.1;
const STREAK_MOST = 0.85;

/**
 * Momentum (prototype): turns with its heading. A bright head at the front and three streaks
 * trailing back from it, longer the more speed it has built (none just after it touched a ball,
 * full length at its top speed), read from its ability state.
 */
export const cometDesign: BallDesign = {
  facing: 'velocity',
  draw(p, { radius: r, accent, ball, tick, simple }) {
    const since = ball.abilityState['since'];
    const boost = typeof since === 'number' ? boostAfter(tick - since) : 0;
    const reach = STREAK_FROM + (STREAK_MOST - STREAK_FROM) * (boost / MOST_BOOST);
    p.fillStyle = theme.highlight;
    p.beginPath();
    p.arc(r * 0.45, 0, r * (simple ? 0.3 : 0.24), 0, Math.PI * 2);
    p.fill();
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineWidth = r * theme.markLine * (simple ? 1.6 : 1.1);
    p.beginPath();
    for (const row of simple ? [0] : STREAK_ROWS) {
      p.moveTo(r * 0.12, row * r);
      p.lineTo(-reach * r, row * r);
    }
    p.stroke();
  },
};
