// Whether fights have been drawn slowly for a sustained stretch (ADR 0063 addendum): the browser
// gave the page about 30 frames a second or fewer (iPhone Low Power Mode, Android battery saver, an
// old phone), not one stall. Judged from the gaps between frames while fights run, joined across
// fights (a short fight at 2x is a few seconds): a gap the page was away for (a hidden tab, a
// dialog) or spent between fights is never handed in. Pure.

/** A window whose frames average this far apart is slow: under about 38 a second. */
export const SLOW_GAP_MS = 26;
/** Frames judged together: about 5 s at 30 a second. */
export const SLOW_WINDOW = 150;
/** A stall counts as this long at most, so a few of them never tip a fast window over. */
export const GAP_CAP_MS = 100;

export interface SlowFrames {
  /** One frame's gap from the last, in ms, while a fight plays. */
  add(gapMs: number): void;
  /** True once a whole window averaged slow; stays true for this page load. */
  sustained(): boolean;
}

export function createSlowFrames(): SlowFrames {
  const gaps: number[] = [];
  let total = 0;
  let seen = false;
  return {
    add(gapMs) {
      if (seen) return;
      const gap = Math.min(Math.max(gapMs, 0), GAP_CAP_MS);
      gaps.push(gap);
      total += gap;
      if (gaps.length > SLOW_WINDOW) total -= gaps.shift() ?? 0;
      if (gaps.length === SLOW_WINDOW && total >= SLOW_WINDOW * SLOW_GAP_MS) seen = true;
    },
    sustained: () => seen,
  };
}
