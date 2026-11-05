import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** Half the band's height, as a fraction of r: heavier at small size, where the stitches go. */
const BAND = 0.3;
const SIMPLE_BAND = 0.34;
/** Stitch ticks across each edge of the band, like a glove's cuff. */
const STITCH_SPACING = 0.22;
const STITCH_REACH = 0.66;
const STITCH_HALF = 0.09;

/**
 * Plain and heavy: a thick band across the middle like a glove's cuff, stitched along both edges.
 * Never rotates: no tricks. At small size it is just a heavier band.
 */
export const brawlerDesign: BallDesign = {
  facing: 'none',
  draw(p, { radius: r, base, accent, simple }) {
    const half = (simple ? SIMPLE_BAND : BAND) * r;
    p.save();
    p.beginPath();
    p.arc(0, 0, r, 0, Math.PI * 2);
    p.clip();
    p.fillStyle = accent;
    p.beginPath();
    p.rect(-r, -half, 2 * r, 2 * half);
    p.fill();
    p.restore();
    if (simple) return;

    p.strokeStyle = base;
    p.lineWidth = r * theme.markLine * 0.8;
    p.lineCap = 'round';
    p.beginPath();
    for (let x = -STITCH_REACH; x <= STITCH_REACH + 1e-9; x += STITCH_SPACING) {
      for (const edge of [-half, half]) {
        p.moveTo(x * r, edge - STITCH_HALF * r);
        p.lineTo(x * r, edge + STITCH_HALF * r);
      }
    }
    p.stroke();
  },
};
