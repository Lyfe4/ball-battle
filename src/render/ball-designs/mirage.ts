// The Mirage's look (ADR 0077): a desert mirage, no face. A light, glassy ball: a warm hazy sky over
// dry sand that fills most of it, the dune line wavering in the heat with thin shimmers rising off
// it and a small cactus on a dune, and on the sand the fake oasis: a small pool, see-through and
// wavering, with a soft halo and two ripples. The pool shows where its copy is up to: clear while
// the copy shows, gone the moment it pops (dry sand) and fading back in until it returns. The copy,
// drawn on the court by the same design (mirage-copy.ts), is the same shimmering ball. One set of
// proportions in fractions of r at every size; its heat wavers with the sim's clock and holds still
// with reduced motion.
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
 * copy's wobbling outline, the pool's wavering edge).
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
 * The desert, in fractions of r (y down): the horizon where the sand meets the sky at the ball's
 * edge, the dunes' height over it and how far the heat makes the dune line waver (waves across
 * it), the pool lying on the sand (centre, half-width, height share, how far its edge wavers) and
 * the cactus on the right-hand dune (its x, height, arm reach and stroke).
 */
const HORIZON = -0.14;
const DUNE = { height: 0.1, waver: 0.03, waves: 7 } as const;
const POOL = { x: -0.1, y: 0.42, half: 0.48, squash: 0.34, wobble: 0.08, waves: 6 } as const;
const CACTUS = { x: 0.5, height: 0.3, arm: 0.1, width: 0.075 } as const;
/** The heat: thin shimmers rising off the dunes to here and fading, two at a time. */
const HEAT = { from: -0.3, to: -0.78, half: 0.32, waves: 1.5, amp: 0.035, count: 2 } as const;
/** The gloss: a thin crescent at the top left, as an arc's centre, radius and sweep. */
const GLOSS = { x: 0, y: 0, radius: 0.8, from: Math.PI * 1.12, to: Math.PI * 1.38 } as const;
/** Where the sand meets the ball's edge: the horizon's half-width. */
const EDGE = Math.cos(Math.asin(HORIZON));

/** Where the heat is in its wavering on `tick`, as a phase in radians; held with reduced motion. */
const heatPhase = (tick: number, still: boolean): number =>
  still ? 0 : ((tick / theme.mirageHeatTicks) % 1) * Math.PI * 2;

/**
 * The dune line's height at `x` (fractions of r): two low humps meeting the ball's edge at the
 * horizon, wavering through the heat.
 */
function duneAt(x: number, phase: number): number {
  const fade = Math.max(0, 1 - (x / EDGE) * (x / EDGE));
  const humps = DUNE.height * (0.6 + 0.4 * Math.sin(x * 4 + 1.2));
  return HORIZON - fade * (humps + DUNE.waver * Math.sin(x * DUNE.waves + phase));
}

/** The sand: everything below the wavering dune line. */
function sand(p: Painter, r: number, phase: number): void {
  const a = Math.asin(HORIZON);
  const steps = 16;
  p.beginPath();
  p.moveTo(-EDGE * r, HORIZON * r);
  for (let index = 1; index < steps; index++) {
    const x = -EDGE + (2 * EDGE * index) / steps;
    p.lineTo(x * r, duneAt(x, phase) * r);
  }
  p.lineTo(EDGE * r, HORIZON * r);
  p.arc(0, 0, r, a, Math.PI - a);
  p.closePath();
}

/** The pool's wavering outline, an ellipse lying on the sand, `grow` times its size. */
function pool(p: Painter, r: number, phase: number, grow: number): void {
  p.save();
  p.translate(POOL.x * r, POOL.y * r);
  p.scale(1, POOL.squash);
  p.beginPath();
  wavyCircle(p, POOL.half * grow * r, POOL.waves, POOL.wobble, phase, 3);
  p.restore();
}

/** A small cactus standing on the right-hand dune: a trunk and two arms bending up. */
function cactus(p: Painter, r: number, phase: number): void {
  const x = CACTUS.x;
  const base = duneAt(x, phase) + 0.02;
  const at = (share: number) => (base - CACTUS.height * share) * r;
  p.strokeStyle = theme.mirageCactus;
  p.lineWidth = CACTUS.width * r;
  p.lineCap = 'round';
  p.lineJoin = 'round';
  p.beginPath();
  p.moveTo(x * r, base * r);
  p.lineTo(x * r, at(1));
  p.moveTo(x * r, at(0.45));
  p.lineTo((x - CACTUS.arm) * r, at(0.45));
  p.lineTo((x - CACTUS.arm) * r, at(0.8));
  p.moveTo(x * r, at(0.6));
  p.lineTo((x + CACTUS.arm) * r, at(0.6));
  p.lineTo((x + CACTUS.arm) * r, at(0.95));
  p.stroke();
}

/** Thin shimmers rising off the dunes and fading as they go; held at fixed heights when still. */
function heat(p: Painter, r: number, tick: number, still: boolean, alpha: number): void {
  const rise = still ? 0.35 : (tick / theme.mirageRiseTicks) % 1;
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

/** The pool's two ripple lines, swaying a little against each other in the heat. */
function ripples(p: Painter, r: number, phase: number, still: boolean): void {
  const sway = (still ? 0 : Math.sin(phase)) * 0.05;
  p.beginPath();
  p.moveTo((POOL.x - 0.22 + sway) * r, (POOL.y - 0.02) * r);
  p.lineTo((POOL.x + 0.12 + sway) * r, (POOL.y - 0.02) * r);
  p.moveTo((POOL.x - 0.05 - sway) * r, (POOL.y + 0.07) * r);
  p.lineTo((POOL.x + 0.24 - sway) * r, (POOL.y + 0.07) * r);
  p.stroke();
}

/** The Mirage's markings, for the ball and for its copy on the court. */
export function drawMirage(p: Painter, view: DesignView): void {
  const { ball, radius: r, tick } = view;
  const still = view.still === true;
  const state = mirageStateOf(ball);
  const ready = state === undefined ? 1 : copyReadiness(state, tick);
  const alpha = p.globalAlpha;
  const phase = heatPhase(tick, still);
  // Dry desert: warm sand under a dune line wavering in the heat, a cactus on a dune.
  p.fillStyle = theme.mirageSand;
  sand(p, r, phase);
  p.fill();
  cactus(p, r, phase);
  // The fake oasis: a small pool on the sand, see-through and wavering inside a soft halo, as
  // clear as its copy is ready.
  if (ready > 0) {
    p.fillStyle = theme.miragePool;
    p.globalAlpha = alpha * ready * theme.miragePoolHalo;
    pool(p, r, phase, 1.25);
    p.fill();
    p.globalAlpha = alpha * ready * theme.miragePoolAlpha;
    pool(p, r, -phase, 1);
    p.fill();
    p.strokeStyle = theme.mirageHaze;
    p.lineCap = 'round';
    p.lineWidth = theme.mirageRippleWidth * r;
    p.globalAlpha = alpha * ready * theme.mirageRippleAlpha;
    ripples(p, r, phase, still);
  }
  p.strokeStyle = theme.mirageHaze;
  p.lineCap = 'round';
  p.lineJoin = 'round';
  p.lineWidth = theme.mirageHeatWidth * r;
  heat(p, r, tick, still, alpha);
  p.globalAlpha = alpha * theme.mirageGlossAlpha;
  p.lineWidth = theme.mirageGlossWidth * r;
  p.beginPath();
  p.arc(GLOSS.x * r, GLOSS.y * r, GLOSS.radius * r, GLOSS.from, GLOSS.to);
  p.stroke();
  p.globalAlpha = alpha;
}

export const mirageDesign: BallDesign = { facing: 'none', draw: drawMirage };
