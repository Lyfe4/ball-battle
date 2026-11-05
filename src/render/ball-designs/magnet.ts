import { isPulling } from '../../sim/balls/magnet.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** The horseshoe: its bend's radius, where the bend's centre sits, and how far up the legs reach. */
const SHOE = { bend: 0.42, centre: 0.06, legTop: -0.52, tip: 0.2 } as const;

/**
 * A horseshoe magnet in the dark accent, opening upwards, with pale tips. The tips light up while
 * it pulls (ADR 0026), so the pull shows on the ball as well as on the line to its enemy. At small
 * size the shoe is heavier.
 */
export const magnetDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  draw(p, { ball, radius: r, accent, tick, simple }) {
    const width = (simple ? theme.magnetShoeSimple : theme.magnetShoe) * r;
    const bend = SHOE.bend * r;
    const centre = SHOE.centre * r;
    const top = SHOE.legTop * r;
    p.strokeStyle = accent;
    p.lineWidth = width;
    p.lineCap = 'butt';
    p.beginPath();
    p.moveTo(-bend, top);
    p.lineTo(-bend, centre);
    p.arc(0, centre, bend, Math.PI, 0, true);
    p.lineTo(bend, top);
    p.stroke();
    // The tips: the top of each leg, in a pale metal, or glowing while it pulls.
    p.strokeStyle = isPulling(ball, tick) ? theme.magnetPullTip : theme.magnetTip;
    p.beginPath();
    for (const side of [-1, 1]) {
      p.moveTo(side * bend, top);
      p.lineTo(side * bend, top + SHOE.tip * r);
    }
    p.stroke();
  },
};
