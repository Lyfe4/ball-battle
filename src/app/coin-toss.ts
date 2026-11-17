// Reveal's coin toss as a moment (ADR 0061), pure: when it flips and lands on this page's clock,
// which stage it is in, and its words. Offline it flips as it is shown; live it is timed from the
// server's start, so both phones flip together and the first pick opens as it ends.
import { TOSS_FLIP_MS, TOSS_HOLD_MS, TOSS_LEAD_MS } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import type { Side } from '../sim/series.ts';
import { capital, labelOf, type Seats } from '../ui/series/seats.ts';

/** A toss's moments on one clock (ms): the flip starts, the coin lands, the result has been read. */
export interface TossTimes {
  readonly flipAt: number;
  readonly landAt: number;
  readonly doneAt: number;
}

/** Before the flip ("Get ready", live only), in the air, landed with the result, and over. */
export type TossStage = 'ready' | 'flipping' | 'landed' | 'done';

/** Offline: the flip starts at once (`now`), then the result is held. */
export const offlineToss = (now: number): TossTimes => ({
  flipAt: now,
  landAt: now + TOSS_FLIP_MS,
  doneAt: now + TOSS_FLIP_MS + TOSS_HOLD_MS,
});

/** Live: timed back from when the first pick opens (the server's time), the same on both phones. */
export const liveToss = (opensAt: number): TossTimes => ({
  flipAt: opensAt - TOSS_HOLD_MS - TOSS_FLIP_MS,
  landAt: opensAt - TOSS_HOLD_MS,
  doneAt: opensAt,
});

/** Database times come back through floating seconds: within this they are the same moment. */
const SAME_MS = 5;

/**
 * A live series' coin toss, if it has one: a Reveal series whose first pick opens TOSS_LEAD_MS
 * after its start (ADR 0061). Not before both players are here, and not once that pick has moved
 * the pick phase on (a series started before the toss was timed has none).
 */
export function liveTossOf(view: SeriesView): TossTimes | undefined {
  const clock = view.live;
  if (view.format !== 'reveal' || clock === null || view.rounds.length > 0) return undefined;
  if (clock.startedAt === null || clock.opensAt === null) return undefined;
  const lead = clock.opensAt - clock.startedAt;
  return Math.abs(lead - TOSS_LEAD_MS) < SAME_MS ? liveToss(clock.opensAt) : undefined;
}

export function tossStage(times: TossTimes, now: number): TossStage {
  if (now < times.flipAt) return 'ready';
  if (now < times.landAt) return 'flipping';
  return now < times.doneAt ? 'landed' : 'done';
}

/** Ms until the stage next changes, or undefined once the toss is over. */
export function nextStageChange(times: TossTimes, now: number): number | undefined {
  const next = [times.flipAt, times.landAt, times.doneAt].find((at) => at > now);
  return next === undefined ? undefined : next - now;
}

/** The line under the coin: "Get ready", "Coin toss…", then who shows first, named in full. */
export function tossWords(stage: TossStage, first: Side, seats: Seats): string {
  if (stage === 'ready') return 'Get ready';
  if (stage === 'flipping') return 'Coin toss…';
  return first === seats.you ? 'You show first' : `${capital(seats.they)} shows first`;
}

/** Longest label a face carries: "P4821" fits the coin at every size. */
const FACE_CHARS = 5;

/**
 * A face's label: "You", "Bot", a guest as "P4821" (as the score line names them), a short name as
 * it is, and anything longer "Them": the result line under the coin names them in full.
 */
export function coinFace(seats: Seats, side: Side): string {
  const label = labelOf(seats, side).replace(/^Player (\d+)$/, 'P$1');
  return label.length <= FACE_CHARS ? label : 'Them';
}
