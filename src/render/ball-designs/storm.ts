import { COOLDOWN_TICKS, nextStrikeTickOf } from '../../sim/balls/storm.ts';
import { theme } from '../theme.ts';
import { chargeFraction, stormFlicker } from './state.ts';
import type { BallDesign } from './types.ts';

/** The cloud's puffs, as [x, y, radius] fractions of r. */
const PUFFS: readonly (readonly [number, number, number])[] = [
  [-0.32, -0.08, 0.25],
  [0.0, -0.26, 0.32],
  [0.32, -0.08, 0.25],
];
/** A zigzag bolt under the cloud, as [x, y] fractions of r. */
const BOLT: readonly (readonly [number, number])[] = [
  [0.06, 0.06],
  [-0.2, 0.4],
  [-0.02, 0.4],
  [-0.14, 0.72],
  [0.2, 0.3],
  [0.02, 0.3],
  [0.16, 0.06],
];

/**
 * A flat storm cloud with a small bolt beneath. The bolt brightens as the next strike charges and
 * flickers just before it is called. It already reads at phone size, so it has one drawing for
 * every size.
 */
export const stormDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  draw(p, { ball, radius: r, accent, tick }) {
    p.fillStyle = accent;
    p.beginPath();
    for (const [x, y, size] of PUFFS) {
      p.moveTo((x + size) * r, y * r);
      p.arc(x * r, y * r, size * r, 0, Math.PI * 2);
    }
    p.rect(-0.32 * r, -0.08 * r, 0.64 * r, 0.25 * r);
    p.fill();

    const next = nextStrikeTickOf(ball);
    const charge = next === undefined ? 0 : chargeFraction(next, tick, COOLDOWN_TICKS);
    p.save();
    p.globalAlpha *= stormFlicker(charge, tick);
    p.fillStyle = theme.highlight;
    p.beginPath();
    BOLT.forEach(([x, y], index) => {
      if (index === 0) p.moveTo(x * r, y * r);
      else p.lineTo(x * r, y * r);
    });
    p.closePath();
    p.fill();
    p.restore();
  },
};
