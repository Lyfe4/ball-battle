import { describe, expect, it } from 'vitest';
import { menuMaxHeight, placeClear, placeMenu } from './settings-place.ts';

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

  it('covers the court, whole, when nowhere is clear (a short phone mid-fight)', () => {
    // 390 x 664: the court on top, the gear under it, the menu too tall for the room below it and
    // a little too tall for the room above it.
    const short = { width: 390, height: 664, top: 0 };
    const court = { left: 16, top: 16, width: 358, height: 358 };
    const tall = { width: 320, height: 372 };
    const spot = placeMenu(gear(330, 386), tall, short, undefined, court);
    // Nowhere at full height is clear of the gear, so it stays whole, over its gear too (the
    // match waits, and its × closes it), never scrolling in the room above.
    expect(spot).toStrictEqual({ left: 54, top: 16, covers: true });
  });

  it('scrolls in the room above its gear only when it is taller than the screen', () => {
    const short = { width: 390, height: 664, top: 0 };
    const court = { left: 16, top: 16, width: 358, height: 358 };
    const spot = placeMenu(gear(330, 386), { width: 320, height: 700 }, short, undefined, court);
    expect(spot).toStrictEqual({ left: 54, top: 16, covers: true, maxHeight: 362 });
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

  it('keeps to the side panel beside a desktop court, at its own width', () => {
    const desktop = { width: 1280, height: 800, top: 0 };
    const court = { left: 147, top: 16, width: 760, height: 768 };
    const side = gear(1200, 180);
    // One width everywhere (ADR 0081 addendum of 2026-11-24): never narrowed to the panel.
    const placed = placeMenu(side, { width: 320, height: 300 }, desktop, undefined, court);
    expect(placed).toStrictEqual({ left: 924, top: 232, covers: false });
    // Where its own width reaches over the court, it covers rather than leave the screen.
    const wide = { ...court, width: 860 };
    expect(placeMenu(side, { width: 320, height: 300 }, desktop, undefined, wide).covers).toBe(
      true,
    );
  });

  it('stays beside a sideways court, over its own gear, when nowhere by the gear is clear', () => {
    // 812 x 375 mid-fight: the court on the left, the gear at the panel's top, the menu as tall as
    // the screen allows. It keeps its width and stays off the court.
    const sideways = { width: 812, height: 375, top: 0 };
    const court = { left: 52, top: 16, width: 343, height: 343 };
    const placed = placeMenu(
      gear(752, 48),
      { width: 320, height: 343 },
      sideways,
      undefined,
      court,
    );
    expect(placed).toStrictEqual({ left: 476, top: 16, covers: false });
    expect(placed.left).toBeGreaterThan(court.left + court.width);
  });

  it('is never taller than the visible screen less its edges and safe areas', () => {
    expect(menuMaxHeight(safari, { top: 0, right: 0, bottom: 34, left: 0 })).toBe(664 - 32 - 34);
  });
});

describe('placeClear (a live match: never over the court)', () => {
  const safari = { width: 390, height: 664, top: 0 };
  const phoneCourt = { left: 16, top: 16, width: 358, height: 358 };
  const short = { width: 375, height: 635, top: 0 };
  const shortCourt = { left: 16, top: 16, width: 343, height: 343 };

  it('takes the band under the gear when it is the tallest, capped to it', () => {
    // 375 x 635: the gear in the score line under the court, 196 px to the bottom edge.
    const at = placeClear(gear(299, 379), { width: 320, height: 300 }, short, shortCourt);
    expect(at).toStrictEqual({ left: 23, top: 431, maxHeight: 188 });
    const box = { left: at.left, top: at.top, width: 320, height: at.maxHeight };
    expect(box.top).toBeGreaterThanOrEqual(shortCourt.top + shortCourt.height);
    expect(box.top + box.height).toBeLessThanOrEqual(short.height - 16);
  });

  it('keeps off the court and its gear wherever the gear is', () => {
    const at = placeClear(gear(286, 386), { width: 320, height: 300 }, safari, phoneCourt);
    expect(at.top).toBeGreaterThanOrEqual(386 + 44 + 8);
    expect(at.top + Math.min(300, at.maxHeight)).toBeLessThanOrEqual(664 - 16);
  });

  it('sits on the band’s bottom when the room is over the gear', () => {
    // A court low on the screen and the gear above it: the band above the gear is the room.
    const low = { left: 16, top: 300, width: 343, height: 343 };
    const at = placeClear(
      gear(299, 240),
      { width: 320, height: 120 },
      { width: 375, height: 700, top: 0 },
      low,
    );
    expect(at).toStrictEqual({ left: 23, top: 112, maxHeight: 216 });
  });
});
