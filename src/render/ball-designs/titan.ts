import { STANDARD_BALL_RADIUS } from '../../sim/constants.ts';
import { MAX_RADIUS } from '../../sim/balls/titan.ts';
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** The helm, as fractions of r: the visor band, the crest above it and the rivets below. */
const HELM = { visorY: -0.04, visorHalfWidth: 0.6, crestTop: -0.66 } as const;
const RIVETS = { y: 0.36, x: [-0.36, 0, 0.36], radius: 0.07 } as const;

/**
 * A helm in the dark accent: a visor slit across the middle, a crest from the top and a row of
 * rivets below. Drawn in fractions of the ball's radius, so it grows with the Titan (ADR 0034), and
 * the visor widens as it grows, because its bumps grow with it (ADR 0045). At small size the rivets
 * go and the visor and crest are heavier.
 */
export const titanDesign: BallDesign = {
  facing: 'none',
  draw(p, { ball, radius: r, accent, simple }) {
    const grown = Math.min(
      1,
      Math.max(0, (ball.radius - STANDARD_BALL_RADIUS) / (MAX_RADIUS - STANDARD_BALL_RADIUS)),
    );
    const [calm, full] = theme.titanVisor;
    const visor = (calm + (full - calm) * grown) * (simple ? 1.3 : 1) * r;
    const visorTop = HELM.visorY * r - visor / 2;
    p.fillStyle = accent;
    p.beginPath();
    p.rect(-HELM.visorHalfWidth * r, visorTop, HELM.visorHalfWidth * 2 * r, visor);
    p.fill();
    p.strokeStyle = accent;
    p.lineCap = 'round';
    p.lineWidth = (simple ? theme.titanCrestSimple : theme.titanCrest) * r;
    p.beginPath();
    p.moveTo(0, HELM.crestTop * r);
    p.lineTo(0, visorTop);
    p.stroke();
    if (simple) return;
    for (const x of RIVETS.x) {
      p.beginPath();
      p.arc(x * r, RIVETS.y * r, RIVETS.radius * r, 0, Math.PI * 2);
      p.fill();
    }
  },
};
