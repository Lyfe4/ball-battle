import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** The bomb, as fractions of r: its body, its fuse and the spark at the fuse's end. */
const BOMB = {
  y: 0.12,
  radius: 0.42,
  fuseFrom: [0.12, -0.26],
  fuseTo: [0.34, -0.58],
  spark: 0.1,
} as const;

/**
 * A round bomb in the dark accent with a short fuse and a pale spark that flickers with the sim
 * tick: the ball that leaves bombs behind it (ADR 0043). At small size the fuse thickens and the
 * spark holds still.
 */
export const bomberDesign: BallDesign = {
  facing: 'none',
  strike: 'blast',
  draw(p, { radius: r, accent, tick, simple }) {
    p.fillStyle = accent;
    p.beginPath();
    p.arc(0, BOMB.y * r, BOMB.radius * r, 0, Math.PI * 2);
    p.fill();
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineWidth = (simple ? 0.14 : theme.markLine) * r;
    p.beginPath();
    p.moveTo(BOMB.fuseFrom[0] * r, BOMB.fuseFrom[1] * r);
    p.lineTo(BOMB.fuseTo[0] * r, BOMB.fuseTo[1] * r);
    p.stroke();
    const flicker = simple ? 1 : 0.8 + 0.4 * (Math.floor(tick / 3) % 2);
    p.fillStyle = theme.bomberSpark;
    p.beginPath();
    p.arc(BOMB.fuseTo[0] * r, BOMB.fuseTo[1] * r, BOMB.spark * flicker * r, 0, Math.PI * 2);
    p.fill();
  },
};
