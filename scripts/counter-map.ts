// Checks for the counter map (ADR 0010): the bands each pair's win rate must land in, and the
// safe-pick rules. The map itself is data in src/sim/counter-map.ts (a bot reads it); it is
// re-exported here for the balance script and its tests.
import type { CounterEntry } from '../src/sim/counter-map.ts';

export {
  COUNTER_MAP,
  counterFor,
  type CounterEntry,
  type Intended,
} from '../src/sim/counter-map.ts';

/**
 * Bands as win rates over all games (draws count as games, as everywhere in `pnpm balance`).
 * Favoured: the favoured side wins 62-72% (ADR 0028; 58-70% before). Even: both sides win 45-55%. One pair at 500 seeds has
 * about ±1.6 points of standard error, so:
 * - a result inside the band but within `warnWithin` of an edge is flagged (WARN, passes);
 * - a result outside the band by at most `nearWithin` is a near-miss (NEAR, passes): the noise
 *   allowance ADR 0010 accepted, written into the check;
 * - anything further out is a miss (MISS, fails the counter-map target).
 */
export const COUNTER_BANDS = {
  favoured: [0.62, 0.72],
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

function inBand(
  rate: number,
  [low, high]: readonly [number, number],
  nearWithin: number,
): CounterVerdict {
  if (rate < low - EDGE_EPSILON || rate > high + EDGE_EPSILON) {
    const outside = rate < low ? low - rate : rate - high;
    return outside <= nearWithin + EDGE_EPSILON ? 'near' : 'miss';
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
 * `warn` pass; only `miss` fails. `nearWithin` is how far outside a band still passes as NEAR:
 * the 2 points ADR 0010 accepted for a full run, or `ciAllowance` for a smaller sample.
 */
export function checkCounter(
  entry: CounterEntry,
  xRate: number,
  yRate: number,
  nearWithin: number = COUNTER_BANDS.nearWithin,
): CounterVerdict {
  const check = (rate: number, band: readonly [number, number]) => inBand(rate, band, nearWithin);
  if (entry.intended === 'x') return check(xRate, COUNTER_BANDS.favoured);
  if (entry.intended === 'y') return check(yRate, COUNTER_BANDS.favoured);
  return worse(check(xRate, COUNTER_BANDS.even), check(yRate, COUNTER_BANDS.even));
}

/**
 * The NEAR allowance for a reduced run (`pnpm balance --ci`): three standard errors of a pair's
 * win rate over `games` games (at most 0.5 / sqrt(games)), and never less than a full run's. A
 * sample that small is noisy, so the CI check fails only on a clear miss; a pair it lets through
 * near an edge is for a full `pnpm balance` to judge. The seeds are fixed, so the result is the
 * same on every run: it can't flake, only miss a borderline pair.
 */
export function ciAllowance(games: number): number {
  return Math.max(COUNTER_BANDS.nearWithin, (3 * 0.5) / Math.sqrt(games));
}
