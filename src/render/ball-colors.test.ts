import { describe, expect, it } from 'vitest';
import { createWorld } from '../sim/world.ts';
import { blue, red } from '../sim/test-support.ts';
import { ballColor, isRepeatOfEarlierBall, lighten } from './ball-colors.ts';
import { theme } from './theme.ts';

describe('ball colours', () => {
  it('lightens towards white', () => {
    expect(lighten('#000000', 0.5)).toBe('#808080');
    expect(lighten('#ef4444', 0)).toBe('#ef4444');
    expect(lighten('#ef4444', 1)).toBe('#ffffff');
    expect(lighten('not-a-colour', 0.5)).toBe('not-a-colour');
  });

  it('marks only the second of two identical balls as a repeat', () => {
    const mirror = createWorld(1, [red, red]).balls;
    expect(isRepeatOfEarlierBall(mirror, 0)).toBe(false);
    expect(isRepeatOfEarlierBall(mirror, 1)).toBe(true);
    const different = createWorld(1, [red, blue]).balls;
    expect(isRepeatOfEarlierBall(different, 1)).toBe(false);
  });

  it('lightens a repeat and leaves other balls alone', () => {
    expect(ballColor(red.color, false)).toBe(red.color);
    expect(ballColor(red.color, true)).toBe(lighten(red.color, theme.repeatLighten));
    expect(ballColor(red.color, true)).not.toBe(red.color);
  });
});
