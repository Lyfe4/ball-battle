import { spartanRaisedOf } from '../../sim/balls/spartan.ts';
import type { BallDesign, Painter } from './types.ts';

/** The planted shield: a round shield facing the enemy, as fractions of r (centre x, radius). */
const SHIELD = { x: 0.2, radius: 0.58, boss: 0.14 } as const;
/** The readied spear along the shield's top: shaft from `back` to `base`, a leaf head to `tip`. */
const SPEAR = { y: -0.68, back: -0.6, base: 0.36, widest: 0.48, tip: 0.68, head: 0.1 } as const;
/** The shield carried behind it once the spear is thrown: smaller, at its back. */
const SLUNG = { x: -0.46, radius: 0.36, boss: 0.1 } as const;

/** A spear pointing along +x (fractions of r): a shaft and a leaf-shaped head, wide in the middle. */
function drawSpear(p: Painter, r: number, accent: string, weight: number): void {
  p.strokeStyle = accent;
  p.lineWidth = r * weight;
  p.lineCap = 'round';
  p.beginPath();
  p.moveTo(SPEAR.back * r, SPEAR.y * r);
  p.lineTo(SPEAR.base * r, SPEAR.y * r);
  p.stroke();
  p.fillStyle = accent;
  p.beginPath();
  p.moveTo(SPEAR.tip * r, SPEAR.y * r);
  p.lineTo(SPEAR.widest * r, (SPEAR.y - SPEAR.head) * r);
  p.lineTo(SPEAR.base * r, SPEAR.y * r);
  p.lineTo(SPEAR.widest * r, (SPEAR.y + SPEAR.head) * r);
  p.closePath();
  p.fill();
}

/** A round shield in the accent with a pale boss, centred at (`x`, 0), as fractions of r. */
function drawShield(
  p: Painter,
  r: number,
  shield: { readonly x: number; readonly radius: number; readonly boss: number },
  accent: string,
  base: string,
  boss: boolean,
): void {
  p.fillStyle = accent;
  p.beginPath();
  p.arc(shield.x * r, 0, shield.radius * r, 0, Math.PI * 2);
  p.fill();
  if (!boss) return;
  p.fillStyle = base;
  p.beginPath();
  p.arc(shield.x * r, 0, shield.boss * r, 0, Math.PI * 2);
  p.fill();
}

/**
 * Shield and spear (the Spartan): while its shield is planted, a big round shield in the dark accent
 * faces the enemy, with a pale boss, and the spear is readied along its top. Once the spear is thrown
 * the same shield is carried small at its back and nothing is in front: the ball is open. At small
 * size the bosses go and the spear is thicker.
 */
export const spartanDesign: BallDesign = {
  facing: 'aim',
  shot: 'spear',
  draw(p, { ball, radius: r, accent, base, simple }) {
    if (spartanRaisedOf(ball) !== true) {
      drawShield(p, r, SLUNG, accent, base, !simple);
      return;
    }
    drawShield(p, r, SHIELD, accent, base, !simple);
    drawSpear(p, r, accent, simple ? 0.16 : 0.1);
  },
};
