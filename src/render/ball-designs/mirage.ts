// The Mirage's look (ADR 0077): a mirage over hot sand, no face. A glassy ball with a gloss, dunes
// sitting on a horizon across its middle and heat waves rising and wavering over them; below the
// horizon its lower half is half see-through, like sand shimmering, and holds the dunes' faint
// upside-down reflection. The reflection shows where its copy is up to: whole while the copy shows,
// gone the moment it pops and fading back in until it returns. The copy, drawn on the court by the
// same design (mirage-copy.ts), is the same shimmering ball. One set of proportions in fractions of
// r at every size; its heat wavers with the sim's clock and holds still with reduced motion.
import {
  COPY_BACK_TICKS,
  FIRST_COPY_TICK,
  mirageStateOf,
  type MirageState,
} from '../../sim/balls/mirage.ts';
import { theme } from '../theme.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

/**
 * A closed circle of radius `r` whose edge rises and falls `waves` times round by `reach` r,
 * turned by `phase` radians of wave: curves through the midpoints of `samples` points a wave (the
 * copy's wobbling outline).
 */
export function wavyCircle(
  p: Painter,
  r: number,
  waves: number,
  reach: number,
  phase: number,
  samples: number,
): void {
  const count = waves * samples;
  const at = (index: number): [number, number] => {
    const angle = (index / count) * Math.PI * 2;
    const radius = r * (1 + reach * Math.sin(angle * waves + phase));
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  };
  const mid = (index: number): [number, number] => {
    const [ax, ay] = at(index);
    const [bx, by] = at(index + 1);
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  p.moveTo(...mid(0));
  for (let index = 1; index <= count; index++) p.quadraticCurveTo(...at(index), ...mid(index));
  p.closePath();
}

/** How ready its copy is on `tick`, 0 (just popped) to 1 (showing). */
export function copyReadiness(state: MirageState, tick: number): number {
  if (state.copyOn) return 1;
  const wait = state.backAt <= FIRST_COPY_TICK ? FIRST_COPY_TICK : COPY_BACK_TICKS;
  return Math.min(1, Math.max(0, 1 - (state.backAt - tick) / wait));
}

/** The horizon's height, as a fraction of r (y down): a little below the middle. */
const HORIZON = 0.12;
/** The dunes on the horizon: two humps, each from one x to another over a peak. */
const DUNES = [
  { from: -0.92, peak: [-0.42, -0.34], to: 0.04 },
  { from: -0.08, peak: [0.42, -0.2], to: 0.92 },
] as const;
/** Heat waves over the dunes: heights, half-widths, waves across and how far they waver. */
const HEAT = { ys: [-0.66, -0.46, -0.26], half: [0.42, 0.56, 0.62], waves: 2, amp: 0.05 } as const;
/** The gloss: a crescent at the top left, as an arc's centre, radius and sweep. */
const GLOSS = { x: -0.04, y: 0.05, radius: 0.8, from: Math.PI * 1.08, to: Math.PI * 1.42 } as const;

/** The lower half of the ball below the horizon chord. */
function lowerHalf(p: Painter, r: number): void {
  const a = Math.asin(HORIZON);
  p.beginPath();
  p.arc(0, 0, r, a, Math.PI - a);
  p.closePath();
}

/** The dunes, mirrored about the horizon when `flip` (their reflection). */
function dunes(p: Painter, r: number, flip: boolean): void {
  const y = (value: number) => (flip ? 2 * HORIZON - value : value) * r;
  p.beginPath();
  for (const dune of DUNES) {
    p.moveTo(dune.from * r, y(HORIZON));
    p.quadraticCurveTo(dune.peak[0] * r, y(2 * dune.peak[1] - HORIZON), dune.to * r, y(HORIZON));
    p.closePath();
  }
}

/** Heat waves rising over the dunes, wavering with the sim's clock unless held still. */
function heat(p: Painter, r: number, tick: number, still: boolean): void {
  const phase = still ? 0 : ((tick / theme.mirageHeatTicks) % 1) * Math.PI * 2;
  const steps = 10;
  p.beginPath();
  HEAT.ys.forEach((y, line) => {
    const half = HEAT.half[line] ?? 0.5;
    for (let index = 0; index <= steps; index++) {
      const t = index / steps;
      const x = (-half + 2 * half * t) * r;
      const wy = (y + HEAT.amp * Math.sin(t * Math.PI * 2 * HEAT.waves + phase + line)) * r;
      if (index === 0) p.moveTo(x, wy);
      else p.lineTo(x, wy);
    }
  });
  p.stroke();
}

/** The Mirage's markings, for the ball and for its copy on the court. */
export function drawMirage(p: Painter, view: DesignView): void {
  const { ball, radius: r, accent, tick } = view;
  const state = mirageStateOf(ball);
  const ready = state === undefined ? 1 : copyReadiness(state, tick);
  const alpha = p.globalAlpha;
  // The glassy lower half: the floor shows through, like sand shimmering.
  p.fillStyle = theme.arenaFill;
  p.globalAlpha = alpha * theme.mirageGlass;
  lowerHalf(p, r);
  p.fill();
  // The dunes' upside-down reflection, as strong as its copy is ready.
  p.fillStyle = accent;
  if (ready > 0) {
    p.globalAlpha = alpha * theme.mirageReflection * ready;
    dunes(p, r, true);
    p.fill();
  }
  p.globalAlpha = alpha;
  dunes(p, r, false);
  p.fill();
  p.strokeStyle = theme.mirageHaze;
  p.lineCap = 'round';
  p.lineJoin = 'round';
  p.lineWidth = theme.mirageHeatWidth * r;
  heat(p, r, tick, view.still === true);
  p.globalAlpha = alpha * theme.mirageGlossAlpha;
  p.lineWidth = theme.mirageGlossWidth * r;
  p.beginPath();
  p.arc(GLOSS.x * r, GLOSS.y * r, GLOSS.radius * r, GLOSS.from, GLOSS.to);
  p.stroke();
  p.globalAlpha = alpha;
}

export const mirageDesign: BallDesign = { facing: 'none', draw: drawMirage };
