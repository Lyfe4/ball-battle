import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALLS } from '../sim/balls/index.ts';
import { ballColor } from './ball-colors.ts';
import { contrastRatio, readableOn, relativeLuminance, TEXT_CONTRAST } from './contrast.ts';
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

/** A token's value in tokens.css, following var() references down to the palette. */
function token(name: string): string {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  const value = new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? '';
  const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  return reference === undefined ? value : token(reference);
}

describe('ball-coloured text is readable on the page', () => {
  // The HUD names each ball in its colour (ADR 0032). The page sits behind it.
  const page = token('--color-page');

  it('reads the page colour from the tokens', () => {
    expect(page).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(BALLS.map((ball) => [ball.name, ball.color] as const))(
    '%s as text keeps at least 4.5:1, in the shade nearest its own colour',
    (name, color) => {
      for (const shade of [ballColor(color, false), ballColor(color, true)]) {
        const text = readableOn(shade, page);
        const ratio = contrastRatio(text, page);
        expect({ name, shade, enough: ratio >= TEXT_CONTRAST }).toStrictEqual({
          name,
          shade,
          enough: true,
        });
        // A colour already readable is left exactly as it is.
        if (contrastRatio(shade, page) >= TEXT_CONTRAST) expect(text).toBe(shade);
      }
    },
  );

  it('lightens the Necromancer, which is too dark to read as it is', () => {
    const necromancer = BALLS.find((ball) => ball.id === 'necromancer')?.color ?? '';
    expect(contrastRatio(necromancer, page)).toBeLessThan(TEXT_CONTRAST);
    expect(readableOn(necromancer, page)).not.toBe(necromancer);
  });

  it('lightens only as far as it must, and gives white where nothing reaches the minimum', () => {
    const grey = readableOn('#000000', '#000000');
    expect(contrastRatio(grey, '#000000')).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(grey).not.toBe('#ffffff');
    expect(readableOn('#ffffff', '#17122b')).toBe('#ffffff');
    // On a light background no lighter shade can help.
    expect(readableOn('#eeeeee', '#fafafa')).toBe('#ffffff');
  });
});
