// The Jouster's look (ADR 0077): a tournament-gold ball turned where it heads, a pale pennant stripe
// across its back and a white lance wedge. The lance is carried raised (short, turned aside) and is
// lowered over the second before a charge until it points dead ahead, just past the ball's edge;
// it stays down through the charge and is raised again when the charge ends. The streak behind a
// charge is drawn on the court (trails.ts). One set of proportions in fractions of r at every size;
// it moves only as the sim's clock does.
import { jousterStateOf, type JousterState } from '../../sim/balls/jouster.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** How far down the lance is on `tick`: 0 raised, 1 lowered (the second before and through a charge). */
export function lanceDown(state: JousterState, tick: number): number {
  if (state.charging) return 1;
  return Math.min(1, Math.max(0, 1 - (state.nextCharge - tick) / theme.lanceLowerTicks));
}

/**
 * The lance as fractions of r: its butt behind the centre, its tip raised and lowered (never more
 * than an icon's padding past the edge, 12% of r), its width at the guard, and how far it is turned
 * aside while raised (radians).
 */
const LANCE = { butt: -0.42, raisedTip: 0.62, loweredTip: 1.1, width: 0.3, aside: 0.62 } as const;
const GUARD = { x: -0.12, radius: 0.17 } as const;
/** The pennant stripe across its back: between these two chords (fractions of r), and its tail. */
const STRIPE = { from: -0.78, to: -0.42 } as const;

/** The band of the ball between two chords at x = from and x = to (from < to), in r. */
function stripe(p: Painter, r: number): void {
  const half = (x: number) => Math.sqrt(Math.max(0, 1 - x * x));
  const a = Math.atan2(half(STRIPE.from), STRIPE.from);
  const b = Math.atan2(half(STRIPE.to), STRIPE.to);
  p.beginPath();
  p.arc(0, 0, r, b, a);
  p.lineTo(STRIPE.from * r, -half(STRIPE.from) * r);
  p.arc(0, 0, r, -a, -b);
  p.closePath();
}

function lance(p: Painter, r: number, down: number): void {
  const tip = LANCE.raisedTip + (LANCE.loweredTip - LANCE.raisedTip) * down;
  p.save();
  p.rotate(-LANCE.aside * (1 - down));
  p.fillStyle = theme.lance;
  p.beginPath();
  p.moveTo(LANCE.butt * r, -(LANCE.width / 4) * r);
  p.lineTo(GUARD.x * r, -(LANCE.width / 2) * r);
  p.lineTo(tip * r, 0);
  p.lineTo(GUARD.x * r, (LANCE.width / 2) * r);
  p.lineTo(LANCE.butt * r, (LANCE.width / 4) * r);
  p.closePath();
  p.fill();
  p.fillStyle = theme.lanceGuard;
  p.beginPath();
  p.arc(GUARD.x * r, 0, GUARD.radius * r, 0, Math.PI * 2);
  p.fill();
  p.restore();
}

export const jousterDesign: BallDesign = {
  facing: 'velocity',
  draw(p, { radius: r }) {
    p.fillStyle = theme.jousterPennant;
    stripe(p, r);
    p.fill();
  },
  // The lance is drawn over the outline: lowered, its tip breaks the ball's edge.
  over(p, { ball, radius: r, tick }) {
    const state = jousterStateOf(ball);
    lance(p, r, state === undefined ? 0 : lanceDown(state, tick));
  },
};
