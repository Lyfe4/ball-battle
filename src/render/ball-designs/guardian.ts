import type { BallDesign } from './types.ts';

/** The shield's outline, as fractions of r: a flat top, straight sides and a pointed foot. */
const SHIELD = { half: 0.42, top: -0.46, shoulder: 0.06, foot: 0.56, band: 0.07 } as const;

/**
 * A heater shield in the dark accent with a pale band down its middle: the ball behind a shield
 * (ADR 0043). The shield itself, while it is up, is a gold ring around the ball (draw-feel.ts). At
 * small size the band goes.
 */
export const guardianDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, accent, base, simple }) {
    p.fillStyle = accent;
    p.beginPath();
    p.moveTo(-SHIELD.half * r, SHIELD.top * r);
    p.lineTo(SHIELD.half * r, SHIELD.top * r);
    p.lineTo(SHIELD.half * r, SHIELD.shoulder * r);
    p.lineTo(0, SHIELD.foot * r);
    p.lineTo(-SHIELD.half * r, SHIELD.shoulder * r);
    p.closePath();
    p.fill();
    if (simple) return;
    p.fillStyle = base;
    p.beginPath();
    const top = (SHIELD.top + 0.1) * r;
    p.rect(-SHIELD.band * r, top, SHIELD.band * 2 * r, (SHIELD.foot - 0.24) * r - top);
    p.fill();
  },
};
