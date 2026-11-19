import { lifestealFor, vampire } from '../../sim/balls/vampire.ts';
import { theme } from '../theme.ts';
import type { BallDesign, Painter } from './types.ts';

/**
 * The collar's outer edge, as a fraction of r: inset so a rim of the ball's colour keeps its round
 * silhouette against the dark arena.
 */
const COLLAR_RADIUS = 0.86;
/**
 * Angle of the collar's lapel tips above the horizontal (radians). The collar fills the lower
 * third, with a pointed lapel rising up each side like a cape's stand-up collar.
 */
const TIP_ANGLE = 0.32;
/**
 * The collar's top edge between the lapel tips, as [x, y] fractions of r: each lapel drops
 * steeply inwards, then the edge runs nearly flat with a small notch at the centre. A flat edge
 * reads as clothing; a curved one under the fangs read as a grinning mouth.
 */
const EDGE: readonly (readonly [number, number])[] = [
  [-0.46, 0.4],
  [-0.1, 0.44],
  [0, 0.54],
  [0.1, 0.44],
  [0.46, 0.4],
];
/**
 * Fangs: centre offset, top and base width, as fractions of r, and their length sated and at full
 * thirst: thirsty, they reach down over the dark collar. One set of sizes at every size on screen.
 */
const FANG = {
  x: 0.18,
  top: -0.06,
  width: 0.22,
  thirstyWidth: 0.29,
  sated: 0.28,
  thirsty: 0.7,
} as const;
/** The drop of blood forming on each fang's tip at full thirst, as a fraction of r. */
const DROP = 0.11;

/** What one full, head-on bump heals it: its lifesteal share of its own contact damage. */
const FULL_BUMP_HEAL = lifestealFor(vampire.contactDamage);

/**
 * How thirsty it is, 0 to 1: how much of a full bump's heal it could keep. Its lifesteal is the
 * same share at any health, but it never heals past full: at full health a bump heals it nothing,
 * and once it is missing at least a full bump's heal, every bit of the next bump goes back in.
 */
export function thirstOf(health: number, maxHealth = vampire.maxHealth): number {
  return Math.min(1, Math.max(0, (maxHealth - health) / FULL_BUMP_HEAL));
}

function drawFangs(p: Painter, r: number, thirst: number): void {
  const length = FANG.sated + (FANG.thirsty - FANG.sated) * thirst;
  const tip = FANG.top + length;
  const width = FANG.width + (FANG.thirstyWidth - FANG.width) * thirst;
  p.fillStyle = theme.highlight;
  p.beginPath();
  for (const side of [-1, 1]) {
    const x = side * FANG.x * r;
    p.moveTo(x - (width / 2) * r, FANG.top * r);
    p.lineTo(x + (width / 2) * r, FANG.top * r);
    p.lineTo(x, tip * r);
    p.closePath();
  }
  p.fill();
  if (thirst <= 0) return;
  const drop = DROP * thirst * r;
  p.fillStyle = theme.vampireHeal;
  p.beginPath();
  for (const side of [-1, 1]) {
    const x = side * FANG.x * r;
    p.moveTo(x + drop, tip * r + drop * 0.5);
    p.arc(x, tip * r + drop * 0.5, drop, 0, Math.PI * 2);
  }
  p.fill();
}

/**
 * Two fangs in the purple body above a dark collar across the lower third, with a pointed lapel
 * rising up each side. The fangs show its thirst: short and clean at full health, where a bump
 * heals it nothing; longer as it loses health, reaching down over the collar with a drop of blood
 * on each tip once a full bump's heal would all go back in. When it heals, the collar's edge flushes
 * crimson and the fangs draw back as its health returns.
 */
export const vampireDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, heal }) {
    const collar = COLLAR_RADIUS * r;
    const tipX = Math.cos(TIP_ANGLE) * collar;
    const tipY = -Math.sin(TIP_ANGLE) * collar;

    p.fillStyle = accent;
    p.beginPath();
    p.moveTo(tipX, tipY);
    p.arc(0, 0, collar, -TIP_ANGLE, Math.PI + TIP_ANGLE);
    for (const [x, y] of EDGE) p.lineTo(x * r, y * r);
    p.closePath();
    p.fill();

    if (heal > 0) {
      p.save();
      p.globalAlpha *= heal;
      p.strokeStyle = theme.vampireHeal;
      p.lineWidth = r * theme.markLine * 1.3;
      p.lineJoin = 'round';
      p.lineCap = 'round';
      p.beginPath();
      p.moveTo(-tipX, tipY);
      for (const [x, y] of EDGE) p.lineTo(x * r, y * r);
      p.lineTo(tipX, tipY);
      p.stroke();
      p.restore();
    }

    drawFangs(p, r, thirstOf(ball.health));
  },
};
