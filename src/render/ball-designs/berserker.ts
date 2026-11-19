import { MAX_RAGE, rageOf } from '../../sim/balls/berserker.ts';
import { theme } from '../theme.ts';
import { rageCrackCount } from './state.ts';
import type { BallDesign, Painter } from './types.ts';

type Point = readonly [number, number];

/**
 * Its three fault lines, one per hit of rage it can store (MAX_RAGE), from the edge in to the
 * centre as [x, y] fractions of r, 120° apart: up, lower right, lower left. They open in this order.
 */
const FAULTS: readonly (readonly Point[])[] = [
  [
    [0.04, -0.92],
    [-0.1, -0.62],
    [0.08, -0.4],
    [-0.04, -0.16],
    [0, 0],
  ],
  [
    [0.78, 0.5],
    [0.5, 0.42],
    [0.42, 0.18],
    [0.16, 0.12],
    [0, 0],
  ],
  [
    [-0.82, 0.42],
    [-0.52, 0.22],
    [-0.36, 0.38],
    [-0.12, 0.06],
    [0, 0],
  ],
];

function faultPath(p: Painter, r: number, fault: readonly Point[], reach: number): void {
  const points = fault.slice(0, reach);
  points.forEach(([x, y], index) => {
    if (index === 0) p.moveTo(x * r, y * r);
    else p.lineTo(x * r, y * r);
  });
}

/**
 * Rage you can count (ADR 0045): three faint seams where it will crack, and every hit it takes
 * breaks one open, dark with a hot glow inside, up to three. Full, the three meet in the middle and
 * the glow is white-hot: the next bump lets it all out and the cracks close. (The bump's own hit
 * back stores one again at once, so after a trade it shows one crack, as the sim has it.) At small
 * size the seams and cracks are heavier.
 */
export const berserkerDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const rage = rageOf(ball.abilityState);
    // One open crack per stored hit: exactly the sim's count, never a share of it.
    const open = rageCrackCount(rage, MAX_RAGE);
    const full = open >= FAULTS.length;
    p.save();
    p.lineCap = 'round';
    p.lineJoin = 'round';
    p.strokeStyle = accent;

    // The seams still closed: thin and faint, so the three slots read even when calm.
    const alpha = p.globalAlpha;
    p.globalAlpha = alpha * theme.berserkerSeamAlpha;
    p.lineWidth = r * theme.markLine * (simple ? 0.9 : 0.55);
    p.beginPath();
    for (const fault of FAULTS.slice(open)) faultPath(p, r, fault, fault.length - 1);
    p.stroke();
    p.globalAlpha = alpha;
    if (open === 0) {
      p.restore();
      return;
    }

    // Open cracks: dark and wide; they reach the centre only when all three are open.
    const reach = (fault: readonly Point[]) => (full ? fault.length : fault.length - 1);
    const width = r * (simple ? theme.berserkerCrackSimple : theme.berserkerCrack);
    p.lineWidth = width;
    p.beginPath();
    for (const fault of FAULTS.slice(0, open)) faultPath(p, r, fault, reach(fault));
    p.stroke();
    // The glow inside: hotter with every crack, white-hot when full.
    p.strokeStyle = full ? theme.highlight : theme.berserkerHeat;
    p.lineWidth = width * (full ? 0.42 : 0.34);
    p.beginPath();
    for (const fault of FAULTS.slice(0, open)) faultPath(p, r, fault, reach(fault));
    p.stroke();
    if (full) {
      p.fillStyle = accent;
      p.beginPath();
      p.arc(0, 0, width * 0.95, 0, Math.PI * 2);
      p.fill();
      p.fillStyle = theme.highlight;
      p.beginPath();
      p.arc(0, 0, width * 0.5, 0, Math.PI * 2);
      p.fill();
    }
    p.restore();
  },
};
