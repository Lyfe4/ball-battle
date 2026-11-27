// Where a tooltip goes on screen (symbol-tooltip.ts), as a pure function so it is tested without a DOM.

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Room kept between the tooltip and the symbol, and between the tooltip and the screen's edge. */
const GAP = 6;
const EDGE = 8;

const overlaps = (a: Box, b: Box) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;

/**
 * Centred above the symbol, or below it when there is no room above, and kept inside the viewport.
 * Never over a box in `avoid` (a coach, ADR 0090 addendum) where the other side has room.
 */
export function placeTooltip(
  anchor: Box,
  size: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  avoid: readonly Box[] = [],
): { readonly left: number; readonly top: number } {
  const centred = anchor.left + anchor.width / 2 - size.width / 2;
  const left = Math.min(
    Math.max(centred, EDGE),
    Math.max(EDGE, viewport.width - EDGE - size.width),
  );
  const above = anchor.top - GAP - size.height;
  const below = anchor.top + anchor.height + GAP;
  const fits = (top: number) =>
    top >= EDGE &&
    top + size.height <= viewport.height - EDGE &&
    !avoid.some((box) => overlaps({ left, top, ...size }, box));
  const top = fits(above) ? above : fits(below) ? below : above >= EDGE ? above : below;
  return { left, top: Math.min(top, Math.max(EDGE, viewport.height - EDGE - size.height)) };
}
