// Where the settings menu goes (settings-menu.ts, ADR 0040, 0044), as pure functions so they are
// tested without a DOM. It prefers its gear: under it, its right edge on the gear's, or over it.
// With a court on screen it keeps off the court: beside a desktop's court it narrows to the side
// panel, and on a phone it may move under or over the court (over the health bars and speed,
// never the fight). Only when no place is clear does it cover the court, and it says so, so the
// match can wait. It always stays inside the visible screen, clear of its edges and the safe areas.
import type { Box } from './tooltip-place.ts';

/** Room kept between the menu and its gear or the court, and between the menu and the screen's edge. */
const GAP = 8;
const EDGE = 16;
/** The narrowest the menu gets to fit beside a court: its longest row still fits on one line. */
export const MENU_MIN_WIDTH = 240;

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

interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Placement {
  readonly left: number;
  readonly top: number;
  /** True when no place on screen keeps it off the court: the match waits while it is open. */
  readonly covers: boolean;
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/** The room beside the court on the gear's side, when the gear sits beside it (a desktop). */
function roomBeside(gear: Box, screen: Screen, insets: Insets, court: Box): number | undefined {
  if (gear.left >= court.left + court.width) {
    return screen.width - EDGE - insets.right - (court.left + court.width + GAP);
  }
  if (gear.left + gear.width <= court.left) return court.left - GAP - EDGE - insets.left;
  return undefined;
}

/**
 * The menu's width: its own, or narrower to fit beside the court on the gear's side, down to
 * MENU_MIN_WIDTH. Undefined keeps its own width.
 */
export function menuWidth(
  gear: Box,
  natural: number,
  screen: Screen,
  insets: Insets = NO_INSETS,
  court?: Box,
): number | undefined {
  if (court === undefined) return undefined;
  const room = roomBeside(gear, screen, insets, court);
  if (room === undefined || room >= natural || room < MENU_MIN_WIDTH) return undefined;
  return Math.floor(room);
}

export function placeMenu(
  gear: Box,
  size: Size,
  screen: Screen,
  insets: Insets = NO_INSETS,
  court?: Box,
): Placement {
  const minLeft = EDGE + insets.left;
  const maxLeft = screen.width - EDGE - insets.right - size.width;
  let left = clamp(gear.left + gear.width - size.width, minLeft, maxLeft);
  const minTop = screen.top + EDGE + insets.top;
  const maxTop = screen.top + screen.height - EDGE - insets.bottom - size.height;
  const below = gear.top + gear.height + GAP;
  const above = gear.top - GAP - size.height;
  const top = Math.max(minTop, below <= maxTop ? below : above >= minTop ? above : maxTop);
  if (court === undefined) return { left, top, covers: false };

  // Beside the court (a desktop), keep to the gear's side of it.
  const courtRight = court.left + court.width;
  if (gear.left >= courtRight && left < courtRight + GAP) {
    left = Math.min(courtRight + GAP, Math.max(minLeft, maxLeft));
  } else if (gear.left + gear.width <= court.left && left + size.width > court.left - GAP) {
    left = Math.max(minLeft, court.left - GAP - size.width);
  }
  const candidates = [below, above, court.top + court.height + GAP, court.top - GAP - size.height];
  for (const candidate of candidates) {
    const box = { left, top: candidate, ...size };
    // Never over its own gear, which closes it.
    const clear = !overlaps(box, court) && !overlaps(box, gear);
    if (candidate >= minTop && candidate <= maxTop && clear) {
      return { left, top: candidate, covers: false };
    }
  }
  return { left, top, covers: overlaps({ left, top, ...size }, court) };
}

/** The tallest the menu may be: the visible screen less its edges and the safe areas. */
export function menuMaxHeight(screen: Screen, insets: Insets = NO_INSETS): number {
  return Math.max(0, screen.height - 2 * EDGE - insets.top - insets.bottom);
}
