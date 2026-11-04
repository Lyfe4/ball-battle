import { stacksOf } from '../../sim/balls/speedster.ts';
import { theme } from '../theme.ts';
import { streakCount } from './state.ts';
import type { BallDesign } from './types.ts';

/** Streaks end inside this fraction of the radius, clear of the outline and mirror ring. */
const REACH = 0.8;
const STREAK_SPACING = 0.22;
/** Streaks begin this far behind the centre, and run this long, less the taper per row out. */
const STREAK_START = 0.14;
const STREAK_LENGTH = 0.5;
const STREAK_TAPER = 0.1;

/**
 * A bold chevron pointing where it is going, with one swept streak behind it per stack: the
 * streaks show its stored speed and bonus at a glance and vanish when it cashes them in.
 */
export const speedsterDesign: BallDesign = {
  facing: 'velocity',
  showsHeal: false,
  draw(p, { ball, radius: r, accent }) {
    const line = r * theme.markLine;
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineJoin = 'round';

    p.lineWidth = line * 2.2;
    p.beginPath();
    p.moveTo(0.12 * r, -0.42 * r);
    p.lineTo(0.56 * r, 0);
    p.lineTo(0.12 * r, 0.42 * r);
    p.stroke();

    // Speed lines start clear of the chevron, the middle one longest, so they read as motion
    // behind it rather than as an arrow's shaft.
    const count = streakCount(stacksOf(ball));
    const reach = REACH * r;
    p.lineWidth = line * 1.3;
    for (let i = 0; i < count; i++) {
      const offset = i - (count - 1) / 2;
      const y = offset * STREAK_SPACING * r;
      const edge = Math.sqrt(Math.max(0, reach * reach - y * y));
      const length = (STREAK_LENGTH - STREAK_TAPER * Math.abs(offset)) * r;
      p.beginPath();
      p.moveTo(-STREAK_START * r, y);
      p.lineTo(-Math.min(edge, STREAK_START * r + length), y);
      p.stroke();
    }
  },
};
