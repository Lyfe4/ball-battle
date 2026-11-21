// The Mirage's look (ADR 0077): a smooth rose ball with a soft wavy rim, like heat over sand, and
// calm eyes that glance at its copy while it shows. Two bands of haze across it show where its copy
// is up to: full while the copy shows, emptied by a pop and filling again until it shimmers back.
// The copy itself is drawn on the court (mirage-copy.ts). One set of proportions in fractions of r
// at every size; it moves only as the sim's clock does.
import {
  COPY_BACK_TICKS,
  COPY_OFFSET,
  FIRST_COPY_TICK,
  mirageStateOf,
  type MirageState,
} from '../../sim/balls/mirage.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** Samples per wave round the Mirage's shallow rim: joined by curves, smooth at any size. */
const RIM_SAMPLES = 2;

/**
 * A closed circle of radius `r` whose edge rises and falls `waves` times round by `reach` r,
 * turned by `phase` radians of wave: curves through the midpoints of `samples` points a wave (a
 * deep wave needs more to stay round).
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

/** The haze bands, as fractions of r: their heights, half-width and the height of their waves. */
const HAZE = { ys: [0.38, 0.58], half: 0.46, wave: 0.045, waves: 1.5, width: 0.075 } as const;
/** Its eyes: centres, size and how far the pupils look towards the copy. */
const EYE = { x: 0.24, y: -0.12, rx: 0.13, ry: 0.09, pupil: 0.055, look: 0.05 } as const;

/** Both bands of haze, each from its left end to `share` of its length: gentle waves across it. */
function hazeBands(p: Painter, r: number, share: number): void {
  if (share <= 0) return;
  const steps = 12;
  p.beginPath();
  for (const y of HAZE.ys) {
    const point = (t: number): [number, number] => [
      (-HAZE.half + 2 * HAZE.half * t) * r,
      (y + HAZE.wave * Math.sin(t * Math.PI * 2 * HAZE.waves)) * r,
    ];
    p.moveTo(...point(0));
    // Whole steps, then the part-step it has reached, so the band grows smoothly.
    for (let index = 1; index <= Math.floor(steps * share); index++) {
      p.lineTo(...point(index / steps));
    }
    p.lineTo(...point(share));
  }
  p.stroke();
}

function drawEyes(p: Painter, r: number, state: MirageState | undefined, pupil: string): void {
  // While its copy shows, the pupils glance towards it.
  const look =
    state?.copyOn === true
      ? { x: (state.copyDx / COPY_OFFSET) * EYE.look, y: (state.copyDy / COPY_OFFSET) * EYE.look }
      : { x: 0, y: 0 };
  for (const side of [-1, 1]) {
    p.fillStyle = theme.mirageHaze;
    p.save();
    p.translate(side * EYE.x * r, EYE.y * r);
    p.scale(EYE.rx / EYE.ry, 1);
    p.beginPath();
    p.arc(0, 0, EYE.ry * r, 0, Math.PI * 2);
    p.fill();
    p.restore();
    p.beginPath();
    p.arc((side * EYE.x + look.x) * r, (EYE.y + look.y) * r, EYE.pupil * r, 0, Math.PI * 2);
    p.fillStyle = pupil;
    p.fill();
  }
}

export const mirageDesign: BallDesign = {
  facing: 'none',
  outline(p, { radius: r }) {
    wavyCircle(p, r, theme.mirageRimWaves, theme.mirageRimReach, 0, RIM_SAMPLES);
  },
  draw(p, { ball, radius: r, accent, tick }) {
    const state = mirageStateOf(ball);
    const ready = state === undefined ? 1 : copyReadiness(state, tick);
    const alpha = p.globalAlpha;
    p.strokeStyle = theme.mirageHaze;
    p.lineCap = 'round';
    p.lineWidth = HAZE.width * r;
    // The empty track, faint, so a band part-filled reads as "on its way back".
    p.lineJoin = 'round';
    p.globalAlpha = alpha * theme.mirageHazeEmptyAlpha;
    hazeBands(p, r, 1);
    p.globalAlpha = alpha;
    hazeBands(p, r, ready);
    drawEyes(p, r, state, accent);
  },
};
