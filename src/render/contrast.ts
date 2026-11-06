import { lighten } from './ball-colors.ts';

/** WCAG 2's minimum contrast for normal-size text. */
export const TEXT_CONTRAST = 4.5;

/** How finely `readableOn` lightens: in twentieths of the way to white. */
const LIGHTEN_STEPS = 20;

/**
 * A text-safe variant of `color` on `background`: the colour itself when it already reaches
 * `minimum`, else the least lightened shade of it (towards white, so it keeps its hue) that does.
 * For ball-coloured text (ADR 0032): the ball's own colour stays as it is wherever it is drawn.
 */
export function readableOn(color: string, background: string, minimum = TEXT_CONTRAST): string {
  for (let step = 0; step <= LIGHTEN_STEPS; step++) {
    const shade = lighten(color, step / LIGHTEN_STEPS);
    if (contrastRatio(shade, background) >= minimum) return shade;
  }
  return '#ffffff';
}

/**
 * WCAG 2 contrast between two `#rrggbb` colours: from 1 (the same) to 21 (black on white). The
 * arena uses it to keep every ball clear of its floor (arena-contrast.test.ts).
 */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** WCAG 2 relative luminance of a `#rrggbb` colour. Throws on anything else. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}
