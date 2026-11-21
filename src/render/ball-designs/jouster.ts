// The Jouster's look (ADR 0077): a tournament knight. Its body is a heraldic shield quartered in
// gold and blue; on it stands a closed steel great helm, face on, with a narrow eye slit and a
// breathing cross, a red feather plume curling up from its top. Its tournament lance, spiral-striped
// with a cone hand-guard, is couched at its right side and points where it heads: carried raised
// (turned up and short), lowered over the second before a charge until it points dead ahead past
// its edge, down through the charge and raised when the charge ends. Only the lance turns with its
// heading; the knight stays upright. The streak behind a charge is drawn on the court (trails.ts).
// One set of proportions in fractions of r at every size; it moves only as the sim's clock does.
import { jousterStateOf, type JousterState } from '../../sim/balls/jouster.ts';
import { theme } from '../theme.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

/** How far down the lance is on `tick`: 0 raised, 1 lowered (the second before and through a charge). */
export function lanceDown(state: JousterState, tick: number): number {
  if (state.charging) return 1;
  return Math.min(1, Math.max(0, 1 - (state.nextCharge - tick) / theme.lanceLowerTicks));
}

type Point = readonly [number, number];

/** The great helm, face on, as fractions of r: a flat top, straight cheeks and a flared foot. */
const HELM: readonly Point[] = [
  [-0.34, -0.36],
  [0.34, -0.36],
  [0.38, 0.3],
  [0.48, 0.5],
  [-0.48, 0.5],
  [-0.38, 0.3],
];
/** The top's slight dome over the flat crown, as a quadratic's control height. */
const CROWN = -0.46;
/** The eye slit across it, and the breathing cross below it on the right cheek. */
const SLIT = { y: -0.13, half: 0.3, height: 0.075 } as const;
const BREATH = { x: 0.17, y: 0.16, arm: 0.09, width: 0.05 } as const;
/** The plume: a feather from the crown curling up to the right, its tip inside the ball. */
const PLUME = {
  base: [0.06, -0.42],
  tip: [0.5, -0.78],
  outer: [0.05, -0.95],
  inner: [0.42, -0.5],
} as const;
/**
 * The lance, in its heading's frame, as fractions of r: couched at the right side (y), its butt
 * behind the centre, its tip raised and lowered (never more than an icon's padding past the edge),
 * its width at the guard, the cone guard, its stripes, and how far it is turned up while raised.
 */
const LANCE = {
  side: 0.52,
  /** Raised, it stands upright at the knight's right, leaning this far (radians) off straight up. */
  raisedAt: [0.6, 0.12],
  raisedLean: 0.28,
  butt: -0.5,
  guard: -0.22,
  raisedTip: 0.5,
  loweredTip: 1.1,
  width: 0.2,
  guardWidth: 0.42,
  stripes: 4,
} as const;

/** The two quarters of the shield in the second tincture: top right and bottom left. */
function quarters(p: Painter, r: number): void {
  p.beginPath();
  p.moveTo(0, 0);
  p.arc(0, 0, r, -Math.PI / 2, 0);
  p.closePath();
  p.moveTo(0, 0);
  p.arc(0, 0, r, Math.PI / 2, Math.PI);
  p.closePath();
}

function helm(p: Painter, r: number, accent: string): void {
  p.fillStyle = theme.jousterSteel;
  p.strokeStyle = accent;
  p.lineWidth = theme.markLine * 0.8 * r;
  p.lineJoin = 'round';
  p.beginPath();
  const [first, ...rest] = HELM;
  if (first === undefined) return;
  p.moveTo(first[0] * r, first[1] * r);
  p.quadraticCurveTo(0, CROWN * r, (HELM[1]?.[0] ?? 0) * r, (HELM[1]?.[1] ?? 0) * r);
  for (const [x, y] of rest.slice(1)) p.lineTo(x * r, y * r);
  p.closePath();
  p.fill();
  p.stroke();
  // The eye slit, dark, and the breathing cross.
  p.fillStyle = accent;
  p.beginPath();
  p.rect(-SLIT.half * r, (SLIT.y - SLIT.height / 2) * r, 2 * SLIT.half * r, SLIT.height * r);
  p.rect(
    (BREATH.x - BREATH.arm) * r,
    (BREATH.y - BREATH.width / 2) * r,
    2 * BREATH.arm * r,
    BREATH.width * r,
  );
  p.rect(
    (BREATH.x - BREATH.width / 2) * r,
    (BREATH.y - BREATH.arm) * r,
    BREATH.width * r,
    2 * BREATH.arm * r,
  );
  p.fill();
}

function plume(p: Painter, r: number, accent: string): void {
  const [bx, by] = PLUME.base;
  const [tx, ty] = PLUME.tip;
  p.fillStyle = theme.jousterPlume;
  p.strokeStyle = accent;
  p.lineWidth = theme.markLine * 0.6 * r;
  p.beginPath();
  p.moveTo(bx * r, by * r);
  p.quadraticCurveTo(PLUME.outer[0] * r, PLUME.outer[1] * r, tx * r, ty * r);
  p.quadraticCurveTo(PLUME.inner[0] * r, PLUME.inner[1] * r, bx * r, by * r);
  p.closePath();
  p.fill();
  p.stroke();
}

/**
 * Where the lance stands, in its heading's frame (`turn` the heading's angle): raised, upright at
 * the knight's right whichever way it heads; lowered, couched at its right side pointing dead
 * ahead. In between it swings the shorter way round.
 */
function lancePose(down: number, turn: number): { x: number; y: number; angle: number } {
  const [ux, uy] = LANCE.raisedAt;
  const cos = Math.cos(-turn);
  const sin = Math.sin(-turn);
  const raised = { x: ux * cos - uy * sin, y: ux * sin + uy * cos };
  const up = -Math.PI / 2 + LANCE.raisedLean - turn;
  const swing = Math.atan2(Math.sin(-up), Math.cos(-up));
  return {
    x: raised.x * (1 - down),
    y: raised.y * (1 - down) + LANCE.side * down,
    angle: up + swing * down,
  };
}

function lance(p: Painter, r: number, down: number, turn: number, accent: string): void {
  const tip = LANCE.raisedTip + (LANCE.loweredTip - LANCE.raisedTip) * down;
  const pose = lancePose(down, turn);
  p.save();
  p.translate(pose.x * r, pose.y * r);
  p.rotate(pose.angle);
  const half = LANCE.width / 2;
  const widthAt = (x: number) => half * Math.max(0, (tip - x) / (tip - LANCE.guard));
  p.fillStyle = theme.lance;
  p.strokeStyle = accent;
  p.lineWidth = theme.markLine * 0.5 * r;
  p.lineJoin = 'round';
  p.beginPath();
  p.moveTo(LANCE.butt * r, -half * 0.6 * r);
  p.lineTo(LANCE.guard * r, -half * r);
  p.lineTo(tip * r, 0);
  p.lineTo(LANCE.guard * r, half * r);
  p.lineTo(LANCE.butt * r, half * 0.6 * r);
  p.closePath();
  p.fill();
  p.stroke();
  // The spiral stripes: slanted bands across the shaft, ahead of the guard.
  p.fillStyle = theme.lanceStripe;
  p.beginPath();
  const step = (tip - LANCE.guard) / (LANCE.stripes + 1);
  for (let index = 1; index <= LANCE.stripes; index++) {
    const x = LANCE.guard + step * index;
    const band = step * 0.45;
    const lean = step * 0.35;
    p.moveTo((x - lean) * r, -widthAt(x - lean) * r);
    p.lineTo((x - lean + band) * r, -widthAt(x - lean + band) * r);
    p.lineTo((x + band) * r, widthAt(x + band) * r);
    p.lineTo(x * r, widthAt(x) * r);
    p.closePath();
  }
  p.fill();
  // The cone hand-guard, its wide end towards the tip.
  p.fillStyle = theme.jousterSteel;
  p.beginPath();
  p.moveTo((LANCE.guard - 0.2) * r, -half * 0.7 * r);
  p.lineTo(LANCE.guard * r, -(LANCE.guardWidth / 2) * r);
  p.lineTo(LANCE.guard * r, (LANCE.guardWidth / 2) * r);
  p.lineTo((LANCE.guard - 0.2) * r, half * 0.7 * r);
  p.closePath();
  p.fill();
  p.stroke();
  p.restore();
}

/** The heading's turn, undone so the knight stands upright whichever way it heads. */
const upright = (p: Painter, view: DesignView): void => {
  if (view.heading !== undefined) p.rotate(-Math.atan2(view.heading.y, view.heading.x));
};

export const jousterDesign: BallDesign = {
  facing: 'velocity',
  draw(p, view) {
    const { radius: r, accent } = view;
    p.save();
    upright(p, view);
    p.fillStyle = theme.jousterHeraldry;
    quarters(p, r);
    p.fill();
    plume(p, r, accent);
    helm(p, r, accent);
    p.restore();
  },
  // The lance is drawn over the outline: lowered, its tip breaks the ball's edge.
  over(p, { ball, radius: r, tick, accent, heading }) {
    const state = jousterStateOf(ball);
    const turn = heading === undefined ? 0 : Math.atan2(heading.y, heading.x);
    lance(p, r, state === undefined ? 0 : lanceDown(state, tick), turn, accent);
  },
};
