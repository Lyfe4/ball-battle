// Where the settings menu goes (settings-menu.ts, ADR 0040), as a pure function so it is tested
// without a DOM: under its gear, its right edge on the gear's, or over the gear when there is no
// room below; always inside the visible screen, clear of its edges and of the safe areas.
import type { Box } from './tooltip-place.ts';

/** Room kept between the menu and its gear, and between the menu and the screen's edge. */
const GAP = 8;
const EDGE = 16;

/** The visible screen: the layout width, and the visual viewport's height and offset. */
export interface Screen {
  readonly width: number;
  readonly height: number;
  /** How far the visible screen is scrolled down within the layout viewport (iOS's toolbar). */
  readonly top: number;
}

/** The safe-area insets (a notch, the home bar), in CSS pixels. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export function placeMenu(
  gear: Box,
  size: { readonly width: number; readonly height: number },
  screen: Screen,
  insets: Insets = NO_INSETS,
): { readonly left: number; readonly top: number } {
  const minLeft = EDGE + insets.left;
  const maxLeft = screen.width - EDGE - insets.right - size.width;
  const left = Math.max(minLeft, Math.min(gear.left + gear.width - size.width, maxLeft));
  const minTop = screen.top + EDGE + insets.top;
  const maxTop = screen.top + screen.height - EDGE - insets.bottom - size.height;
  const below = gear.top + gear.height + GAP;
  const above = gear.top - GAP - size.height;
  const top = below <= maxTop ? below : above >= minTop ? above : maxTop;
  return { left, top: Math.max(minTop, top) };
}
