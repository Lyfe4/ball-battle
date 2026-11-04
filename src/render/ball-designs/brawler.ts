import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/**
 * Plain and heavy: a thick band across the middle like a glove's cuff, with a stitched seam along
 * it. Never rotates: no tricks.
 */
export const brawlerDesign: BallDesign = {
  facing: 'none',
  showsHeal: false,
  draw(p, { radius: r, base, accent }) {
    p.save();
    p.beginPath();
    p.arc(0, 0, r, 0, Math.PI * 2);
    p.clip();
    p.fillStyle = accent;
    p.beginPath();
    p.rect(-r, -0.26 * r, 2 * r, 0.52 * r);
    p.fill();
    p.restore();

    p.strokeStyle = base;
    p.lineWidth = r * theme.markLine;
    p.lineCap = 'round';
    p.setLineDash([0.14 * r, 0.16 * r]);
    p.beginPath();
    p.moveTo(-0.76 * r, 0);
    p.lineTo(0.76 * r, 0);
    p.stroke();
    p.setLineDash([]);
  },
};
