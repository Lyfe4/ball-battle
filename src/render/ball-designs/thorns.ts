import type { BallDesign, Painter } from './types.ts';

interface Spikes {
  readonly count: number;
  /** Where each dark spine's base sits and where it meets the body's edge, as fractions of r. */
  readonly inner: number;
  readonly body: number;
  /** How far each spike stands proud of the ball, as a fraction of r (at most an icon's 12%). */
  readonly tip: number;
  /** Half the angle a spike's base spans, as a share of the gap between spikes. */
  readonly halfWidth: number;
}

/** Many slim spikes at full size; fewer, fatter ones at phone size so they still read. */
const FULL: Spikes = { count: 12, inner: 0.5, body: 0.93, tip: 1.1, halfWidth: 0.3 };
const SIMPLE: Spikes = { count: 8, inner: 0.4, body: 0.92, tip: 1.11, halfWidth: 0.36 };

const spikesFor = (simple: boolean): Spikes => (simple ? SIMPLE : FULL);

/** Unit directions this module needs, worked out once: a frame only scales them. */
const DIRECTIONS = new Map<number, readonly [number, number]>();

/** The point at `distance` (a fraction of r) along `angle`. */
function at(angle: number, distance: number, r: number): readonly [number, number] {
  let direction = DIRECTIONS.get(angle);
  if (direction === undefined) {
    direction = [Math.cos(angle), Math.sin(angle)];
    DIRECTIONS.set(angle, direction);
  }
  return [direction[0] * distance * r, direction[1] * distance * r];
}

/**
 * The body's own edge: a round body at `body` with a spike breaking out of it at every spine, so
 * the Thorns is the one ball whose silhouette is spiky. Its fill, flash and outline all follow it.
 */
function spikyEdge(p: Painter, r: number, spikes: Spikes): void {
  const step = (Math.PI * 2) / spikes.count;
  const half = step * spikes.halfWidth;
  for (let index = 0; index < spikes.count; index++) {
    const angle = index * step - Math.PI / 2;
    const [bx, by] = at(angle - half, spikes.body, r);
    if (index === 0) p.moveTo(bx, by);
    else p.lineTo(bx, by);
    p.lineTo(...at(angle, spikes.tip, r));
    p.lineTo(...at(angle + half, spikes.body, r));
    p.arc(0, 0, spikes.body * r, angle + half, angle + step - half);
  }
  p.closePath();
}

/**
 * Spiked all over (ADR 0013, 0056): green spikes stand out of the ball's edge all round, so its
 * outline is the warning, and a dark spine runs in from each one. It has nothing stored and no
 * timer: every bump it takes is met the same, so the look never changes. At small size fewer,
 * fatter spikes.
 */
export const thornsDesign: BallDesign = {
  facing: 'none',
  outline(p, { radius: r, simple }) {
    spikyEdge(p, r, spikesFor(simple));
  },
  draw(p, { radius: r, accent, simple }) {
    const spikes = spikesFor(simple);
    const step = (Math.PI * 2) / spikes.count;
    const half = step * spikes.halfWidth * 0.7;
    p.fillStyle = accent;
    p.beginPath();
    for (let index = 0; index < spikes.count; index++) {
      const angle = index * step - Math.PI / 2;
      p.moveTo(...at(angle - half, spikes.inner, r));
      p.lineTo(...at(angle, spikes.tip - 0.08, r));
      p.lineTo(...at(angle + half, spikes.inner, r));
      p.closePath();
    }
    p.fill();
  },
};
