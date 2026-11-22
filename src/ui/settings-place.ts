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
/** The least height a capped menu may scroll in; with less room it keeps its own height. */
const MIN_SCROLL_HEIGHT = 160;
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
  /** Set when even that place would be over its gear: the menu is capped and scrolls inside. */
  readonly maxHeight?: number;
  /**
   * Beside a court with no room by its gear (a phone turned sideways): the menu takes the panel's
   * whole room, this wide and tall, so nothing of the panel peeks out around it.
   */
  readonly fill?: Size;
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
  // Nowhere clear of the court: it covers it (the caller tries the compact form, then lets the match
  // wait), but never its own gear, which closes it: the first spot inside the screen clear of it,
  // else the room above the gear, scrolling inside (large text or a short phone).
  const offGear = [above, below, minTop, maxTop]
    .map((candidate) => clamp(candidate, minTop, Math.max(minTop, maxTop)))
    .find((candidate) => !overlaps({ left, top: candidate, ...size }, gear));
  if (offGear !== undefined) {
    return { left, top: offGear, covers: overlaps({ left, top: offGear, ...size }, court) };
  }
  // In the panel beside a court (a phone turned sideways, 2026-11-23 walk): over its gear anyway,
  // it would leave the panel's ? and Leave series peeking out around it, so it takes the panel's
  // room whole, still off the court.
  const besideWidth = screen.width - EDGE - insets.right - (courtRight + GAP);
  if (gear.left >= courtRight && besideWidth >= size.width) {
    const fill = { width: besideWidth, height: menuMaxHeight(screen, insets) };
    return { left: courtRight + GAP, top: minTop, covers: false, fill };
  }
  const room = gear.top - GAP - minTop;
  if (room >= MIN_SCROLL_HEIGHT) {
    const box = { left, top: minTop, width: size.width, height: room };
    return { left, top: minTop, covers: overlaps(box, court), maxHeight: room };
  }
  return { left, top, covers: overlaps({ left, top, ...size }, court) };
}

/** The tallest the menu may be: the visible screen less its edges and the safe areas. */
export function menuMaxHeight(screen: Screen, insets: Insets = NO_INSETS): number {
  return Math.max(0, screen.height - 2 * EDGE - insets.top - insets.bottom);
}

/** A placement that must keep off the court: its height is capped to the room it has. */
export interface ClearPlacement {
  readonly left: number;
  readonly top: number;
  readonly maxHeight: number;
}

/**
 * Where the menu goes when it may not cover the court at all (a live match plays on the server's
 * clock and can't wait, ADR 0054): in its column, the tallest band of the visible screen that is
 * clear of the court and its gear, next to the gear's side of that band, its height capped to the
 * band so it scrolls inside itself. Used only when placeMenu found no clear place at full size.
 */
export function placeClear(
  gear: Box,
  size: Size,
  screen: Screen,
  court: Box,
  insets: Insets = NO_INSETS,
): ClearPlacement {
  const { left } = placeMenu(gear, size, screen, insets, court);
  const minTop = screen.top + EDGE + insets.top;
  const maxBottom = screen.top + screen.height - EDGE - insets.bottom;
  const column = { left, width: size.width };
  const inColumn = (box: Box) =>
    box.left < column.left + column.width && column.left < box.left + box.width;
  // The court and the gear, each with its gap, as spans of the column to keep off.
  const blocked = [court, gear]
    .filter(inColumn)
    .map((box) => ({ from: box.top - GAP, to: box.top + box.height + GAP }))
    .sort((x, y) => x.from - y.from);
  const bands: { from: number; to: number }[] = [];
  let from = minTop;
  for (const span of blocked) {
    if (span.from > from) bands.push({ from, to: Math.min(span.from, maxBottom) });
    from = Math.max(from, span.to);
  }
  if (maxBottom > from) bands.push({ from, to: maxBottom });
  const best = bands.reduce<{ from: number; to: number } | undefined>(
    (tallest, band) =>
      tallest === undefined || band.to - band.from > tallest.to - tallest.from ? band : tallest,
    undefined,
  ) ?? { from: minTop, to: minTop };
  const maxHeight = Math.max(0, best.to - best.from);
  const height = Math.min(size.height, maxHeight);
  // Under the gear it hangs from the band's top; over it, it sits on the band's bottom.
  const top = best.from >= gear.top ? best.from : best.to - height;
  return { left, top, maxHeight };
}
