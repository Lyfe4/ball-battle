import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** The hood, as fractions of r: its rounded crown and point, and how far down and out it falls. */
const HOOD = { crown: 0.46, crownY: -0.04, point: -0.72, flare: 0.64, bottom: 0.66 } as const;
/** Eyes glowing out of the hood, as [x, y, radius] fractions of r; bigger at small size. */
const EYES = { x: 0.19, y: 0.06, radius: 0.09 } as const;
const SIMPLE_EYES = { x: 0.2, y: 0.07, radius: 0.13 } as const;

/**
 * A pointed hood in the dark accent with two glowing eyes inside: the one who raises the skeleton
 * minions (ADR 0026). The minions are bone-white skulls ringed in this ball's colour, so the two
 * read as a pair without looking alike.
 */
export const necromancerDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    p.fillStyle = accent;
    p.beginPath();
    // Falling from the crown and flaring out at the shoulders, like a cloak.
    p.moveTo(-HOOD.flare * r, HOOD.bottom * r);
    p.lineTo(-HOOD.crown * r, HOOD.crownY * r);
    p.arc(0, HOOD.crownY * r, HOOD.crown * r, Math.PI, Math.PI * 1.5 - 0.45);
    p.lineTo(0, HOOD.point * r);
    p.arc(0, HOOD.crownY * r, HOOD.crown * r, Math.PI * 1.5 + 0.45, 0);
    p.lineTo(HOOD.flare * r, HOOD.bottom * r);
    p.closePath();
    p.fill();
    const eyes = simple ? SIMPLE_EYES : EYES;
    p.fillStyle = theme.necromancerEyes;
    for (const side of [-1, 1]) {
      p.beginPath();
      p.arc(side * eyes.x * r, eyes.y * r, eyes.radius * r, 0, Math.PI * 2);
      p.fill();
    }
  },
};
