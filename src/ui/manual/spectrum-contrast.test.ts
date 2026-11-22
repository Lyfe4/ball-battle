// Every ball stands out on the matchup chart's chips (3:1, as on the arena floor), and the chart's
// words keep 4.5:1 on every band's tint: read from the stylesheets, so a restyle can't drift.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, TEXT_CONTRAST } from '../../render/contrast.ts';
import { BALLS } from '../../sim/balls/index.ts';

const css = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const tokens = css('../../styles/tokens.css');

/** The text after `key` up to the next `end`, in `text`. */
const after = (text: string, key: string, end: string) => {
  const at = text.indexOf(key);
  return at < 0 ? '' : text.slice(at + key.length, text.indexOf(end, at + key.length)).trim();
};

/** A token's colour, following var() references to the palette's hex. */
function colourOf(name: string): string {
  const value = after(tokens, `${name}:`, ';');
  return value.startsWith('var(') ? colourOf(value.slice(4, -1)) : value;
}

/** The token a rule's `background` uses in matchup-spectrum.css. */
function backgroundOf(selector: string): string {
  // The rule at the start of a line, not one that only ends in the selector.
  const rule = after(css('./matchup-spectrum.css'), `\n${selector} {`, '}');
  return colourOf(after(rule, 'background: var(', ')'));
}

describe('the matchup chart’s contrast', () => {
  it('keeps every ball at 3:1 on a chip', () => {
    const chip = backgroundOf('.spectrum-chip');
    expect(chip).toMatch(/^#[0-9a-f]{6}$/);
    const weak = BALLS.filter((ball) => contrastRatio(ball.color, chip) < 3).map((b) => b.name);
    expect(weak).toStrictEqual([]);
  });

  it('keeps the words at 4.5:1 on every band', () => {
    const text = colourOf('--color-text');
    for (const band of ['beats', 'edge', 'even', 'edged', 'beaten']) {
      const tint = colourOf(`--color-band-${band}`);
      expect({ band, enough: contrastRatio(text, tint) >= TEXT_CONTRAST }).toStrictEqual({
        band,
        enough: true,
      });
    }
  });
});
