import { DROP_TICKS, FIRST_DROP_TICK } from '../../sim/balls/bomber.ts';
import { theme } from '../theme.ts';
import { chargeFraction } from './state.ts';
import type { BallDesign } from './types.ts';

/**
 * The bomb and its fuse, as fractions of r: the body, and the fuse as a gentle curve from the
 * bomb's top up to the right (from, bend, to) with its width and the spark on its burning end. One
 * set of sizes at every size on screen.
 */
const BOMB = { y: 0.14, radius: 0.4 } as const;
const FUSE = {
  from: [0.1, -0.22],
  bend: [0.12, -0.58],
  to: [0.46, -0.66],
  width: 0.12,
  spark: 0.13,
  core: 0.055,
} as const;

/** Its next drop tick, read from any ball state (undefined for other balls). */
function nextDropOf(state: Readonly<Record<string, unknown>>): number | undefined {
  const next = state['nextDropTick'];
  return typeof next === 'number' ? next : undefined;
}

/**
 * How much of its fuse is left, 1 just after a drop down to 0 at the next. Its first wait is
 * shorter (FIRST_DROP_TICK, before which its next drop is still that tick), and the fuse burns over
 * that wait, so a fight, and the icon, open on a whole fuse.
 */
export function fuseLeft(nextDropTick: number, tick: number): number {
  const wait = nextDropTick <= FIRST_DROP_TICK ? FIRST_DROP_TICK : DROP_TICKS;
  return 1 - chargeFraction(nextDropTick, tick, wait);
}

/** A point `t` of the way along the fuse's curve, from the bomb (0) to its full end (1). */
function along(t: number): readonly [number, number] {
  const u = 1 - t;
  return [
    u * u * FUSE.from[0] + 2 * u * t * FUSE.bend[0] + t * t * FUSE.to[0],
    u * u * FUSE.from[1] + 2 * u * t * FUSE.bend[1] + t * t * FUSE.to[1],
  ];
}

/**
 * A round bomb in the dark accent with a stick fuse and a pale spark on its end: the ball that
 * leaves bombs behind it (ADR 0043). The fuse burns down to its next drop: whole just after a drop,
 * it gets shorter as the spark creeps down to the bomb, the bomb drops, and the fuse is whole
 * again. It moves only as the sim's clock does; no flicker.
 */
export const bomberDesign: BallDesign = {
  facing: 'none',
  strike: 'blast',
  draw(p, { ball, radius: r, accent, tick }) {
    const left = fuseLeft(nextDropOf(ball.abilityState) ?? FIRST_DROP_TICK, tick);
    p.fillStyle = accent;
    p.beginPath();
    p.arc(0, BOMB.y * r, BOMB.radius * r, 0, Math.PI * 2);
    p.fill();

    // What is left of the fuse: the first `left` of the curve, split exactly (de Casteljau), so
    // the same curve shortens rather than changing shape.
    const [ex, ey] = along(left);
    const cx = FUSE.from[0] + (FUSE.bend[0] - FUSE.from[0]) * left;
    const cy = FUSE.from[1] + (FUSE.bend[1] - FUSE.from[1]) * left;
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineWidth = FUSE.width * r;
    p.beginPath();
    p.moveTo(FUSE.from[0] * r, FUSE.from[1] * r);
    p.quadraticCurveTo(cx * r, cy * r, ex * r, ey * r);
    p.stroke();

    p.fillStyle = theme.bomberSpark;
    p.beginPath();
    p.arc(ex * r, ey * r, FUSE.spark * r, 0, Math.PI * 2);
    p.fill();
    p.fillStyle = theme.highlight;
    p.beginPath();
    p.arc(ex * r, ey * r, FUSE.core * r, 0, Math.PI * 2);
    p.fill();
  },
};
