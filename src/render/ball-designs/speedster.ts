import { stacksOf } from '../../sim/balls/speedster.ts';
import { theme } from '../theme.ts';
import { simpleStreakCount, streakCount } from './state.ts';
import type { BallDesign, Painter } from './types.ts';

/** The chevron's tip, as a fraction of r ahead of the centre. */
const TIP = 0.5;
/** Length of each side of the dart, as a fraction of r. */
const ARM = 0.62;
/** Half the angle at the dart's tip: 30° each side for a sharp 60° point. Precomputed cos, sin. */
const HALF_ANGLE_COS = 0.8660254037844387;
const HALF_ANGLE_SIN = 0.5;
/** How far the dart's back is notched in, as a fraction of r. */
const NOTCH = 0.2;
/** Streaks end inside this fraction of the radius, clear of the outline and mirror ring. */
const REACH = 0.8;
/** Streaks begin this far behind the centre, clear of the chevron, and taper outwards. */
const STREAK_START = 0.2;
const STREAK_LENGTH = 0.48;
const STREAK_TAPER = 0.1;

function drawStreaks(p: Painter, r: number, count: number, spacing: number): void {
  const reach = REACH * r;
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2;
    const y = offset * spacing * r;
    const edge = Math.sqrt(Math.max(0, reach * reach - y * y));
    const length = (STREAK_LENGTH - STREAK_TAPER * Math.abs(offset)) * r;
    p.beginPath();
    p.moveTo(-STREAK_START * r, y);
    p.lineTo(-Math.min(edge, STREAK_START * r + length), y);
    p.stroke();
  }
}

/**
 * A sharp dart pointing where it is going, with one swept streak behind it per stack: the
 * streaks show its stored speed and bonus at a glance and vanish when it cashes them in. At small
 * size the dart is larger and the streaks thicker, at most two.
 */
export const speedsterDesign: BallDesign = {
  facing: 'velocity',
  showsHeal: false,
  draw(p, { ball, radius: r, accent, simple }) {
    const line = r * theme.markLine;
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineJoin = 'round';

    // A filled, notched dart rather than an open angle: an open chevron facing diagonally has one
    // arm near horizontal and reads as a "7"; a solid point reads as a pointer at any angle.
    const scale = simple ? 1.12 : 1;
    const backX = (TIP - ARM * HALF_ANGLE_COS) * r * scale;
    const backY = ARM * HALF_ANGLE_SIN * r * scale;
    p.fillStyle = accent;
    p.beginPath();
    p.moveTo(TIP * r * scale, 0);
    p.lineTo(backX, backY);
    p.lineTo(backX + NOTCH * r * scale, 0);
    p.lineTo(backX, -backY);
    p.closePath();
    p.fill();

    const stacks = stacksOf(ball);
    if (simple) {
      p.lineWidth = line * 2.4;
      drawStreaks(p, r, simpleStreakCount(stacks), 0.32);
    } else {
      p.lineWidth = line * 1.3;
      drawStreaks(p, r, streakCount(stacks), 0.2);
    }
  },
};
