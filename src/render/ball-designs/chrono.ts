import { isCharged } from '../../sim/balls/chrono.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** The clock face: its rim, its hour marks and its hands, as fractions of r. */
const FACE = { rim: 0.66, markIn: 0.48, markOut: 0.6, hour: 0.3, minute: 0.48, hub: 0.09 } as const;
/** Ticks for one turn of the minute hand: about 4 s, so the clock visibly runs. */
const MINUTE_TURN_TICKS = 240;
/** Where the hands stop while the rewind recharges: ten to two. */
const STOPPED = { minute: -Math.PI / 6, hour: Math.PI * 1.17 } as const;
/** The four hour marks: up, right, down, left. */
const MARKS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * A clock face in the dark accent: a rim, four hour marks and two hands, the minute hand sweeping
 * round while its rewind is charged. While it recharges after a rewind (ADR 0045) the hands stop
 * and the face fades, so a viewer can see a big hit would land. At small size the marks go and the hands thicken.
 */
export const chronoDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, tick, simple }) {
    const spent = !isCharged(ball, tick);
    const line = (simple ? theme.chronoHandSimple : theme.markLine) * r;
    p.save();
    if (spent) p.globalAlpha = theme.chronoRechargingAlpha;
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineWidth = line;
    p.beginPath();
    p.arc(0, 0, FACE.rim * r, 0, Math.PI * 2);
    p.stroke();
    if (!simple) {
      p.beginPath();
      for (const [x, y] of MARKS) {
        p.moveTo(x * FACE.markIn * r, y * FACE.markIn * r);
        p.lineTo(x * FACE.markOut * r, y * FACE.markOut * r);
      }
      p.stroke();
    }
    const minute = spent ? STOPPED.minute : (tick / MINUTE_TURN_TICKS) * Math.PI * 2 - Math.PI / 2;
    const hour = spent ? STOPPED.hour : minute / 12 - Math.PI / 3;
    p.lineWidth = line * 1.3;
    p.beginPath();
    p.moveTo(0, 0);
    p.lineTo(Math.cos(minute) * FACE.minute * r, Math.sin(minute) * FACE.minute * r);
    p.moveTo(0, 0);
    p.lineTo(Math.cos(hour) * FACE.hour * r, Math.sin(hour) * FACE.hour * r);
    p.stroke();
    p.fillStyle = accent;
    p.beginPath();
    p.arc(0, 0, FACE.hub * r, 0, Math.PI * 2);
    p.fill();
    p.restore();
  },
};
