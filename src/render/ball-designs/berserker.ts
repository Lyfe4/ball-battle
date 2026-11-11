import { MAX_RAGE, rageOf } from '../../sim/balls/berserker.ts';
import { theme } from '../theme.ts';
import { rageCrackCount } from './state.ts';
import type { BallDesign } from './types.ts';

/**
 * Cracks from the edge inwards, as [x, y] fractions of r, in the order they appear as the
 * Berserker stores rage. Each one stays inside the ball, so its outline stays round.
 */
const CRACKS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [-0.16, -0.93],
    [-0.06, -0.62],
    [-0.2, -0.42],
    [-0.05, -0.16],
  ],
  [
    [0.9, 0.3],
    [0.6, 0.17],
    [0.47, 0.35],
    [0.22, 0.2],
  ],
  [
    [-0.84, 0.46],
    [-0.58, 0.3],
    [-0.5, 0.07],
    [-0.26, 0.02],
  ],
  [
    [0.3, 0.9],
    [0.2, 0.6],
    [0.36, 0.43],
    [0.13, 0.28],
  ],
  [
    [0.66, -0.66],
    [0.43, -0.42],
    [0.5, -0.22],
    [0.28, -0.1],
  ],
  [
    [-0.46, 0.82],
    [-0.36, 0.55],
    [-0.16, 0.5],
    [-0.12, 0.26],
  ],
];

/**
 * A ball cracking under its rage (ADR 0045): one crack when calm, and every hit it takes runs more
 * cracks in from the edge, heavier, until its next bump lets the rage out and they close again. So
 * the stored rage, and the big bump coming, read at a glance. At small size fewer, thicker cracks.
 */
const SIMPLE_CRACKS = 4;
export const berserkerDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const rage = rageOf(ball.abilityState);
    const count = rageCrackCount(rage, MAX_RAGE, simple ? SIMPLE_CRACKS : CRACKS.length);
    const weight = (simple ? 1.7 : 0.8) + Math.min(1, Math.max(0, rage / MAX_RAGE)) * 0.9;
    p.save();
    p.strokeStyle = accent;
    p.lineWidth = r * theme.markLine * weight;
    p.lineCap = 'round';
    p.lineJoin = 'round';
    p.beginPath();
    for (const crack of CRACKS.slice(0, count)) {
      crack.forEach(([x, y], index) => {
        if (index === 0) p.moveTo(x * r, y * r);
        else p.lineTo(x * r, y * r);
      });
    }
    p.stroke();
    p.restore();
  },
};
