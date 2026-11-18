// The server's clock as this page knows it (ADR 0053), pure. Every live answer carries the
// database's time (`X-Now`); with when the request left and when its answer came back, each answer
// is one estimate of how far this device's clock is from the server's, wrong by at most half its
// round trip. The page keeps the estimate from the shortest round trip of the last few, as NTP
// does: a slow answer (a cold function, a busy network) never moves the clock much.

/** How many recent answers the estimate is chosen from. */
export const CLOCK_SAMPLES = 12;

export interface ClockSample {
  /** This device's clock when the request left and when its answer arrived (ms). */
  readonly sentAt: number;
  readonly receivedAt: number;
  /** The server's clock while answering (ms since the epoch). */
  readonly serverNow: number;
}

export interface ServerClock {
  readonly samples: readonly ClockSample[];
}

export const NO_CLOCK: ServerClock = { samples: [] };

/** The clock with one more answer, the oldest dropped past CLOCK_SAMPLES. */
export function withSample(clock: ServerClock, sample: ClockSample): ServerClock {
  if (sample.receivedAt < sample.sentAt) return clock;
  return { samples: [...clock.samples, sample].slice(-CLOCK_SAMPLES) };
}

/** Server time minus device time, from the answer with the shortest round trip; 0 with none. */
export function offsetOf(clock: ServerClock): number {
  let best: ClockSample | undefined;
  for (const sample of clock.samples) {
    const trip = sample.receivedAt - sample.sentAt;
    if (best === undefined || trip < best.receivedAt - best.sentAt) best = sample;
  }
  return best === undefined ? 0 : best.serverNow - (best.sentAt + best.receivedAt) / 2;
}

/** The server's time now, by this device's clock `deviceNow` and the offset. */
export const serverNowOf = (clock: ServerClock, deviceNow: number): number =>
  deviceNow + offsetOf(clock);

/**
 * A page's clock rests on too few answers to trust within a frame or two until it has this many
 * (ADR 0061): a phone that has just arrived starts the match with one or two, one of them the slow
 * read that started it, and its coin toss flipped 170 ms to 1 s after the other phone's on a deploy
 * preview. Until then it asks four times a second.
 */
export const WARM_SAMPLES = 6;

/** While a live page's clock is still warming up it asks this often; undefined once warm. */
export const warmUpAskMs = (clock: ServerClock): number | undefined =>
  clock.samples.length < WARM_SAMPLES ? 250 : undefined;

/** A clock whose newest answer is this old asks in full again. */
const STALE_MS = 10_000;

/**
 * Whether a live page should ask in full (without its ETag): a 304 comes back from Netlify without
 * X-Now (only the local `netlify dev` keeps it), so only a full answer tells the page the server's
 * time (ADR 0061). In full until the clock rests on WARM_SAMPLES answers, then whenever its newest
 * is STALE_MS old; otherwise a 304 is enough.
 */
export function asksInFull(clock: ServerClock, deviceNow: number): boolean {
  const newest = clock.samples.at(-1);
  if (newest === undefined || clock.samples.length < WARM_SAMPLES) return true;
  return deviceNow - newest.receivedAt >= STALE_MS;
}
