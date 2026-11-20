// The Kraken's look (ADR 0075): a sea beast with two eyes and two tentacles curling up its sides.
// The tentacles rise as its next call nears and are gone from the ball while they are out (the
// ripples, the grip), like the Boomerang's bar: it shows only what it holds. One set of
// proportions in fractions of r at every size; it moves only as the sim's clock does.
import { FIRST_GRAB_TICK, GRAB_EVERY_TICKS, krakenStateOf } from '../../sim/balls/kraken.ts';
import type { BallState } from '../../sim/types.ts';
import { theme } from '../theme.ts';
import { chargeFraction } from './state.ts';
import type { BallDesign, Painter } from './types.ts';

/**
 * How far its tentacles have risen on `tick`, 0 to 1, or undefined while they are out (rippling or
 * holding). They rise over the wait to its next call, from the start or from its last burst.
 */
export function tentaclesRisen(ball: BallState, tick: number): number | undefined {
  const state = krakenStateOf(ball);
  if (state === undefined) return 0;
  if (state.burstTick >= 0 || Object.keys(state.holds).length > 0) return undefined;
  const wait = state.nextGrabTick <= FIRST_GRAB_TICK ? FIRST_GRAB_TICK : GRAB_EVERY_TICKS;
  return chargeFraction(state.nextGrabTick, tick, wait);
}

/** One side's tentacle, as fractions of r: from the bottom, bending out, up to its curled tip. */
const ARM = { from: [0.12, 0.84], bend: [0.78, 0.66], to: [0.52, -0.02], width: 0.17 } as const;
/** How much of the arm shows when it has just come back, and the curl at its tip. */
const ARM_LOW = 0.4;
const CURL = 0.11;
const EYE = { x: 0.24, y: -0.3, radius: 0.12, glint: 0.045 } as const;

/** A point `t` of the way along an arm (x mirrored by `side`). */
function along(t: number, side: number): readonly [number, number] {
  const u = 1 - t;
  const x = u * u * ARM.from[0] + 2 * u * t * ARM.bend[0] + t * t * ARM.to[0];
  const y = u * u * ARM.from[1] + 2 * u * t * ARM.bend[1] + t * t * ARM.to[1];
  return [side * x, y];
}

/** The first `share` of one arm, cut exactly (de Casteljau), with a curl and suckers on it. */
function arm(p: Painter, r: number, side: number, share: number, accent: string): void {
  const [ex, ey] = along(share, side);
  const cx = side * (ARM.from[0] + (ARM.bend[0] - ARM.from[0]) * share);
  const cy = ARM.from[1] + (ARM.bend[1] - ARM.from[1]) * share;
  p.strokeStyle = accent;
  p.lineCap = 'round';
  p.lineWidth = ARM.width * r;
  p.beginPath();
  p.moveTo(side * ARM.from[0] * r, ARM.from[1] * r);
  p.quadraticCurveTo(cx * r, cy * r, ex * r, ey * r);
  p.stroke();
  p.lineWidth = ARM.width * 0.7 * r;
  p.beginPath();
  p.arc((ex - side * CURL) * r, ey * r, CURL * r, 0, Math.PI * 2);
  p.stroke();
  p.fillStyle = theme.krakenSucker;
  for (const t of [0.3, 0.62]) {
    if (t > share) continue;
    const [sx, sy] = along(t, side);
    p.beginPath();
    p.arc(sx * r, sy * r, 0.045 * r, 0, Math.PI * 2);
    p.fill();
  }
}

/**
 * Two round eyes with a glint, and a tentacle curling up each side in the dark accent with pale
 * suckers. While the tentacles are out, faint stubs stay where they were.
 */
export const krakenDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, tick }) {
    const risen = tentaclesRisen(ball, tick);
    const alpha = p.globalAlpha;
    if (risen === undefined) p.globalAlpha = alpha * theme.krakenOutAlpha;
    const share = risen === undefined ? ARM_LOW : ARM_LOW + (1 - ARM_LOW) * risen;
    for (const side of [-1, 1]) arm(p, r, side, share, accent);
    p.globalAlpha = alpha;
    for (const side of [-1, 1]) {
      p.fillStyle = accent;
      p.beginPath();
      p.arc(side * EYE.x * r, EYE.y * r, EYE.radius * r, 0, Math.PI * 2);
      p.fill();
      p.fillStyle = theme.highlight;
      p.beginPath();
      p.arc((side * EYE.x + 0.04) * r, (EYE.y - 0.04) * r, EYE.glint * r, 0, Math.PI * 2);
      p.fill();
    }
  },
};
