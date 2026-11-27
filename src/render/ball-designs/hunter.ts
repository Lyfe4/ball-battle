import { FIRST_SNARE_TICK, hunterStateOf, SNARE_EVERY_TICKS } from '../../sim/balls/hunter.ts';
import { theme } from '../theme.ts';
import { chargeFraction } from './state.ts';
import type { BallDesign, Painter } from './types.ts';

/** Points round half a jaw, from one hinge to the other: fixed ratios, no trigonometry per frame. */
const HALF: readonly (readonly [number, number])[] = Array.from({ length: 9 }, (_, k) => {
  const angle = (k * Math.PI) / 8;
  return [Math.cos(angle), Math.sin(angle)];
});
/** Where the teeth sit along each jaw (x, as a share of its reach): the two jaws' teeth mesh. */
const TOP_TEETH = [-0.54, -0.18, 0.18, 0.54];
const BOTTOM_TEETH = [-0.36, 0, 0.36];
const TOOTH_HALF = 0.14;
const TOOTH_LENGTH = 0.42;

/** How far its own trap is set, 0 (snapped shut, a snare just laid) to 1 (set, ready to lay). */
export function trapSetOf(nextSnareTick: number, tick: number): number {
  if (nextSnareTick <= FIRST_SNARE_TICK) return 1;
  return chargeFraction(nextSnareTick, tick, SNARE_EVERY_TICKS);
}

/**
 * How far out from a held ball's edge its trap sits, `since` ticks after it was caught: it snaps in
 * from trapSnapGap to trapClampGap over trapSnapTicks, then holds.
 */
export function clampGap(since: number): number {
  const shut = Math.min(1, Math.max(0, since / theme.trapSnapTicks));
  return theme.trapSnapGap + (theme.trapClampGap - theme.trapSnapGap) * shut;
}

/** How far a jaw is from the hinge line at `x` (a share of its reach), set `open` of the way. */
function jawAt(x: number, open: number): number {
  return (0.14 + 0.86 * open) * Math.sqrt(Math.max(0, 1 - x * x));
}

/**
 * A jaw trap from above, centred on the origin, `reach` across from its centre to each hinge: two
 * jaws hinged left and right, open as a ring of teeth round its pan when set (`open` 1) and closed
 * to a line of meshing teeth when sprung (0). Jaws and hinges in `jaw`, teeth in steel edged in
 * `edge`. Used for the Hunter's face, its snares on the floor and a ball a snare holds.
 */
export function drawJawTrap(
  p: Painter,
  reach: number,
  open: number,
  jaw: string,
  edge: string,
): void {
  const depth = 0.14 + 0.86 * open;
  p.lineCap = 'round';
  p.lineJoin = 'round';
  // Teeth first, so the jaws' bars cover their roots.
  p.fillStyle = theme.hunterSteel;
  p.strokeStyle = edge;
  p.lineWidth = theme.hunterToothEdge * reach;
  p.beginPath();
  for (const [teeth, side] of [
    [TOP_TEETH, -1],
    [BOTTOM_TEETH, 1],
  ] as const) {
    for (const x of teeth) {
      const root = side * jawAt(x, open) * reach;
      // Tips point at the hinge line, and just cross it when the jaws close, so they mesh.
      const length = Math.min(TOOTH_LENGTH, Math.abs(root) / reach + 0.08) * reach;
      p.moveTo((x - TOOTH_HALF) * reach, root);
      p.lineTo(x * reach, root - side * length);
      p.lineTo((x + TOOTH_HALF) * reach, root);
      p.closePath();
    }
  }
  p.fill();
  p.stroke();
  // The two jaws, one bar each from hinge to hinge.
  p.strokeStyle = jaw;
  p.lineWidth = theme.hunterJawWidth * reach;
  p.beginPath();
  for (const side of [-1, 1]) {
    HALF.forEach(([x, y], index) => {
      const point = [x * reach, side * y * depth * reach] as const;
      if (index === 0) p.moveTo(...point);
      else p.lineTo(...point);
    });
  }
  p.stroke();
  // The pan in the middle (seen only while set) and the hinges' springs.
  p.fillStyle = jaw;
  p.beginPath();
  p.moveTo(0.16 * open * reach, 0);
  p.arc(0, 0, 0.16 * open * reach, 0, Math.PI * 2);
  for (const side of [-1, 1]) {
    p.moveTo(side * reach + 0.13 * reach, 0);
    p.arc(side * reach, 0, 0.13 * reach, 0, Math.PI * 2);
  }
  p.fill();
}

/**
 * A hunter's jaw trap (ADR 0091) on its leather, in its dark accent with steel teeth: set (open)
 * while it carries a snare, it snaps shut the moment it lays one and opens again as the next comes.
 * Never rotates; drawn alike at every size, in fractions of r.
 */
export const hunterDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, ball, tick }) {
    const state = hunterStateOf(ball);
    const open = state === undefined ? 1 : trapSetOf(state.nextSnareTick, tick);
    drawJawTrap(p, 0.66 * r, open, accent, accent);
  },
};
