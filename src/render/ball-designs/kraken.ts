// The Kraken's look (ADR 0075): a deep-sea predator, a dark mantle, narrowed glowing eyes under
// heavy brows and a hooked beak among the roots of its arms, with two tentacles curling up its
// sides. They rise as its next call nears and are gone from the ball while they are out (the
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
 * The dark mantle over the top of its head: where a circle (centre y, radius, fractions of r)
 * overlaps the ball, drawn as that lens (cheaper than clipping): over the ball's edge between the
 * two crossings, back along the circle's.
 */
const MANTLE = { y: -1.02, radius: 0.8 } as const;
const CROSS_Y = (MANTLE.y ** 2 - MANTLE.radius ** 2 + 1) / (2 * MANTLE.y);
const CROSS_X = Math.sqrt(1 - CROSS_Y ** 2);
const EDGE_FROM = Math.atan2(CROSS_Y, -CROSS_X);
const EDGE_TO = Math.atan2(CROSS_Y, CROSS_X);
const RIM_FROM = Math.atan2(CROSS_Y - MANTLE.y, CROSS_X);
const RIM_TO = Math.PI - RIM_FROM;
/**
 * One glowing eye (the right; the left mirrors it), as fractions of r: narrowed under a heavy brow
 * that slants down to the middle, with a slit pupil.
 */
const EYE = { inner: [0.05, -0.05], outer: [0.47, -0.22], lid: [0.25, 0.34] } as const;
const BROW = [
  [0.01, -0.14],
  [0.5, -0.37],
  [0.53, -0.24],
  [0.05, -0.04],
] as const;
const PUPIL = { x: 0.26, y: -0.02, rx: 0.034, ry: 0.09 } as const;
/** A hooked beak low down, among the roots of its arms, where an octopus has it. */
const BEAK = { top: 0.4, half: 0.13, tip: 0.72 } as const;

function eye(p: Painter, r: number, side: number, accent: string): void {
  p.fillStyle = theme.krakenEye;
  p.beginPath();
  p.moveTo(side * EYE.inner[0] * r, EYE.inner[1] * r);
  p.lineTo(side * EYE.outer[0] * r, EYE.outer[1] * r);
  p.quadraticCurveTo(
    side * EYE.lid[0] * r,
    EYE.lid[1] * r,
    side * EYE.inner[0] * r,
    EYE.inner[1] * r,
  );
  p.fill();
  p.fillStyle = accent;
  p.save();
  p.translate(side * PUPIL.x * r, PUPIL.y * r);
  p.scale(PUPIL.rx / PUPIL.ry, 1);
  p.beginPath();
  p.arc(0, 0, PUPIL.ry * r, 0, Math.PI * 2);
  p.fill();
  p.restore();
  p.beginPath();
  BROW.forEach(([x, y], index) => {
    if (index === 0) p.moveTo(side * x * r, y * r);
    else p.lineTo(side * x * r, y * r);
  });
  p.closePath();
  p.fill();
}

/**
 * A deep-sea predator: a dark mantle over its head, two narrowed eyes glowing under heavy brows,
 * a hooked beak low down, and a tentacle curling up each side in the dark accent with pale suckers. While
 * the tentacles are out, faint stubs stay where they were.
 */
export const krakenDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, tick }) {
    const risen = tentaclesRisen(ball, tick);
    const alpha = p.globalAlpha;
    p.fillStyle = accent;
    p.globalAlpha = alpha * theme.krakenMantleAlpha;
    p.beginPath();
    p.arc(0, 0, r, EDGE_FROM, EDGE_TO);
    p.arc(0, MANTLE.y * r, MANTLE.radius * r, RIM_FROM, RIM_TO);
    p.fill();
    p.globalAlpha = alpha;
    if (risen === undefined) p.globalAlpha = alpha * theme.krakenOutAlpha;
    const share = risen === undefined ? ARM_LOW : ARM_LOW + (1 - ARM_LOW) * risen;
    for (const side of [-1, 1]) arm(p, r, side, share, accent);
    p.globalAlpha = alpha;
    for (const side of [-1, 1]) eye(p, r, side, accent);
    p.fillStyle = accent;
    p.beginPath();
    p.moveTo(-BEAK.half * r, BEAK.top * r);
    p.quadraticCurveTo(0, (BEAK.top - 0.05) * r, BEAK.half * r, BEAK.top * r);
    p.quadraticCurveTo(BEAK.half * 0.5 * r, (BEAK.tip - 0.08) * r, 0, BEAK.tip * r);
    p.quadraticCurveTo(-BEAK.half * 0.5 * r, (BEAK.tip - 0.08) * r, -BEAK.half * r, BEAK.top * r);
    p.fill();
    p.strokeStyle = theme.krakenSucker;
    p.lineWidth = theme.markLine * 0.3 * r;
    p.beginPath();
    p.moveTo(0, (BEAK.top + 0.04) * r);
    p.lineTo(0, (BEAK.tip - 0.12) * r);
    p.stroke();
  },
};
