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
 * Bands as win rates over all games (draws count as games, as everywhere in `pnpm balance`), in
 * two levels (ADR 0028 addendum): a **target** each pair aims for, and a wider **floor** below
 * which it fails.
 * - Favoured: the target is 62-72%; the floor is 58%. The upper edge stays at 72%.
 * - Even: the target is 45-55% for both sides; the floor is 42-58%.
 *
 * One pair at 500 seeds has about ±1.6 points of standard error, so:
 * - inside the target but within `warnWithin` of an edge is flagged (WARN, passes);
 * - between the target and the floor is below target (SHORT, printed as a WARN, passes): a pair to
 *   sharpen, not a failure;
 * - outside the floor (or above 72%) by at most `nearWithin` is a near-miss (NEAR, passes): the
 *   noise allowance ADR 0010 accepted, written into the check;
 * - anything further out is a miss (MISS, fails the counter-map target).
 */
export const COUNTER_BANDS = {
  favoured: [0.62, 0.72],
  even: [0.45, 0.55],
  favouredFloor: [0.58, 0.72],
  evenFloor: [0.42, 0.58],
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

/**
 * From best to worst. Only `miss` fails the counter-map target; `short` is a pair inside its floor
 * but outside its target (printed as a WARN).
 */
export type CounterVerdict = 'ok' | 'warn' | 'short' | 'near' | 'miss';

const SEVERITY: readonly CounterVerdict[] = ['ok', 'warn', 'short', 'near', 'miss'];

const inside = (rate: number, [low, high]: readonly [number, number]): boolean =>
  rate >= low - EDGE_EPSILON && rate <= high + EDGE_EPSILON;

function inBand(
  rate: number,
  target: readonly [number, number],
  floor: readonly [number, number],
  nearWithin: number,
): CounterVerdict {
  if (inside(rate, target)) {
    const [low, high] = target;
    const margin = COUNTER_BANDS.warnWithin;
    return rate < low + margin || rate > high - margin ? 'warn' : 'ok';
  }
  if (inside(rate, floor)) return 'short';
  const [low, high] = floor;
  const outside = rate < low ? low - rate : rate - high;
  return outside <= nearWithin + EDGE_EPSILON ? 'near' : 'miss';
}

/** The worse of two verdicts. */
function worse(a: CounterVerdict, b: CounterVerdict): CounterVerdict {
  return SEVERITY.indexOf(a) >= SEVERITY.indexOf(b) ? a : b;
}

/**
 * Checks one pair's win rates (`xRate` for the entry's x, `yRate` for its y) against its band.
 * For an even pair both sides must be in the even band; the worse verdict counts. `warn`,
 * `short` and `near` pass; only `miss` fails. `nearWithin` is how far outside a band still passes as NEAR:
 * the 2 points ADR 0010 accepted for a full run, or `ciAllowance` for a smaller sample.
 */
export function checkCounter(
  entry: CounterEntry,
  xRate: number,
  yRate: number,
  nearWithin: number = COUNTER_BANDS.nearWithin,
): CounterVerdict {
  const { favoured, favouredFloor, even, evenFloor } = COUNTER_BANDS;
  if (entry.intended === 'x') return inBand(xRate, favoured, favouredFloor, nearWithin);
  if (entry.intended === 'y') return inBand(yRate, favoured, favouredFloor, nearWithin);
  return worse(
    inBand(xRate, even, evenFloor, nearWithin),
    inBand(yRate, even, evenFloor, nearWithin),
  );
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
