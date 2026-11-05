// The rule cue (ADR 0028): one small spark, the same for every interaction rule, beside the ball a
// rule just acted on. Drawn as a path, never a font glyph, so it looks the same on every device.
// Pure geometry here; drawn in draw-cues.ts, and as SVG in the symbol legend.
import { theme } from './theme.ts';

/**
 * The spark's outline: a four-point star of unit size around (0, 0), points up, right, down and
 * left, with its inner corners at `theme.ruleCueWaist`. Shared by the canvas and the legend's SVG.
 */
export function ruleCuePoints(): readonly (readonly [number, number])[] {
  const w = theme.ruleCueWaist;
  return [
    [0, -1],
    [w, -w],
    [1, 0],
    [w, w],
    [0, 1],
    [-w, w],
    [-1, 0],
    [-w, -w],
  ];
}

/** Scale of the spark's pop at `strength` (1 just shown, 0 gone): up past 1, then settles. */
export function cueScale(strength: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const p = 1 - strength;
  if (p < 0.15) return (p / 0.15) * theme.ruleCuePop;
  if (p < 0.3) return theme.ruleCuePop - ((p - 0.15) / 0.15) * (theme.ruleCuePop - 1);
  return 1;
}

/** Opacity at `strength`: full, then fading over the last 40%. */
export function cueAlpha(strength: number): number {
  return Math.min(1, strength / 0.4);
}
