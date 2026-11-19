import { DROP_TICKS, FIRST_DROP_TICK } from '../../sim/balls/bomber.ts';
import { theme } from '../theme.ts';
import { chargeFraction } from './state.ts';
import type { BallDesign } from './types.ts';

/**
 * The bomb, as fractions of r: its body, the cap the fuse leaves from, and the fuse ring around it
 * (its radius, width and the spark at its burning end). One set of sizes at every size on screen.
 */
const BOMB = { y: 0.08, radius: 0.38 } as const;
const CAP = { half: 0.11, top: -0.46, bottom: -0.26 } as const;
const FUSE = { radius: 0.6, width: 0.12, spark: 0.12, core: 0.055 } as const;

/** Its next drop tick, read from any ball state (undefined for other balls). */
function nextDropOf(state: Readonly<Record<string, unknown>>): number | undefined {
  const next = state['nextDropTick'];
  return typeof next === 'number' ? next : undefined;
}

/**
 * How much of its fuse is left, 1 just after a drop down to 0 at the next. The first drop comes
 * FIRST_DROP_TICK into a fight, so a fight opens on that share of a fuse, as the sim has it.
 */
export function fuseLeft(nextDropTick: number, tick: number): number {
  return 1 - chargeFraction(nextDropTick, tick, DROP_TICKS);
}

/**
 * A round bomb in the dark accent, its fuse wrapped round it as a yellow ring that burns down
 * clockwise to the next drop: the spark at its end runs back to the cap, the bomb drops, and the
 * ring is whole again. The bombs on the floor burn their fuse the same way to their blast (ADR
 * 0043), so the ball hands its fuse on. The burnt part stays a faint track, so what is left reads
 * as a share at a glance. Moves only as the sim's clock does; no flicker.
 */
export const bomberDesign: BallDesign = {
  facing: 'none',
  strike: 'blast',
  draw(p, { ball, radius: r, accent, tick }) {
    const left = fuseLeft(nextDropOf(ball.abilityState) ?? FIRST_DROP_TICK, tick);
    const alpha = p.globalAlpha;
    const cy = BOMB.y * r;
    const ring = FUSE.radius * r;
    const top = -Math.PI / 2;

    p.fillStyle = accent;
    p.beginPath();
    p.arc(0, cy, BOMB.radius * r, 0, Math.PI * 2);
    p.rect(-CAP.half * r, CAP.top * r, 2 * CAP.half * r, (CAP.bottom - CAP.top) * r);
    p.fill();

    p.lineCap = 'round';
    p.lineWidth = FUSE.width * r;
    p.strokeStyle = accent;
    p.globalAlpha = alpha * theme.bomberFuseTrackAlpha;
    p.beginPath();
    p.arc(0, cy, ring, 0, Math.PI * 2);
    p.stroke();
    p.globalAlpha = alpha;

    // What is left of the fuse, from the cap clockwise; the spark sits on its burning end.
    const end = top + Math.PI * 2 * left;
    p.strokeStyle = theme.bombFuse;
    p.beginPath();
    p.arc(0, cy, ring, top, end);
    p.stroke();
    const sx = Math.cos(end) * ring;
    const sy = cy + Math.sin(end) * ring;
    p.fillStyle = theme.bomberSpark;
    p.beginPath();
    p.arc(sx, sy, FUSE.spark * r, 0, Math.PI * 2);
    p.fill();
    p.fillStyle = theme.highlight;
    p.beginPath();
    p.arc(sx, sy, FUSE.core * r, 0, Math.PI * 2);
    p.fill();
  },
};
