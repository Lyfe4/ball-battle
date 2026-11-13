// Checks for the counter map (ADR 0010): the bands each pair's win rate must land in, and the
// safe-pick rules. The map itself is data in src/sim/counter-map.ts (a bot reads it); it is
// re-exported here for the balance script and its tests.
import { counterFor, type CounterEntry } from '../src/sim/counter-map.ts';

export {
  COUNTER_MAP,
  counterFor,
  type CounterEntry,
  type Intended,
} from '../src/sim/counter-map.ts';

/**
 * Bands as win rates over all games (draws count as games, as everywhere in `pnpm balance`), in
 * two levels (ADR 0028 addendum, ADR 0045 group 4): a **target** each pair aims for, and a wider
 * **floor** outside which it fails.
 * - A counter (▲▼, favoured in the map): the target is 65-72%; the floor is 62-78%. A pair that
 *   wins less than 62% is not a counter, however it is designed.
 * - Even: the target is 45-55% for both sides; the floor is no side above 62% (a side that wins
 *   more is a counter) and none under the 22% hard limit, whatever draws do to the other side. A
 *   side between 58% and 62% is the grey zone: shown as even, but too soft to be even and too weak
 *   to be a counter. It is counted and warned about, never failed.
 *
 * One pair at 500 seeds has about ±1.6 points of standard error, so:
 * - inside the target but within `warnWithin` of an edge is flagged (WARN, passes);
 * - between the target and the floor is below target (SHORT, printed as a WARN, passes);
 * - outside the floor by at most `nearWithin` is a near-miss (NEAR, passes): the noise allowance
 *   ADR 0010 accepted, written into the check;
 * - anything further out is a miss (MISS, fails the counter-map target).
 */
export const COUNTER_BANDS = {
  counter: [0.65, 0.72],
  even: [0.45, 0.55],
  counterFloor: [0.62, 0.78],
  evenFloor: [0.22, 0.62],
  /** Above this, a side of an even pair is in the grey zone (up to the counter floor). */
  greyFrom: 0.58,
  warnWithin: 0.02,
  nearWithin: 0.02,
} as const;

/**
 * Win rates are ratios of whole counts, so a rate exactly on a 2-point line can land a hair either
 * side of it in floating point. This tolerance keeps such a rate on the lenient side.
 */
const EDGE_EPSILON = 1e-9;

/** Hard limit on top of the map: no side of any matchup wins less than this (ADR 0045, group 4). */
export const HARD_WORST_MATCHUP = 0.22;

/**
 * Every ball's shape in the map (ADR 0045, group 4): 2-4 counters it wins and 2-4 it loses, the two
 * counts within 1 of each other, so every pick has a clear edge and a clear weakness.
 */
export const SHAPE = { fewest: 2, most: 4, within: 1 } as const;

/**
 * The even picks, the exception to the shape (docs/vision.md): even against nearly everyone, with
 * exactly these counters. The Brawler, the plain bump, loses to the Thorns (reflection scales with
 * the hit, ADR 0013) and beats nobody: it is the plain default (ADR 0049; the phasing Ghost no
 * longer loses to it). The Magnet's pull is movement too soft to decide a pair; it is a candidate for replacement
 * (docs/vision.md). Adding one is a design decision.
 */
export const EVEN_PICKS: Readonly<
  Record<string, { readonly beats: readonly string[]; readonly losesTo: readonly string[] }>
> = {
  brawler: { beats: [], losesTo: ['thorns'] },
  magnet: { beats: [], losesTo: ['thorns'] },
};

/** How far a ball may stray from SHAPE: its own fewest and most counters a side, and gap. */
export interface ShapeAllowance {
  readonly fewest: number;
  readonly most: number;
  readonly within: number;
}

/**
 * The known gaps in the roster's shape (ADR 0045 group 4, ADR 0047), each a gap for a future ball to
 * fill (docs/vision.md). Nothing else may stray from SHAPE: `pnpm balance` and the map's test fail on
 * any other ball, and on these beyond their allowance.
 * - The Storm, Titan and Bomber have one counter on a side: nothing in the roster beats one big
 *   strike but the rewind, the growing giant or the big blast.
 * - The Berserker beats nearly every ball that hits rarely: up to 5 wins.
 * - The Bloom regrows between hits that come in pieces, so it beats both new balls of ADR 0049 too:
 *   up to 7 wins until its rework (docs/vision.md).
 * - The Ghost (ADR 0049): while phased nothing touches it, so a quarter of every kind of hit misses
 *   alike, and only the Bloom's regrowth beats it: one loss.
 * - Since the Guardian left (ADR 0047): the Sniper and Quake each lost a counter, and the Vampire
 *   gained the Spartan as a fourth loss.
 */
export const SHAPE_EXCEPTIONS: Readonly<Record<string, ShapeAllowance>> = {
  storm: { ...SHAPE, fewest: 1 },
  titan: { ...SHAPE, fewest: 1 },
  bomber: { ...SHAPE, fewest: 1 },
  berserker: { ...SHAPE, most: 5, within: 3 },
  bloom: { ...SHAPE, most: 7, within: 3 },
  ghost: { ...SHAPE, fewest: 1 },
  sniper: { ...SHAPE, fewest: 1 },
  quake: { ...SHAPE, fewest: 1 },
  vampire: { ...SHAPE, fewest: 1, within: 3 },
};

/**
 * What is wrong with a ball's shape, given the balls it beats and loses to, or undefined when it
 * fits: an even pick must have exactly its listed counters, every other ball SHAPE or its
 * SHAPE_EXCEPTIONS allowance.
 */
export function shapeProblem(
  id: string,
  beats: readonly string[],
  losesTo: readonly string[],
): string | undefined {
  const even = EVEN_PICKS[id];
  if (even !== undefined) {
    const same = (a: readonly string[], b: readonly string[]) =>
      a.length === b.length && a.every((other) => b.includes(other));
    return same(beats, even.beats) && same(losesTo, even.losesTo)
      ? undefined
      : `an even pick beats ${even.beats.join(', ') || 'nobody'} and loses to ${even.losesTo.join(', ')} only`;
  }
  const { fewest, most, within } = SHAPE_EXCEPTIONS[id] ?? SHAPE;
  for (const count of [beats.length, losesTo.length]) {
    if (count < fewest || count > most) return `needs ${fewest}-${most} counters each way`;
  }
  return Math.abs(beats.length - losesTo.length) > within
    ? `wins and losses must be within ${within}`
    : undefined;
}

/**
 * From best to worst. Only `miss` fails the counter-map target; `short` is a pair inside its floor
 * but outside its target (printed as a WARN).
 */
export type CounterVerdict = 'ok' | 'warn' | 'short' | 'near' | 'miss';

/** How `pnpm balance` prints each verdict: `short` is a WARN, only MISS fails. */
export const VERDICT_LABEL: Readonly<Record<CounterVerdict, string>> = {
  ok: 'ok  ',
  warn: 'WARN',
  short: 'WARN',
  near: 'NEAR',
  miss: 'MISS',
};

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
    const { counter, counterFloor } = COUNTER_BANDS;
    return inBand(entry.intended === 'x' ? xRate : yRate, counter, counterFloor, nearWithin);
  }
  return worse(
    inBand(xRate, even, evenFloor, nearWithin),
    inBand(yRate, even, evenFloor, nearWithin),
  );
}

/**
 * True when a pair is outside its final floor (ADR 0045, group 4): a counter outside 62-78%, or an
 * even pair with a side above 62% (it is a counter, so label it one) or under 22%. No noise
 * allowance: `pnpm balance` lists these, and a full run must have none.
 */
export function outsideFinalBand(entry: CounterEntry, xRate: number, yRate: number): boolean {
  const out = (rate: number, [low, high]: readonly [number, number]) =>
    rate < low - EDGE_EPSILON || rate > high + EDGE_EPSILON;
  if (entry.intended === 'even') {
    return out(xRate, COUNTER_BANDS.evenFloor) || out(yRate, COUNTER_BANDS.evenFloor);
  }
  return out(entry.intended === 'x' ? xRate : yRate, COUNTER_BANDS.counterFloor);
}

/**
 * True when an even pair has a side in the grey zone, above 58% but not over the 62% a counter
 * needs: shown as even, counted and warned about by `pnpm balance` (ADR 0045, group 4).
 */
export function inGreyZone(entry: CounterEntry, xRate: number, yRate: number): boolean {
  const top = Math.max(xRate, yRate);
  return (
    entry.intended === 'even' &&
    top > COUNTER_BANDS.greyFrom + EDGE_EPSILON &&
    top <= COUNTER_BANDS.counterFloor[0] + EDGE_EPSILON
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

/** One measured pair: each side's win rate (draws count as games). */
interface MeasuredPair {
  readonly x: string;
  readonly y: string;
  readonly xRate: number;
  readonly yRate: number;
}

/**
 * Every shape problem among `ids` in a run, as "ball: problem". A full run judges the measured
 * counters (62% or more, the same seeds the map was labelled from); a reduced run (CI's 150 seeds)
 * is too noisy to call a pair near 62%, so it judges the map's counters, each already checked
 * against its band.
 */
export function shapeProblems(
  ids: readonly string[],
  pairs: readonly MeasuredPair[],
  fromMap: boolean,
): string[] {
  const counterAt = COUNTER_BANDS.counterFloor[0] - EDGE_EPSILON;
  return ids.flatMap((id) => {
    const beats: string[] = [];
    const losesTo: string[] = [];
    for (const { x, y, xRate, yRate } of pairs) {
      if (x !== id && y !== id) continue;
      const other = x === id ? y : x;
      const [own, theirs] = x === id ? [xRate, yRate] : [yRate, xRate];
      const entry = fromMap ? counterFor(x, y) : undefined;
      const winner =
        entry === undefined || entry.intended === 'even'
          ? undefined
          : entry.intended === 'x'
            ? entry.x
            : entry.y;
      if (fromMap ? winner === id : own >= counterAt) beats.push(other);
      if (fromMap ? winner === other : theirs >= counterAt) losesTo.push(other);
    }
    const problem = shapeProblem(id, beats, losesTo);
    return problem === undefined ? [] : [`${id}: ${problem}`];
  });
}
