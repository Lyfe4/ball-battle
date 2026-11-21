// The Mirage's look (ADR 0077): a mirage, no face. A light, glassy ball: a warm hazy sky, low
// golden dunes on the horizon with thin heat shimmers rising off them, and below the horizon the
// fake oasis, a cool shimmering pool with ripples and the dunes' faint reflection, on warm sand. The
// pool shows where its copy is up to: clear while the copy shows, gone the moment it pops (dry sand)
// and fading back in until it returns. The copy, drawn on the court by the
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

/**
 * How ready its copy is on `tick`, 0 (just popped) to 1: whole while it shows and before its first
 * copy (nothing has popped it yet, so a fight and its icon open on a clear pool).
 */
export function copyReadiness(state: MirageState, tick: number): number {
  if (state.copyOn || state.backAt <= FIRST_COPY_TICK) return 1;
  return Math.min(1, Math.max(0, 1 - (state.backAt - tick) / COPY_BACK_TICKS));
}

/**
 * The scene, as heights in fractions of r (y down): the horizon the dunes sit on, the pool below it
 * and the sand in front. The dunes are low and gentle: [from, peak, to] x and the peak's height.
 */
const HORIZON = -0.02;
const POOL_BOTTOM = 0.56;
const DUNES = [
  { from: -0.98, peak: [-0.5, -0.17], to: 0.05 },
  { from: -0.1, peak: [0.45, -0.12], to: 0.98 },
] as const;
/** Ripple lines across the pool: heights and half-widths. */
const RIPPLES = [
  [0.2, 0.46],
  [0.38, 0.34],
] as const;
/** The heat: thin shimmers rising from the dunes to here and fading, two at a time. */
const HEAT = { from: -0.2, to: -0.72, half: 0.36, waves: 1.5, amp: 0.035, count: 2 } as const;
/** The gloss: a thin crescent at the top left, as an arc's centre, radius and sweep. */
const GLOSS = { x: 0, y: 0, radius: 0.8, from: Math.PI * 1.12, to: Math.PI * 1.38 } as const;

/** The band of the ball between two heights (fractions of r, top above bottom). */
function band(p: Painter, r: number, top: number, bottom: number): void {
  const t = Math.asin(Math.max(-1, Math.min(1, top)));
  const b = Math.asin(Math.max(-1, Math.min(1, bottom)));
  p.beginPath();
  p.arc(0, 0, r, t, b);
  p.arc(0, 0, r, Math.PI - b, Math.PI - t);
  p.closePath();
}

/** The low dunes on the horizon, or their reflection hanging below it when `flip`. */
function dunes(p: Painter, r: number, flip: boolean): void {
  const y = (value: number) => (flip ? 2 * HORIZON - value : value) * r;
  p.beginPath();
  for (const dune of DUNES) {
    p.moveTo(dune.from * r, y(HORIZON));
    p.quadraticCurveTo(dune.peak[0] * r, y(2 * dune.peak[1] - HORIZON), dune.to * r, y(HORIZON));
    p.closePath();
  }
}

/**
 * The heat: thin wavering lines rising off the dunes and fading as they go, each a share of the
 * way up on the sim's clock; held at fixed heights with reduced motion.
 */
function heat(p: Painter, r: number, tick: number, still: boolean, alpha: number): void {
  const rise = still ? 0.35 : (tick / theme.mirageHeatTicks) % 1;
  for (let index = 0; index < HEAT.count; index++) {
    const share = (rise + index / HEAT.count) % 1;
    const y = HEAT.from + (HEAT.to - HEAT.from) * share;
    p.globalAlpha = alpha * theme.mirageHeatAlpha * Math.sin(share * Math.PI);
    p.beginPath();
    const steps = 8;
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const x = (-HEAT.half + 2 * HEAT.half * t) * r;
      const wy = (y + HEAT.amp * Math.sin(t * Math.PI * 2 * HEAT.waves + share * 6)) * r;
      if (step === 0) p.moveTo(x, wy);
      else p.lineTo(x, wy);
    }
    p.stroke();
  }
}

/** The Mirage's markings, for the ball and for its copy on the court. */
export function drawMirage(p: Painter, view: DesignView): void {
  const { ball, radius: r, tick } = view;
  const state = mirageStateOf(ball);
  const ready = state === undefined ? 1 : copyReadiness(state, tick);
  const alpha = p.globalAlpha;
  // Warm sand below the horizon: the dunes and the ground in front.
  p.fillStyle = theme.mirageSand;
  band(p, r, HORIZON, 1);
  p.fill();
  dunes(p, r, false);
  p.fill();
  // The fake oasis: a cool shimmering pool on the sand, as clear as its copy is ready.
  if (ready > 0) {
    p.globalAlpha = alpha * ready;
    p.fillStyle = theme.miragePool;
    band(p, r, HORIZON, POOL_BOTTOM);
    p.fill();
    p.fillStyle = theme.mirageSand;
    p.globalAlpha = alpha * ready * theme.mirageReflection;
    dunes(p, r, true);
    p.fill();
    p.globalAlpha = alpha * ready;
    p.strokeStyle = theme.mirageHaze;
    p.lineCap = 'round';
    p.lineWidth = theme.mirageRippleWidth * r;
    p.beginPath();
    for (const [y, half] of RIPPLES) {
      p.moveTo(-half * r, y * r);
      p.lineTo(half * r, y * r);
    }
    p.stroke();
  }
  p.strokeStyle = theme.mirageHaze;
  p.lineCap = 'round';
  p.lineJoin = 'round';
  p.lineWidth = theme.mirageHeatWidth * r;
  heat(p, r, tick, view.still === true, alpha);
  p.globalAlpha = alpha * theme.mirageGlossAlpha;
  p.lineWidth = theme.mirageGlossWidth * r;
  p.beginPath();
  p.arc(GLOSS.x * r, GLOSS.y * r, GLOSS.radius * r, GLOSS.from, GLOSS.to);
  p.stroke();
  p.globalAlpha = alpha;
}

export const mirageDesign: BallDesign = { facing: 'none', draw: drawMirage };
