// The Winner sticker's confetti (ADR 0032): where each piece lands. Pure, so it is tested without a page.

/** One piece of confetti: where it lands (percent of the arena) and how it is turned. */
export interface ConfettiPiece {
  readonly x: number;
  readonly y: number;
  readonly turn: number;
}

/** Confetti is capped: a fixed handful of pieces, so a phone never animates more than this. */
export const CONFETTI_PIECES = 12;

/**
 * Where the confetti lands: evenly round the sticker on a slightly squashed ring, alternating
 * three distances so it reads as a burst rather than a circle. Deterministic, so every result
 * looks the same and nothing needs a random source.
 */
export function confettiPieces(count: number = CONFETTI_PIECES): readonly ConfettiPiece[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const distance = 30 + (index % 3) * 7;
    return {
      x: 50 + Math.cos(angle) * distance,
      y: 50 + Math.sin(angle) * distance * 0.9,
      turn: (index * 37) % 360,
    };
  });
}
