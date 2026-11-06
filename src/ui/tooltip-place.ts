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

/**
 * Centred above the symbol, or below it when there is no room above, and kept inside the viewport.
 */
export function placeTooltip(
  anchor: Box,
  size: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
): { readonly left: number; readonly top: number } {
  const above = anchor.top - GAP - size.height;
  const top = above >= EDGE ? above : anchor.top + anchor.height + GAP;
  const centred = anchor.left + anchor.width / 2 - size.width / 2;
  const left = Math.min(
    Math.max(centred, EDGE),
    Math.max(EDGE, viewport.width - EDGE - size.width),
  );
  return { left, top: Math.min(top, Math.max(EDGE, viewport.height - EDGE - size.height)) };
}
