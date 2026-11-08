// Checks for the counter map (ADR 0010): the bands each pair's win rate must land in, and the
// safe-pick rules. The map itself is data in src/sim/counter-map.ts (a bot reads it); it is
// re-exported here for the balance script and its tests.
import type { CounterEntry } from '../src/sim/counter-map.ts';

export {
  COUNTER_MAP,
  counterFor,
  type CounterBand,
  type CounterEntry,
  type Intended,
} from '../src/sim/counter-map.ts';

/**
 * Bands as win rates over all games (draws count as games, as everywhere in `pnpm balance`), in
 * two levels (ADR 0028 addendum): a **target** each pair aims for, and a wider **floor** outside
 * which it fails. A favoured pair has one of two bands by what decides it (ADR 0045, the entry's
 * `band`):
 * - Kind (a kind of hit decides it: spikes against bumps, a rewind against a big hit): the target
 *   is 72-78%; the floor is 66-80%.
 * - Movement (speed, size, range, a pull or minions in the way): the target is 62-72%; the floor
 *   is 58-76%.
 * - Even: the target is 45-55% for both sides; the floor is 42-58%.
 *
 * One pair at 500 seeds has about ±1.6 points of standard error, so:
 * - inside the target but within `warnWithin` of an edge is flagged (WARN, passes);
 * - between the target and the floor is below target (SHORT, printed as a WARN, passes): a pair to
 *   sharpen, not a failure;
 * - outside the floor by at most `nearWithin` is a near-miss (NEAR, passes): the noise allowance
 *   ADR 0010 accepted, written into the check;
 * - anything further out is a miss (MISS, fails the counter-map target).
 */
export const COUNTER_BANDS = {
  kind: [0.72, 0.78],
  movement: [0.62, 0.72],
  even: [0.45, 0.55],
  kindFloor: [0.66, 0.8],
  movementFloor: [0.58, 0.76],
  evenFloor: [0.42, 0.58],
  warnWithin: 0.02,
  nearWithin: 0.02,
} as const;

/**
 * The floor a kind counter is checked against while the roster redesign ships group by group
 * (ADR 0045): the movement floor's lower edge, so each group can merge on its own while kind
 * counters whose other ball changes in a later group are still soft. The redesign's last group
 * sets this to `COUNTER_BANDS.kindFloor`. `outsideFinalBand` counts the pairs that would fail then.
 */
export const KIND_FLOOR_DURING_REDESIGN: readonly [number, number] = [0.58, 0.8];

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
  const { even, evenFloor } = COUNTER_BANDS;
  if (entry.intended !== 'even') {
    const [target, floor] = favouredBands(entry, KIND_FLOOR_DURING_REDESIGN);
    return inBand(entry.intended === 'x' ? xRate : yRate, target, floor, nearWithin);
  }
  return worse(
    inBand(xRate, even, evenFloor, nearWithin),
    inBand(yRate, even, evenFloor, nearWithin),
  );
}

/** A favoured entry's target and floor, with `kindFloor` as the floor of a kind counter. */
function favouredBands(
  entry: CounterEntry,
  kindFloor: readonly [number, number],
): readonly [readonly [number, number], readonly [number, number]] {
  return entry.band === 'kind'
    ? [COUNTER_BANDS.kind, kindFloor]
    : [COUNTER_BANDS.movement, COUNTER_BANDS.movementFloor];
}

/**
 * True when a pair is outside its final floor (ADR 0045): the kind floor of 66-80% for a kind
 * counter, the movement floor for a movement one, 42-58% for both sides of an even pair. No noise
 * allowance: a count to bring down group by group, reported by `pnpm balance`.
 */
export function outsideFinalBand(entry: CounterEntry, xRate: number, yRate: number): boolean {
  const out = (rate: number, [low, high]: readonly [number, number]) =>
    rate < low - EDGE_EPSILON || rate > high + EDGE_EPSILON;
  if (entry.intended === 'even') {
    return out(xRate, COUNTER_BANDS.evenFloor) || out(yRate, COUNTER_BANDS.evenFloor);
  }
  const [, floor] = favouredBands(entry, COUNTER_BANDS.kindFloor);
  return out(entry.intended === 'x' ? xRate : yRate, floor);
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
