import { COOLDOWN_TICKS, nextShotTickOf } from '../../sim/balls/archer.ts';
import { theme } from '../theme.ts';
import { chargeFraction } from './state.ts';
import type { BallDesign } from './types.ts';

/** The bow's arc: centre offset and radius as fractions of r, and half its sweep in radians. */
const BOW_CENTRE = -0.08;
const BOW_RADIUS = 0.64;
const BOW_SWEEP = 1.0;
/** How far behind the bow tips the string is pulled at full draw, as a fraction of r. */
const FULL_DRAW = 0.62;

/**
 * A bow facing its target with an arrow nocked. As the next shot charges, the string and arrow
 * pull back from slack to a full draw; the shot releases it. At small size the string and
 * fletching are dropped and the bow and arrow drawn heavier; the arrow still pulls back.
 */
export const archerDesign: BallDesign = {
  facing: 'aim',
  showsHeal: false,
  draw(p, { ball, radius: r, accent, tick, simple }) {
    const line = r * theme.markLine;
    p.strokeStyle = accent;
    p.lineCap = 'round';

    const next = nextShotTickOf(ball);
    const charge = next === undefined ? 0 : chargeFraction(next, tick, COOLDOWN_TICKS);
    const tipX = (BOW_CENTRE + BOW_RADIUS * Math.cos(BOW_SWEEP)) * r;
    const tipY = BOW_RADIUS * Math.sin(BOW_SWEEP) * r;
    const nockX = tipX - FULL_DRAW * charge * r;
    const headX = (BOW_CENTRE + BOW_RADIUS + 0.04) * r;

    if (simple) {
      // A bow alone read as a bracket at phone size; a thick arrow through it reads as a bow.
      p.fillStyle = accent;
      p.lineWidth = line * 1.8;
      p.beginPath();
      p.moveTo(nockX, 0);
      p.lineTo(headX - 0.12 * r, 0);
      p.stroke();
      p.beginPath();
      p.moveTo(headX + 0.14 * r, 0);
      p.lineTo(headX - 0.16 * r, -0.17 * r);
      p.lineTo(headX - 0.16 * r, 0.17 * r);
      p.closePath();
      p.fill();
      p.lineWidth = line * 2.6;
      p.beginPath();
      p.arc(BOW_CENTRE * r, 0, BOW_RADIUS * r, -BOW_SWEEP, BOW_SWEEP);
      p.stroke();
      return;
    }

    p.strokeStyle = accent;
    p.fillStyle = accent;
    p.lineCap = 'round';
    p.lineJoin = 'round';

    // String, then arrow, then the bow over both.
    p.lineWidth = line * 0.6;
    p.beginPath();
    p.moveTo(tipX, -tipY);
    p.lineTo(nockX, 0);
    p.lineTo(tipX, tipY);
    p.stroke();

    p.lineWidth = line;
    p.beginPath();
    p.moveTo(nockX, 0);
    p.lineTo(headX - 0.1 * r, 0);
    p.stroke();
    p.beginPath();
    p.moveTo(headX + 0.1 * r, 0);
    p.lineTo(headX - 0.12 * r, -0.11 * r);
    p.lineTo(headX - 0.12 * r, 0.11 * r);
    p.closePath();
    p.fill();
    // Fletching at the nock.
    p.lineWidth = line * 0.8;
    p.beginPath();
    p.moveTo(nockX + 0.14 * r, 0);
    p.lineTo(nockX, -0.12 * r);
    p.moveTo(nockX + 0.14 * r, 0);
    p.lineTo(nockX, 0.12 * r);
    p.stroke();

    p.lineWidth = line * 1.7;
    p.beginPath();
    p.arc(BOW_CENTRE * r, 0, BOW_RADIUS * r, -BOW_SWEEP, BOW_SWEEP);
    p.stroke();
  },
};
