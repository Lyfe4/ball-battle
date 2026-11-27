import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** The hull's half-length and half-beam, and where its bow starts to narrow, as fractions of r. */
const LENGTH = 0.78;
const BEAM = 0.4;
const BOW = 0.3;
/** The cannon ports along each side (x as fractions of r), and their size. */
const PORTS: readonly number[] = [-0.3, 0.05];
const PORT = 0.16;

/**
 * A ship seen from above (prototype): a hull outline pointed where it sails, with gun ports on
 * both sides, the only way its cannons point. Turns with its heading. At small size the hull is
 * drawn thicker and the ports stay.
 */
export const pirateDesign: BallDesign = {
  facing: 'velocity',
  draw(p, { radius: r, accent, simple }) {
    p.strokeStyle = accent;
    p.fillStyle = accent;
    p.lineWidth = r * theme.markLine * (simple ? 1.6 : 1);
    p.lineJoin = 'round';
    // The hull: a flat stern, straight sides and a pointed bow.
    p.beginPath();
    p.moveTo(-LENGTH * r * 0.8, -BEAM * r);
    p.lineTo(BOW * r, -BEAM * r);
    p.quadraticCurveTo(LENGTH * r * 0.85, -BEAM * r * 0.8, LENGTH * r, 0);
    p.quadraticCurveTo(LENGTH * r * 0.85, BEAM * r * 0.8, BOW * r, BEAM * r);
    p.lineTo(-LENGTH * r * 0.8, BEAM * r);
    p.closePath();
    p.stroke();
    // Gun ports: squares straddling each side.
    p.beginPath();
    for (const x of PORTS) {
      for (const side of [-1, 1]) {
        p.rect(x * r - (PORT * r) / 2, side * BEAM * r - (PORT * r) / 2, PORT * r, PORT * r);
      }
    }
    p.fill();
    // The mast, a dot amidships.
    if (!simple) {
      p.beginPath();
      p.arc(-0.12 * r, 0, 0.1 * r, 0, Math.PI * 2);
      p.fill();
    }
  },
};
