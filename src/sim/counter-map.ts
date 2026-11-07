// The intended counter map (ADR 0010, docs/vision.md): for every pair of balls, which side should
// be favoured, or whether it should be even, and why. Plain data in the sim, because a bot reads it
// to counter-pick (ADR 0019); `pnpm balance` checks each pair against its band
// (scripts/counter-map.ts). A new ball adds one entry per existing ball in the file for its batch;
// a test checks the map covers every pair.
import { BATCH_TWO_ENTRIES } from './counter-map-batch-2.ts';
import { BATCH_THREE_ENTRIES } from './counter-map-batch-3.ts';
import { BATCH_FOUR_ENTRIES } from './counter-map-batch-4.ts';
import { BATCH_FIVE_ENTRIES } from './counter-map-batch-5.ts';
import { BATCH_FIVE_DEFENDER_ENTRIES } from './counter-map-batch-5-defenders.ts';
import { FIRST_ENTRIES } from './counter-map-first.ts';

/** Which side of a pair should win more: the first ball, the second, or neither. */
export type Intended = 'x' | 'y' | 'even';

export interface CounterEntry {
  readonly x: string;
  readonly y: string;
  readonly intended: Intended;
  /** Why, in one line, from the two balls' identities. */
  readonly reason: string;
}

/** Every pair of balls exactly once, with its intended result and why (a test checks coverage). */
export const COUNTER_MAP: readonly CounterEntry[] = [
  ...FIRST_ENTRIES,
  ...BATCH_TWO_ENTRIES,
  ...BATCH_THREE_ENTRIES,
  ...BATCH_FOUR_ENTRIES,
  ...BATCH_FIVE_ENTRIES,
  ...BATCH_FIVE_DEFENDER_ENTRIES,
];

/** The map entry for a pair, whichever order the pair comes in. */
export function counterFor(a: string, b: string): CounterEntry | undefined {
  return COUNTER_MAP.find(
    (entry) => (entry.x === a && entry.y === b) || (entry.x === b && entry.y === a),
  );
}

/** True when the map says `ball` is favoured against `opponent` (it counters it). */
export function isFavoured(ball: string, opponent: string): boolean {
  const entry = counterFor(ball, opponent);
  if (entry === undefined || entry.intended === 'even') return false;
  return (entry.intended === 'x' ? entry.x : entry.y) === ball;
}
