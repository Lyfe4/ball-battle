import { describe, expect, it } from 'vitest';
import { placeMenu } from './settings-place.ts';

const phone = { width: 375, height: 812, top: 0 };
const size = { width: 300, height: 260 };
const gear = (left: number, top: number) => ({ left, top, width: 44, height: 44 });

describe('placeMenu', () => {
  it('opens under its gear, its right edge on the gear’s', () => {
    expect(placeMenu(gear(300, 20), size, phone)).toStrictEqual({ left: 44, top: 72 });
  });

  it('opens over its gear when there is no room below (a gear under the court)', () => {
    expect(placeMenu(gear(300, 700), size, phone)).toStrictEqual({ left: 44, top: 432 });
  });

  it('stays inside the screen near its left edge and when neither side has room', () => {
    expect(placeMenu(gear(0, 150), size, { width: 375, height: 300, top: 0 })).toStrictEqual({
      left: 16,
      top: 24,
    });
  });

  it('keeps clear of the safe areas and follows the visible screen', () => {
    const insets = { top: 47, right: 0, bottom: 34, left: 0 };
    expect(placeMenu(gear(300, 0), size, phone, insets).top).toBe(63);
    expect(placeMenu(gear(300, 900), size, { ...phone, top: 120 }).top).toBe(632);
  });
});
