import { MAX_STACKS, stacksOf } from '../../sim/balls/speedster.ts';
import { theme } from '../theme.ts';
import { streakCount } from './state.ts';
import type { BallDesign, Painter } from './types.ts';

/** The chevron's tip, as a fraction of r ahead of the centre. */
const TIP = 0.5;
/** Length of each side of the dart, as a fraction of r. */
const ARM = 0.62;
/** Half the angle at the dart's tip: 30° each side for a sharp 60° point. Precomputed cos, sin. */
const HALF_ANGLE_COS = 0.8660254037844387;
const HALF_ANGLE_SIN = 0.5;
/** How far the dart's back is notched in, as a fraction of r. */
const NOTCH = 0.2;

/**
 * The gauge: MAX_STACKS bars round the back of the ball, as fractions of r and radians. It wraps
 * the half behind the dart, so it trails like speed lines; each bar is long enough to count at
 * phone size.
 */
const GAUGE = { radius: 0.74, width: 0.2, widthSimple: 0.26, sweep: Math.PI * 1.16, gap: 0.16 };

/** One bar of the gauge: the `index`th of MAX_STACKS from one end of the sweep to the other. */
function gaugeBar(p: Painter, r: number, index: number): void {
  const bar = (GAUGE.sweep - GAUGE.gap * (MAX_STACKS - 1)) / MAX_STACKS;
  const start = Math.PI - GAUGE.sweep / 2 + index * (bar + GAUGE.gap);
  p.beginPath();
  p.arc(0, 0, GAUGE.radius * r, start, start + bar);
  p.stroke();
}

function drawDart(p: Painter, r: number, scale: number): void {
  const backX = (TIP - ARM * HALF_ANGLE_COS) * r * scale;
  const backY = ARM * HALF_ANGLE_SIN * r * scale;
  p.beginPath();
  p.moveTo(TIP * r * scale, 0);
  p.lineTo(backX, backY);
  p.lineTo(backX + NOTCH * r * scale, 0);
  p.lineTo(backX, -backY);
  p.closePath();
  p.fill();
}

/**
 * A sharp dart pointing where it is going, wrapped at the back by a speed gauge of five bars, one
 * per stack it can hold: every wall bounce lights one, a bump empties them all. The empty bars stay
 * faint, so it always reads as 2 of 5, at every size. Full, the dart's heart lights white. At small
 * size the dart is larger and the bars thicker, still five.
 */
export const speedsterDesign: BallDesign = {
  facing: 'velocity',
  draw(p, { ball, radius: r, accent, simple }) {
    const stacks = Math.min(MAX_STACKS, streakCount(stacksOf(ball)));
    p.save();
    // Scaled by what the ball is drawn at, so a defeated or phased Speedster stays see-through.
    const alpha = p.globalAlpha;
    p.fillStyle = accent;
    p.strokeStyle = accent;
    p.lineCap = 'butt';
    p.lineWidth = (simple ? GAUGE.widthSimple : GAUGE.width) * r;
    for (let index = 0; index < MAX_STACKS; index++) {
      p.globalAlpha = alpha * (index < stacks ? 1 : theme.speedsterEmptyAlpha);
      gaugeBar(p, r, index);
    }
    p.globalAlpha = alpha;

    // A filled, notched dart rather than an open angle: an open chevron facing diagonally has one
    // arm near horizontal and reads as a "7"; a solid point reads as a pointer at any angle.
    const scale = simple ? 1.06 : 0.94;
    drawDart(p, r, scale);
    if (stacks >= MAX_STACKS) {
      p.fillStyle = theme.highlight;
      drawDart(p, r, scale * 0.45);
    }
    p.restore();
  },
};
