// The Banshee's look (ADR 0075): a wailing spirit, a pale face framed by long hair parted in the
// middle, the hair streaming below it in locks that break the ball's edge. Her hollow eyes slant in
// sorrow; her mouth follows the wail: a slit while she waits, opening as she draws breath and
// gaping on the wail, when her locks also lift. It moves only as the sim's clock does. One set of
// proportions in fractions of r at every size.
import { FIRST_WAIL_TICK, nextWailTickOf, WAIL_EVERY_TICKS } from '../../sim/balls/banshee.ts';
import type { BallState } from '../../sim/types.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** Where it is in its wail, read from its state on `tick`: each 0 to 1. */
export interface WailMoment {
  /** Drawing breath: 0 until theme.bansheeBreathTicks before the wail, rising to 1 at it. */
  readonly breath: number;
  /** The wail itself: 1 on the tick it wails, falling to 0 over theme.bansheeWailTicks. */
  readonly wail: number;
}

/** Its breath and wail on `tick`, from its next wail tick (no wail before its first). */
export function wailMoment(nextWailTick: number, tick: number): WailMoment {
  const until = nextWailTick - tick;
  const breath =
    until <= theme.bansheeBreathTicks ? 1 - Math.max(0, until) / theme.bansheeBreathTicks : 0;
  const since = tick - (nextWailTick - WAIL_EVERY_TICKS);
  const wailed = nextWailTick > FIRST_WAIL_TICK && since >= 0;
  const wail = wailed ? Math.max(0, 1 - since / theme.bansheeWailTicks) : 0;
  return { breath, wail };
}

/** A Banshee's moment, read from any ball (undefined for other balls). */
export function wailMomentOf(ball: BallState, tick: number): WailMoment | undefined {
  const next = nextWailTickOf(ball);
  return next === undefined ? undefined : wailMoment(next, tick);
}

/**
 * The locks of hair along the bottom, as angles (radians, clockwise from +x, y down): the gaps
 * between them, on the ball's edge or just inside it. A lock's tip reaches LOCK_REACH (as a
 * quadratic's control radius), further on the wail, never past an icon's padding (12% of r).
 */
const LOCK_GAPS = [-0.09, 0.66, 1.26, 1.88, 2.48, 3.23] as const;
const LOCK_GAP_RADIUS = 0.88;
const LOCK_REACH = 1.22;
const LOCK_LIFT = 0.06;
/** The face, as fractions of r: a parting at the top, the cheeks, the chin. */
const FACE = { top: -0.42, cheekX: 0.45, cheekY: 0.04, chin: 0.66 } as const;
/** Hollow eyes slanting in sorrow, a pale glint deep in each. */
const EYE = { x: 0.19, y: -0.03, rx: 0.085, ry: 0.13, tilt: 0.32, glint: 0.032 } as const;
const MOUTH = { y: 0.38, rx: 0.11, rest: 0.045, breath: 0.15, wail: 0.25 } as const;
/**
 * Strands falling down each side of the hair, following the face round from the parting to the
 * locks: [from, bend, to] as fractions of r (the left mirrors them).
 */
const STRANDS = [
  [
    [0.06, -0.5],
    [0.62, -0.5],
    [0.6, 0.7],
  ],
  [
    [0.1, -0.76],
    [0.88, -0.62],
    [0.8, 0.52],
  ],
] as const;

const polar = (angle: number, radius: number): readonly [number, number] => [
  Math.cos(angle) * radius,
  Math.sin(angle) * radius,
];

function face(p: Painter, r: number): void {
  p.beginPath();
  p.moveTo(0, FACE.top * r);
  p.quadraticCurveTo(-FACE.cheekX * 0.92 * r, FACE.top * r, -FACE.cheekX * r, FACE.cheekY * r);
  p.quadraticCurveTo(-FACE.cheekX * 0.9 * r, FACE.chin * r, 0, FACE.chin * r);
  p.quadraticCurveTo(FACE.cheekX * 0.9 * r, FACE.chin * r, FACE.cheekX * r, FACE.cheekY * r);
  p.quadraticCurveTo(FACE.cheekX * 0.92 * r, FACE.top * r, 0, FACE.top * r);
  p.closePath();
}

/**
 * Long hair in the ball's own colour round a pale face, strands falling down each side,
 * two hollow slanting eyes and the mouth that tells where the wail is up to.
 */
export const bansheeDesign: BallDesign = {
  facing: 'none',
  outline(p, { ball, radius: r, tick }) {
    const { wail } = wailMomentOf(ball, tick) ?? { wail: 0 };
    const reach = LOCK_REACH + LOCK_LIFT * wail;
    const [first] = LOCK_GAPS;
    // Over the top, the plain edge; then down through the locks, back round to the start.
    p.arc(0, 0, r, LOCK_GAPS[LOCK_GAPS.length - 1] ?? 0, first + Math.PI * 2);
    for (let index = 1; index < LOCK_GAPS.length; index++) {
      const from = LOCK_GAPS[index - 1] ?? 0;
      const to = LOCK_GAPS[index] ?? 0;
      const edge = index === LOCK_GAPS.length - 1 ? 1 : LOCK_GAP_RADIUS;
      const [cx, cy] = polar((from + to) / 2, reach);
      const [x, y] = polar(to, edge);
      p.quadraticCurveTo(cx * r, cy * r, x * r, y * r);
    }
    p.closePath();
  },
  draw(p, { ball, radius: r, accent, tick }) {
    const { breath, wail } = wailMomentOf(ball, tick) ?? { breath: 0, wail: 0 };
    const alpha = p.globalAlpha;
    // The hair's strands, faint in the dark accent, falling round the face.
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.globalAlpha = alpha * theme.bansheeStrandAlpha;
    p.lineWidth = theme.markLine * 0.45 * r;
    p.beginPath();
    for (const side of [-1, 1]) {
      for (const [from, bend, to] of STRANDS) {
        p.moveTo(side * from[0] * r, from[1] * r);
        p.quadraticCurveTo(side * bend[0] * r, bend[1] * r, side * to[0] * r, to[1] * r);
      }
    }
    p.stroke();
    p.globalAlpha = alpha;
    p.fillStyle = theme.bansheeFace;
    face(p, r);
    p.fill();
    // Hollow eyes, slanting down at their outer ends, a faint light deep in each.
    for (const side of [-1, 1]) {
      p.save();
      p.translate(side * EYE.x * r, EYE.y * r);
      p.rotate(-side * EYE.tilt);
      p.scale(EYE.rx / EYE.ry, 1);
      p.fillStyle = accent;
      p.beginPath();
      p.arc(0, 0, EYE.ry * r, 0, Math.PI * 2);
      p.fill();
      p.restore();
      p.fillStyle = theme.bansheeWail;
      p.beginPath();
      p.arc(side * EYE.x * r, (EYE.y + 0.03) * r, EYE.glint * r, 0, Math.PI * 2);
      p.fill();
    }
    const open = Math.max(
      MOUTH.rest + (MOUTH.breath - MOUTH.rest) * breath,
      MOUTH.rest + (MOUTH.wail - MOUTH.rest) * wail,
    );
    const width = MOUTH.rx + 0.04 * Math.max(breath, wail);
    p.fillStyle = accent;
    p.save();
    p.translate(0, MOUTH.y * r);
    p.scale(1, open / width);
    p.beginPath();
    p.arc(0, 0, width * r, 0, Math.PI * 2);
    p.fill();
    p.restore();
  },
};
