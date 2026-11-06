import { describe, expect, it } from 'vitest';
import { BALLS } from '../sim/balls/index.ts';
import { ballColor } from './ball-colors.ts';
import { contrastRatio, relativeLuminance } from './contrast.ts';
import { theme } from './theme.ts';

/** The WCAG minimum for graphics that must be told apart from what is around them. */
const MIN_CONTRAST = 3;

/** Every tone a ball can sit on: the floor and its centre circle (ADR 0032). */
const FLOOR_TONES = { floor: theme.arenaFill, centre: theme.arenaCentre };

/** The weakest pairing of a ball colour with any floor tone. */
function weakest(color: string): { tone: string; ratio: number } {
  return Object.entries(FLOOR_TONES)
    .map(([tone, floor]) => ({ tone, ratio: contrastRatio(color, floor) }))
    .reduce((low, next) => (next.ratio < low.ratio ? next : low));
}

describe('contrast', () => {
  it('follows WCAG 2', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 9);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 9);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    // A known pair: #767676 on white is the lightest grey that passes 4.5:1.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
    expect(() => relativeLuminance('red')).toThrow();
  });
});

describe('every ball stands out on the arena floor', () => {
  // The pale balls (Frost, Ghost, Storm) by their lightness, the dark ones (Necromancer, Quake) by
  // the floor's darkness; a mirror match's lighter ball B as well.
  it.each(BALLS.map((ball) => [ball.name, ball.color] as const))(
    '%s keeps at least 3:1 on every floor tone',
    (name, color) => {
      for (const shade of [ballColor(color, false), ballColor(color, true)]) {
        const { tone, ratio } = weakest(shade);
        expect({ name, shade, tone, enough: ratio >= MIN_CONTRAST }).toStrictEqual({
          name,
          shade,
          tone,
          enough: true,
        });
      }
    },
  );

  it('would fail a floor too light for the dark balls', () => {
    // The check itself: a mid-grey floor drowns the Necromancer and the Quake.
    const necromancer = BALLS.find((ball) => ball.id === 'necromancer');
    expect(necromancer).toBeDefined();
    expect(contrastRatio(necromancer?.color ?? '', '#3a3a4a')).toBeLessThan(MIN_CONTRAST);
  });
});
