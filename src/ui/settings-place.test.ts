import { describe, expect, it } from 'vitest';
import { MENU_MIN_WIDTH, menuMaxHeight, menuWidth, placeMenu } from './settings-place.ts';

const phone = { width: 375, height: 812, top: 0 };
const size = { width: 300, height: 260 };
const gear = (left: number, top: number) => ({ left, top, width: 44, height: 44 });

describe('placeMenu', () => {
  it('opens under its gear, its right edge on the gear’s', () => {
    expect(placeMenu(gear(300, 20), size, phone)).toStrictEqual({
      left: 44,
      top: 72,
      covers: false,
    });
  });

  it('opens over its gear when there is no room below (a gear under the court)', () => {
    expect(placeMenu(gear(300, 700), size, phone)).toStrictEqual({
      left: 44,
      top: 432,
      covers: false,
    });
  });

  it('stays inside the screen near its left edge and when neither side has room', () => {
    expect(placeMenu(gear(0, 150), size, { width: 375, height: 300, top: 0 })).toStrictEqual({
      left: 16,
      top: 24,
      covers: false,
    });
  });

  it('keeps clear of the safe areas and follows the visible screen', () => {
    const insets = { top: 47, right: 0, bottom: 34, left: 0 };
    expect(placeMenu(gear(300, 0), size, phone, insets).top).toBe(63);
    expect(placeMenu(gear(300, 900), size, { ...phone, top: 120 }).top).toBe(632);
  });

  // A phone in Safari (390 x 664): the court under the bar's gear... and the score line's gear
  // under the court, with the health bars and speed below it.
  const safari = { width: 390, height: 664, top: 0 };
  const phoneCourt = { left: 16, top: 16, width: 358, height: 358 };

  it('keeps off a phone court: under its gear when the panel fits there', () => {
    expect(
      placeMenu(gear(286, 386), { width: 320, height: 200 }, safari, undefined, phoneCourt),
    ).toStrictEqual({ left: 16, top: 438, covers: false });
  });

  it('moves under the court when its gear sits above it (375 x 812)', () => {
    const court = { left: 16, top: 76, width: 343, height: 343 };
    expect(
      placeMenu(gear(271, 16), { width: 320, height: 300 }, phone, undefined, court),
    ).toStrictEqual({ left: 16, top: 427, covers: false });
  });

  it('never covers its own gear, even to keep off the court', () => {
    // Under the court is free, but the score line's gear sits there.
    expect(
      placeMenu(gear(286, 386), { width: 320, height: 240 }, safari, undefined, phoneCourt).covers,
    ).toBe(true);
  });

  it('covers the court only when no place keeps off it, and says so', () => {
    expect(
      placeMenu(gear(286, 386), { width: 320, height: 300 }, safari, undefined, phoneCourt),
    ).toStrictEqual({ left: 16, top: 78, covers: true });
  });

  it('keeps to the side panel beside a desktop court, never over it', () => {
    const desktop = { width: 1280, height: 800, top: 0 };
    const court = { left: 147, top: 16, width: 860, height: 768 };
    const side = gear(1200, 180);
    // 249 px between the court (and its gap) and the screen's edge: the menu narrows to it.
    expect(menuWidth(side, 320, desktop, undefined, court)).toBe(249);
    const placed = placeMenu(side, { width: 249, height: 300 }, desktop, undefined, court);
    expect(placed).toStrictEqual({ left: 1015, top: 232, covers: false });
    // Still its own width, it would reach over the court: it covers rather than leave the screen.
    expect(placeMenu(side, { width: 320, height: 300 }, desktop, undefined, court).covers).toBe(
      true,
    );
  });

  it('keeps its own width with room beside the court, or none worth narrowing to', () => {
    const court = { left: 0, top: 0, width: 600, height: 600 };
    expect(
      menuWidth(gear(900, 0), 320, { width: 1400, height: 800, top: 0 }, undefined, court),
    ).toBeUndefined();
    expect(
      menuWidth(gear(700, 0), 320, { width: 800, height: 800, top: 0 }, undefined, court),
    ).toBeUndefined();
    expect(MENU_MIN_WIDTH).toBeGreaterThan(800 - 16 - 608);
    expect(menuWidth(gear(100, 700), 320, phone)).toBeUndefined();
  });

  it('is never taller than the visible screen less its edges and safe areas', () => {
    expect(menuMaxHeight(safari, { top: 0, right: 0, bottom: 34, left: 0 })).toBe(664 - 32 - 34);
  });
});
