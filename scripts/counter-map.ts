// The intended counter map (ADR 0009, docs/vision.md): for every pair of balls, which side should
// be favoured, or whether it should be even. `pnpm balance` checks each pair against its band.
// A new ball must add one entry per existing ball; a test checks the map covers every pair.
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

/**
 * Bands as win rates over all games (draws count as games, as everywhere in `pnpm balance`).
 * Favoured: the favoured side wins 58-70%. Even: both sides win 45-55%. One pair at 500 seeds has
 * about ±1.6 points of standard error, so:
 * - a result inside the band but within `warnWithin` of an edge is flagged (WARN, passes);
 * - a result outside the band by at most `nearWithin` is a near-miss (NEAR, passes): the noise
 *   allowance ADR 0010 accepted, written into the check;
 * - anything further out is a miss (MISS, fails the counter-map target).
 */
export const COUNTER_BANDS = {
  favoured: [0.58, 0.7],
  even: [0.45, 0.55],
  warnWithin: 0.02,
  nearWithin: 0.02,
} as const;

/**
 * Win rates are ratios of whole counts, so a rate exactly on a 2-point line can land a hair either
 * side of it in floating point. This tolerance keeps such a rate on the lenient side.
 */
const EDGE_EPSILON = 1e-9;

/** Hard limit on top of the map: no side of any matchup wins less than this (docs/vision.md). */
export const HARD_WORST_MATCHUP = 0.25;

/** Every pair of balls exactly once, with its intended result and why (a test checks coverage). */
export const COUNTER_MAP: readonly CounterEntry[] = FIRST_ENTRIES;

/**
 * Balls deliberately even against everyone but one known counter, the one exception to "every
 * ball has a favoured and an unfavoured matchup" (docs/vision.md). Adding one is a design
 * decision.
 */
export const SAFE_PICKS: readonly string[] = ['brawler'];

/**
 * Each safe pick's one designed counter, favoured against it (ADR 0013). Thorns beats the Brawler:
 * reflection scales with the hit, so the hardest hitter hurts itself the most on the spikes. A
 * safe pick needs one known counter so it isn't a dominant blind pick. Changing it is a design
 * decision.
 */
export const SAFE_PICK_COUNTERS: Readonly<Record<string, string>> = { brawler: 'thorns' };

/** From best to worst. Only `miss` fails the counter-map target. */
export type CounterVerdict = 'ok' | 'warn' | 'near' | 'miss';

const SEVERITY: readonly CounterVerdict[] = ['ok', 'warn', 'near', 'miss'];

/** The map entry for a pair, whichever order the pair comes in. */
export function counterFor(a: string, b: string): CounterEntry | undefined {
  return COUNTER_MAP.find(
    (entry) => (entry.x === a && entry.y === b) || (entry.x === b && entry.y === a),
  );
}

function inBand(rate: number, [low, high]: readonly [number, number]): CounterVerdict {
  if (rate < low - EDGE_EPSILON || rate > high + EDGE_EPSILON) {
    const outside = rate < low ? low - rate : rate - high;
    return outside <= COUNTER_BANDS.nearWithin + EDGE_EPSILON ? 'near' : 'miss';
  }
  const margin = COUNTER_BANDS.warnWithin;
  return rate < low + margin || rate > high - margin ? 'warn' : 'ok';
}

/** The worse of two verdicts. */
function worse(a: CounterVerdict, b: CounterVerdict): CounterVerdict {
  return SEVERITY.indexOf(a) >= SEVERITY.indexOf(b) ? a : b;
}

/**
 * Checks one pair's win rates (`xRate` for the entry's x, `yRate` for its y) against its band.
 * For an even pair both sides must be in the even band; the worse verdict counts. `near` and
 * `warn` pass; only `miss` fails.
 */
export function checkCounter(entry: CounterEntry, xRate: number, yRate: number): CounterVerdict {
  if (entry.intended === 'x') return inBand(xRate, COUNTER_BANDS.favoured);
  if (entry.intended === 'y') return inBand(yRate, COUNTER_BANDS.favoured);
  return worse(inBand(xRate, COUNTER_BANDS.even), inBand(yRate, COUNTER_BANDS.even));
}
