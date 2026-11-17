// The frame meter's numbers (`?frames` in the URL, ADR 0063 addendum): from the gaps between the
// browser's animation frames, its steady rate and how many frames came late. Made to be read on a
// real phone (iPhone Low Power Mode holds Safari to 30 frames a second): a steady 30 with few late
// frames means the cap; many late frames mean the page is dropping frames. Pure.

/** How the last frames came: the median beat as frames a second, the late share, the worst gap. */
export interface FrameStats {
  readonly fps: number;
  /** Share of gaps over one and a half beats: a frame was dropped there. */
  readonly late: number;
  readonly worstMs: number;
}

/** Stats over `gaps` (ms between frames); none for fewer than two. */
export function frameStats(gaps: readonly number[]): FrameStats | undefined {
  if (gaps.length < 2) return undefined;
  const sorted = [...gaps].sort((a, b) => a - b);
  const beat = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (beat <= 0) return undefined;
  const late = gaps.filter((gap) => gap > beat * 1.5).length / gaps.length;
  return { fps: 1000 / beat, late, worstMs: sorted.at(-1) ?? 0 };
}

/** The meter's line: "30 fps · 0% late · worst 50 ms". */
export function frameLine(stats: FrameStats | undefined): string {
  if (stats === undefined) return '… fps';
  const late = Math.round(stats.late * 100);
  return `${String(Math.round(stats.fps))} fps · ${String(late)}% late · worst ${String(Math.round(stats.worstMs))} ms`;
}
