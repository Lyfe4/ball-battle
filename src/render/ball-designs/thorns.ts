import type { BallDesign, Painter } from './types.ts';

interface Spikes {
  readonly count: number;
  /** Where each spike's base sits and how far its tip reaches, as fractions of r. */
  readonly inner: number;
  readonly outer: number;
  /** Half the angle a spike's base spans, as a share of the gap between spikes. */
  readonly halfWidth: number;
}

/** Many slim spikes at full size; fewer, fatter ones at phone size so they still read. */
const FULL: Spikes = { count: 12, inner: 0.56, outer: 0.94, halfWidth: 0.34 };
const SIMPLE: Spikes = { count: 8, inner: 0.46, outer: 0.96, halfWidth: 0.4 };

function drawSpikes(p: Painter, r: number, spikes: Spikes): void {
  const step = (Math.PI * 2) / spikes.count;
  const half = step * spikes.halfWidth;
  p.beginPath();
  for (let index = 0; index < spikes.count; index++) {
    const angle = index * step - Math.PI / 2;
    p.moveTo(Math.cos(angle - half) * spikes.inner * r, Math.sin(angle - half) * spikes.inner * r);
    p.lineTo(Math.cos(angle) * spikes.outer * r, Math.sin(angle) * spikes.outer * r);
    p.lineTo(Math.cos(angle + half) * spikes.inner * r, Math.sin(angle + half) * spikes.inner * r);
    p.closePath();
  }
  p.fill();
}

/**
 * A ring of dark spikes pointing out to the edge. They stay inside the ball, so its round
 * outline is kept, and the centre is left in the ball's own green. (A dark band with thorns
 * pointing inwards was tried; its negative space read as a gear or a star.)
 */
export const thornsDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  draw(p, { radius: r, accent, simple }) {
    p.fillStyle = accent;
    drawSpikes(p, r, simple ? SIMPLE : FULL);
  },
};
