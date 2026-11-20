// The Balloon's look (ADR 0075): a glossy party balloon with its knot, floating over the court. Its
// shadow on the floor (shadows.ts) is what says it floats; it stores nothing, so its look never
// changes. One set of proportions in fractions of r at every size.
import { theme } from '../theme.ts';
import type { BallDesign } from './types.ts';

/** The gloss, upper left, as fractions of r: centre, half-width, half-height. */
const GLOSS = { x: -0.34, y: -0.36, rx: 0.24, ry: 0.13 } as const;
/** A smaller fleck of light beside the gloss. */
const FLECK = { x: -0.06, y: -0.58, radius: 0.07 } as const;
/** The knot at the bottom: a short pinched neck and a round tie, standing just proud of it. */
const KNOT = { neckTop: 0.86, neckHalf: 0.05, tieY: 1.02, tieHalf: 0.13, tieHeight: 0.07 } as const;

/**
 * A plain balloon: the rubber is the ball's own colour, with a white gloss and fleck of light at
 * its upper left (Sticker Pop's flat highlight, no gradient) and a tied knot at the bottom that
 * breaks its edge a little (inside an icon's padding), like a real balloon's.
 */
export const balloonDesign: BallDesign = {
  facing: 'none',
  floats: true,
  draw(p, { radius: r }) {
    const alpha = p.globalAlpha;
    p.fillStyle = theme.highlight;
    p.globalAlpha = alpha * theme.balloonGlossAlpha;
    p.save();
    p.translate(GLOSS.x * r, GLOSS.y * r);
    p.rotate(-0.6);
    p.scale(1, GLOSS.ry / GLOSS.rx);
    p.beginPath();
    p.arc(0, 0, GLOSS.rx * r, 0, Math.PI * 2);
    p.fill();
    p.restore();
    p.beginPath();
    p.arc(FLECK.x * r, FLECK.y * r, FLECK.radius * r, 0, Math.PI * 2);
    p.fill();
    p.globalAlpha = alpha;
  },
  over(p, { radius: r, base, accent }) {
    p.fillStyle = base;
    p.strokeStyle = accent;
    p.lineWidth = theme.markLine * 0.6 * r;
    p.lineJoin = 'round';
    // The neck, pinched where it is tied, then the tie: a small flattened round.
    p.beginPath();
    p.moveTo(-KNOT.neckHalf * r, KNOT.neckTop * r);
    p.lineTo(KNOT.neckHalf * r, KNOT.neckTop * r);
    p.lineTo(KNOT.neckHalf * 0.6 * r, KNOT.tieY * r);
    p.lineTo(-KNOT.neckHalf * 0.6 * r, KNOT.tieY * r);
    p.closePath();
    p.fill();
    p.save();
    p.translate(0, KNOT.tieY * r);
    p.scale(1, KNOT.tieHeight / KNOT.tieHalf);
    p.beginPath();
    p.arc(0, 0, KNOT.tieHalf * r, 0, Math.PI * 2);
    p.restore();
    p.fill();
    p.stroke();
  },
};
