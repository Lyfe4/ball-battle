import { chargeOf } from '../../sim/balls/sniper.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

interface Scope {
  /** The scope ring's radius, and where each crosshair arm starts and ends, as fractions of r. */
  readonly ring: number;
  readonly inner: number;
  readonly outer: number;
  /** Line weight as a multiple of theme.markLine. */
  readonly weight: number;
}

const FULL: Scope = { ring: 0.5, inner: 0.2, outer: 0.8, weight: 1 };
const SIMPLE: Scope = { ring: 0.48, inner: 0.16, outer: 0.82, weight: 1.8 };
/** The centre dot, as a fraction of r; it lights up in the laser colour while a shot is locked. */
const DOT = 0.08;

/**
 * A scope crosshair: a ring with four arms that stop short of the centre, and a small dot in the
 * middle that turns laser red while the aim is locked. The laser line itself is drawn in the
 * arena (aim-line.ts). The crosshair never rotates.
 */
export const sniperDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const scope = simple ? SIMPLE : FULL;
    p.strokeStyle = accent;
    p.lineWidth = r * theme.markLine * scope.weight;
    p.lineCap = 'round';
    p.beginPath();
    p.arc(0, 0, scope.ring * r, 0, Math.PI * 2);
    for (const [x, y] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      p.moveTo(x * scope.inner * r, y * scope.inner * r);
      p.lineTo(x * scope.outer * r, y * scope.outer * r);
    }
    p.stroke();

    p.fillStyle = chargeOf(ball) === undefined ? accent : theme.sniperLaser;
    p.beginPath();
    p.arc(0, 0, DOT * r * (simple ? 1.4 : 1), 0, Math.PI * 2);
    p.fill();
  },
};
