import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** Petals as fractions of r: how far out each sits and how big it is. */
const PETAL = { distance: 0.4, size: 0.24 } as const;
/** The petals' directions: five, evenly spaced, the first straight up. */
const PETALS = [0, 1, 2, 3, 4].map((index) => {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
  return [Math.cos(angle), Math.sin(angle)] as const;
});

/**
 * A flower in the dark accent with a pale centre, always open: it is always regrowing (ADR 0045),
 * and every regrowth shows as the heal pulse. At small size the petals are bigger and the centre
 * smaller.
 */
export const bloomDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, simple }) {
    const petal = PETAL;
    const grow = simple ? 1.2 : 1;
    p.fillStyle = accent;
    for (const [x, y] of PETALS) {
      p.beginPath();
      p.arc(x * petal.distance * r, y * petal.distance * r, petal.size * grow * r, 0, Math.PI * 2);
      p.fill();
    }
    p.fillStyle = theme.bloomCentre;
    p.beginPath();
    p.arc(0, 0, (simple ? 0.12 : 0.15) * r, 0, Math.PI * 2);
    p.fill();
  },
};
