import { describe, expect, it } from 'vitest';
import { gridMove } from './grid-nav.ts';

describe('gridMove', () => {
  // 7 items, 3 wide:
  // 0 1 2
  // 3 4 5
  // 6
  it('moves left and right, stopping at the ends', () => {
    expect(gridMove(1, 'ArrowRight', 7, 3)).toBe(2);
    expect(gridMove(2, 'ArrowRight', 7, 3)).toBe(3);
    expect(gridMove(6, 'ArrowRight', 7, 3)).toBe(6);
    expect(gridMove(0, 'ArrowLeft', 7, 3)).toBe(0);
  });

  it('moves up and down a row, staying put where there is no row', () => {
    expect(gridMove(1, 'ArrowDown', 7, 3)).toBe(4);
    expect(gridMove(4, 'ArrowDown', 7, 3)).toBe(4);
    expect(gridMove(3, 'ArrowDown', 7, 3)).toBe(6);
    expect(gridMove(4, 'ArrowUp', 7, 3)).toBe(1);
    expect(gridMove(1, 'ArrowUp', 7, 3)).toBe(1);
  });

  it('jumps with Home and End and ignores other keys', () => {
    expect(gridMove(4, 'Home', 7, 3)).toBe(0);
    expect(gridMove(0, 'End', 7, 3)).toBe(6);
    expect(gridMove(2, 'Enter', 7, 3)).toBeUndefined();
  });

  it('treats a bad column count as one column and an empty grid as no move', () => {
    expect(gridMove(0, 'ArrowDown', 3, 0)).toBe(1);
    expect(gridMove(0, 'ArrowDown', 0, 3)).toBeUndefined();
  });
});
