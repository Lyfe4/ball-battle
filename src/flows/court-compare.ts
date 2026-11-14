// How the reload flows compare the court before and after a reload (reload-screen.ts, ADR 0042).
// The same scene can come back a colour step off on a few anti-aliased edge pixels: a canvas read
// back every 400 ms for a whole series is moved to CPU rasterisation, while the fresh canvas after
// the reload draws its one held picture on whichever path it started on. PR #38's failure was
// exactly 3 of 589,824 pixels, each one step apart, all on the edge of a still ball. Anything the
// flow is there to catch (a ball moved, missing or of another kind, an effect left out, another
// size) changes hundreds of pixels or changes them by far more, so a small, bounded tolerance keeps
// the check exact where it matters.

/** The court's pixels as getImageData gives them (RGBA), with its size. */
export interface Court {
  readonly size: string;
  readonly pixels: ArrayLike<number>;
}

export interface CourtDifference {
  /** Pixels with any channel apart. */
  readonly differing: number;
  /** The largest step between two channels. */
  readonly worst: number;
}

/** The most pixels that may differ: ten times what PR #38 saw, far under one ball's edge. */
export const MAX_DIFFERING_PIXELS = 32;
/** The most a channel may differ: one anti-aliasing step, and one more for rounding. */
export const MAX_CHANNEL_STEP = 2;

export function courtDifference(a: Court, b: Court): CourtDifference {
  let differing = 0;
  let worst = 0;
  const length = Math.max(a.pixels.length, b.pixels.length);
  for (let pixel = 0; pixel < length; pixel += 4) {
    let apart = 0;
    for (let channel = pixel; channel < pixel + 4; channel += 1) {
      apart = Math.max(apart, Math.abs((a.pixels[channel] ?? -256) - (b.pixels[channel] ?? -256)));
    }
    if (apart > 0) differing += 1;
    worst = Math.max(worst, apart);
  }
  return { differing, worst };
}

/** The same court, allowing a few edge pixels a step or two apart. */
export function sameCourt(a: Court, b: Court): boolean {
  if (a.size !== b.size) return false;
  const { differing, worst } = courtDifference(a, b);
  return differing <= MAX_DIFFERING_PIXELS && worst <= MAX_CHANNEL_STEP;
}
