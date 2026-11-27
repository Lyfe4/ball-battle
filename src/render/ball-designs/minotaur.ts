// The Minotaur's look (prototype): a bull's head seen from above, facing where it heads. A dark
// brow and muzzle point forward; two horns curve out from the brow and forward. Head lowered (the
// wind-up) and through a charge, the horns swing forward to point dead ahead and reach past the
// edge, and its eyes burn red. One set of proportions in fractions of r at every size.
import { minotaurStateOf } from '../../sim/balls/minotaur.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/** The horns' colour: bone. */
const HORN = '#f5ecd7';
/** The eyes while its head is down. */
const RAGE = '#ef4444';

/** One horn on side `side` (1 or -1): from the brow, out, then forward; `down` swings it ahead. */
function horn(p: Painter, r: number, side: number, down: number): void {
  const baseX = 0.1;
  const baseY = 0.3 * side;
  const tipX = 0.55 + 0.55 * down;
  const tipY = (0.85 - 0.45 * down) * side;
  const bendX = 0.05 + 0.25 * down;
  const bendY = (0.9 - 0.1 * down) * side;
  p.beginPath();
  p.moveTo((baseX - 0.08) * r, baseY * r);
  p.quadraticCurveTo(bendX * r, bendY * r, tipX * r, tipY * r);
  p.quadraticCurveTo((bendX + 0.12) * r, (bendY - 0.25 * side) * r, (baseX + 0.12) * r, baseY * r);
  p.closePath();
  p.fill();
  p.stroke();
}

export const minotaurDesign: BallDesign = {
  facing: 'velocity',
  draw(p, { radius: r, accent, ball, simple }) {
    const down = minotaurStateOf(ball)?.phase === 'roam' ? 0 : 1;
    p.lineJoin = 'round';
    p.lineWidth = r * theme.markLine * (simple ? 1.4 : 0.8);
    // The head: a broad brow narrowing to the muzzle ahead.
    p.fillStyle = accent;
    p.beginPath();
    p.moveTo(-0.35 * r, -0.4 * r);
    p.lineTo(0.2 * r, -0.32 * r);
    p.lineTo(0.62 * r, -0.16 * r);
    p.lineTo(0.62 * r, 0.16 * r);
    p.lineTo(0.2 * r, 0.32 * r);
    p.lineTo(-0.35 * r, 0.4 * r);
    p.closePath();
    p.fill();
    if (simple) return;
    // Eyes on the brow, red while the head is down; nostrils at the muzzle.
    p.fillStyle = down > 0 ? RAGE : HORN;
    p.beginPath();
    p.arc(0.12 * r, -0.17 * r, 0.07 * r, 0, Math.PI * 2);
    p.arc(0.12 * r, 0.17 * r, 0.07 * r, 0, Math.PI * 2);
    p.fill();
  },
  // The horns over the outline: lowered, their tips break the edge.
  over(p, { radius: r, accent, ball, simple }) {
    const down = minotaurStateOf(ball)?.phase === 'roam' ? 0 : 1;
    p.fillStyle = HORN;
    p.strokeStyle = accent;
    p.lineJoin = 'round';
    p.lineWidth = r * theme.markLine * (simple ? 1 : 0.6);
    horn(p, r, 1, down);
    horn(p, r, -1, down);
  },
};
