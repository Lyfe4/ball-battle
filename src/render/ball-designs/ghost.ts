import type { BallDesign } from './types.ts';

/** Eyes as [x, y, width, height] fractions of r; rounder and bigger at small size. */
const EYES = { x: 0.24, y: -0.12, width: 0.13, height: 0.2 } as const;
const SIMPLE_EYES = { x: 0.26, y: -0.1, width: 0.17, height: 0.24 } as const;
/** A small round "oh" of a mouth, as [y, radius] fractions of r. */
const MOUTH = { y: 0.3, radius: 0.1 } as const;
const SIMPLE_MOUTH = { y: 0.32, radius: 0.13 } as const;

/**
 * A ghost's face in the dark accent: two tall eyes and a round "oh" of a mouth. While it is phased
 * the whole ball is drawn see-through with a broken outline (the renderer does that from
 * `phasedOf`, ADR 0026), so the design itself never changes.
 */
export const ghostDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  draw(p, { radius: r, accent, simple }) {
    const eyes = simple ? SIMPLE_EYES : EYES;
    const mouth = simple ? SIMPLE_MOUTH : MOUTH;
    p.fillStyle = accent;
    for (const side of [-1, 1]) {
      p.save();
      p.translate(side * eyes.x * r, eyes.y * r);
      p.scale(1, eyes.height / eyes.width);
      p.beginPath();
      p.arc(0, 0, eyes.width * r, 0, Math.PI * 2);
      p.fill();
      p.restore();
    }
    p.beginPath();
    p.arc(0, mouth.y * r, mouth.radius * r, 0, Math.PI * 2);
    p.fill();
  },
};
