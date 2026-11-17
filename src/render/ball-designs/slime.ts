// The Slime's look (ADR 0060): a glossy jelly. Its edge wobbles slowly, a wide shine sits at its
// upper left, a soft shade at its lower right gives it depth, and it has two eyes. While whole, a
// wavy seam runs down its middle, where it will split; each half is the same creature, smaller,
// with no seam. Squashing on a bump is every ball's (withBallTransform).
import { isSplitSlime } from '../../sim/balls/slime.ts';
import { isFirstOfSide } from '../../sim/side.ts';
import { theme } from '../theme.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

/** Points round the edge; joined by curves through their midpoints, so it stays smooth. */
const EDGE_POINTS = 18;
/** How far the edge wobbles, as a share of r (a little more at phone size, so it still shows). */
const WOBBLE = 0.035;
const WOBBLE_SIMPLE = 0.045;
/** Ticks for one slow turn of the wobble. */
const WOBBLE_TICKS = 150;

/** The edge's distance from the centre at `angle`: two slow ripples, each ball out of step. */
function edgeAt(angle: number, view: DesignView): number {
  const { radius: r, tick, simple, ball } = view;
  // The half split off runs half a turn out of step, so the two never wobble together.
  const offset = isFirstOfSide(ball) ? 0 : Math.PI;
  const t = (tick / WOBBLE_TICKS) * Math.PI * 2 + offset;
  const amount = simple ? WOBBLE_SIMPLE : WOBBLE;
  return (
    r *
    (1 -
      amount +
      amount * 0.6 * Math.sin(3 * angle + t) +
      amount * 0.4 * Math.sin(5 * angle - t * 0.7))
  );
}

function wobblingEdge(p: Painter, view: DesignView): void {
  const points = Array.from({ length: EDGE_POINTS }, (_, i) => {
    const angle = (i / EDGE_POINTS) * Math.PI * 2;
    const distance = edgeAt(angle, view);
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  });
  const mid = (i: number) => {
    const a = points[i % EDGE_POINTS] ?? { x: 0, y: 0 };
    const b = points[(i + 1) % EDGE_POINTS] ?? { x: 0, y: 0 };
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const start = mid(0);
  p.moveTo(start.x, start.y);
  for (let i = 1; i <= EDGE_POINTS; i++) {
    const corner = points[i % EDGE_POINTS] ?? { x: 0, y: 0 };
    const next = mid(i);
    p.quadraticCurveTo(corner.x, corner.y, next.x, next.y);
  }
  p.closePath();
}

/** An oval: a circle squeezed along y, turned by `turn`. */
function oval(p: Painter, x: number, y: number, rx: number, ry: number, turn: number): void {
  p.save();
  p.translate(x, y);
  p.rotate(turn);
  p.scale(1, ry / rx);
  p.beginPath();
  p.arc(0, 0, rx, 0, Math.PI * 2);
  p.fill();
  p.restore();
}

export const slimeDesign: BallDesign = {
  facing: 'none',
  outline: wobblingEdge,
  draw(p, view) {
    const { radius: r, accent, simple, tick, ball } = view;
    // Depth: a soft shade inside the lower right, as light through jelly.
    p.fillStyle = accent;
    p.globalAlpha = 0.16;
    oval(p, 0.16 * r, 0.24 * r, 0.62 * r, 0.5 * r, -0.5);
    p.globalAlpha = 1;

    // The seam while whole: a wavy line down the middle, its wave drifting slowly.
    if (!isSplitSlime(ball.abilityState)) {
      p.strokeStyle = accent;
      p.globalAlpha = 0.55;
      p.lineWidth = (simple ? 0.09 : 0.06) * r;
      p.lineCap = 'round';
      p.setLineDash(simple ? [] : [0.16 * r, 0.1 * r]);
      p.beginPath();
      const phase = (tick / WOBBLE_TICKS) * Math.PI * 2;
      for (let i = 0; i <= 8; i++) {
        const y = (-0.78 + (1.56 * i) / 8) * r;
        const x = 0.05 * r * Math.sin(i * 1.6 + phase);
        if (i === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
      p.stroke();
      p.setLineDash([]);
      p.globalAlpha = 1;
    }

    // Two eyes, each with a glint.
    const eye = (simple ? 0.12 : 0.1) * r;
    for (const x of [-0.3, 0.3]) {
      p.fillStyle = accent;
      oval(p, x * r, -0.02 * r, eye * 0.85, eye * 1.15, 0);
      if (simple) continue;
      p.fillStyle = theme.highlight;
      p.beginPath();
      p.arc((x - 0.03) * r, -0.07 * r, eye * 0.35, 0, Math.PI * 2);
      p.fill();
    }

    // The gloss: a wide shine at the upper left and, at full size, a small spark beside it.
    p.fillStyle = theme.highlight;
    p.globalAlpha = 0.6;
    oval(p, -0.42 * r, -0.46 * r, 0.24 * r, 0.11 * r, -0.75);
    p.globalAlpha = 1;
    if (!simple) {
      p.beginPath();
      p.arc(-0.14 * r, -0.66 * r, 0.05 * r, 0, Math.PI * 2);
      p.fill();
    }
  },
};
