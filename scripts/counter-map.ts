// Checks for the counter map (ADR 0010, 0073, 0076): the band each level's win rate must land in,
// the hard limits on each ball's strong counters, and the shape (a warning). The map itself is data in src/sim/counter-map.ts (a bot reads it); it is
// re-exported here for the balance script and its tests.
import { counterFor, type CounterEntry, type Level } from '../src/sim/counter-map.ts';

export {
  COUNTER_MAP,
  counterFor,
  type CounterEntry,
  type Intended,
  type Level,
} from '../src/sim/counter-map.ts';

/** A pair's level as a run measures it: a strong counter, an edge, or even (ADR 0073). */
export type Measured = Level | 'even';

/**
 * Each level's band, as the favoured side's win rate over all games (draws count as games, as
 * everywhere in `pnpm balance`); for an even pair, the better side's. One rule labels every pair
 * (`measuredOf`): 65% or more is a strong counter, 58% up to 65% an edge, under 58% even. The
 * bands meet with no gap and no grey zone, so in a full run a pair outside its label's band is
 * mislabelled: relabel it (with a reason) or tune it.
 * - Outside `low`-`high` fails (MISS). A strong counter over 78% is too steep.
 * - Inside the band but outside `aim` warns (WARN, passes): a strong counter at 65-68% or 75-78%,
 *   an edge within 1 point of 58% or 65%, an even pair with a side at 55-58%.
 */
export const LEVEL_BANDS: Readonly<
  Record<
    Measured,
    {
      readonly low: number;
      readonly high: number;
      /** The band stops short of `high`: the next level starts there. */
      readonly highOpen: boolean;
      readonly aim: readonly [number, number];
    }
  >
> = {
  strong: { low: 0.65, high: 0.78, highOpen: false, aim: [0.68, 0.75] },
  edge: { low: 0.58, high: 0.65, highOpen: true, aim: [0.59, 0.64] },
  even: { low: 0, high: 0.58, highOpen: true, aim: [0, 0.55] },
};

/**
 * Win rates are ratios of whole counts, so a rate exactly on a line can land a hair either side of
 * it in floating point. This tolerance puts such a rate on the line, the same way everywhere.
 */
const EDGE_EPSILON = 1e-9;

/** The level a run measures for a pair, from its better side's win rate. */
export function measuredOf(top: number): Measured {
  if (top >= LEVEL_BANDS.strong.low - EDGE_EPSILON) return 'strong';
  return top >= LEVEL_BANDS.edge.low - EDGE_EPSILON ? 'edge' : 'even';
}

/** Hard limit on top of the map: no side of any matchup wins less than this (ADR 0045, group 4). */
export const HARD_WORST_MATCHUP = 0.22;

/**
 * Hard limits on a ball's strong counters (owner's decision 2026-11-21, ADR 0076). The shape below
 * is a warning; these fail `pnpm balance`:
 * - `most`: no ball beats or loses to more than 6 balls outright, so no pick is a near-certain win
 *   or loss against a fifth of the roster.
 * - `newFewest`: every ball added after ruleset 22 beats at least 2 balls outright and loses to at
 *   least 2, so it has real "pick this against that" matchups and isn't flat.
 */
export const STRONG_LIMITS = { most: 6, newFewest: 2 } as const;

/**
 * The 28 balls of ruleset 22, added before `STRONG_LIMITS.newFewest` (ADR 0076). Five have fewer
 * than 2 on a side: the Brawler (the even pick), the Titan, the Quake, the Spider and the Slime.
 * Never add a ball to this list.
 */
export const BEFORE_THE_FLOOR: readonly string[] = [
  'brawler',
  'speedster',
  'vampire',
  'archer',
  'storm',
  'frost',
  'thorns',
  'venom',
  'berserker',
  'sniper',
  'quake',
  'magnet',
  'ghost',
  'necromancer',
  'chrono',
  'titan',
  'inferno',
  'boomerang',
  'bomber',
  'spartan',
  'bloom',
  'hex',
  'spider',
  'battery',
  'slime',
  'balloon',
  'banshee',
  'kraken',
];

/**
 * Over `STRONG_LIMITS.most` when the limit came in (ruleset 22), each allowed exactly its count:
 * one more fails. Drop the entry once the ball is back under the limit (ADR 0076).
 * - Vampire, 7 losses: it heals only from its bumps, so seven balls that hit without a touch beat
 *   it. An ability tweak, not a number (docs/vision.md).
 */
export const OVER_THE_LIMIT: Readonly<
  Record<string, { readonly wins?: number; readonly losses?: number }>
> = {
  vampire: { losses: 7 },
};

/**
 * Which hard limit a ball's strong counters (the balls it beats and loses to outright) break, or
 * undefined when they break none.
 */
export function counterProblem(
  id: string,
  beats: readonly string[],
  losesTo: readonly string[],
): string | undefined {
  const over = OVER_THE_LIMIT[id];
  for (const [side, count, most] of [
    ['wins', beats.length, over?.wins ?? STRONG_LIMITS.most],
    ['losses', losesTo.length, over?.losses ?? STRONG_LIMITS.most],
  ] as const) {
    if (count > most) return `${String(count)} strong ${side}, at most ${String(most)}`;
  }
  const fewest = STRONG_LIMITS.newFewest;
  if (BEFORE_THE_FLOOR.includes(id) || (beats.length >= fewest && losesTo.length >= fewest)) {
    return undefined;
  }
  return `a new ball needs ${String(fewest)}+ strong wins and losses, has ${String(beats.length)}/${String(losesTo.length)}`;
}

/**
 * The even pick (docs/vision.md): even against nearly everyone, with exactly these strong
 * counters, so the shape doesn't warn on it. The Brawler, the plain bump, loses to the Thorns
 * (reflection scales with the hit, ADR 0013) and beats nobody: it is the plain default (ADR 0049).
 * The Magnet was the other until ruleset 18 (ADR 0058). Adding one is a design decision.
 */
export const EVEN_PICKS: Readonly<
  Record<string, { readonly beats: readonly string[]; readonly losesTo: readonly string[] }>
> = {
  brawler: { beats: [], losesTo: ['thorns'] },
};

/**
 * The shape every ball aims for (ADR 0045 group 4, ADR 0073), counting strong counters only: 2-4
 * it beats and 2-4 it loses to, the two counts within 1, so every pick has a clear strength and a
 * clear weakness. A warning since ADR 0076, not a failure: players wouldn't feel the difference,
 * and "no room" was blocking good new balls. The hard limits are `STRONG_LIMITS`. Edges aren't
 * counted: a small lean a player can't plan a pick around.
 */
export const SHAPE = { fewest: 2, most: 4, within: 1 } as const;

/**
 * A fifth strong counter on one side doesn't warn when it comes from the same visible mechanic as
 * the others there. Each names that mechanic.
 * - The Bloom: any hit shuts the bud, so every ball that hits it often beats it (ADR 0050).
 */
export const FIFTH_FROM_ONE_MECHANIC: Readonly<
  Record<string, { readonly side: 'wins' | 'losses'; readonly mechanic: string }>
> = {
  bloom: { side: 'losses', mechanic: 'any hit shuts the bud' },
};

/**
 * How a ball is off the shape, given the balls it beats and loses to outright, or undefined when
 * it fits: an even pick must have exactly its listed counters, every other ball SHAPE (with its
 * fifth, if any). A warning (ADR 0076).
 */
export function shapeWarning(
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
  const counts = `${String(beats.length)}/${String(losesTo.length)}`;
  const fifth = FIFTH_FROM_ONE_MECHANIC[id]?.side;
  for (const [side, count] of [
    ['wins', beats.length],
    ['losses', losesTo.length],
  ] as const) {
    const most = fifth === side ? SHAPE.most + 1 : SHAPE.most;
    if (count < SHAPE.fewest || count > most) {
      return `${counts}, the shape wants ${String(SHAPE.fewest)}-${String(most)} strong ${side}`;
    }
  }
  return Math.abs(beats.length - losesTo.length) > SHAPE.within
    ? `${counts}, the shape wants wins and losses within ${String(SHAPE.within)}`
    : undefined;
}

/** From best to worst. Only `miss` fails; `near` is the CI check's noise allowance. */
export type CounterVerdict = 'ok' | 'warn' | 'near' | 'miss';

/** How `pnpm balance` prints each verdict. */
export const VERDICT_LABEL: Readonly<Record<CounterVerdict, string>> = {
  ok: 'ok  ',
  warn: 'WARN',
  near: 'NEAR',
  miss: 'MISS',
};

/** A label's verdict for the rate that matters to it. */
function inBand(rate: number, level: Measured, nearWithin: number): CounterVerdict {
  const { low, high, highOpen, aim } = LEVEL_BANDS[level];
  const tooLow = rate < low - EDGE_EPSILON;
  const tooHigh = highOpen ? rate >= high - EDGE_EPSILON : rate > high + EDGE_EPSILON;
  if (tooLow || tooHigh) {
    const outside = tooLow ? low - rate : rate - high;
    return nearWithin > 0 && outside <= nearWithin + EDGE_EPSILON ? 'near' : 'miss';
  }
  return rate < aim[0] - EDGE_EPSILON || rate > aim[1] + EDGE_EPSILON ? 'warn' : 'ok';
}

/** The level a map entry labels its pair with. */
export const labelOf = (entry: CounterEntry): Measured =>
  entry.intended === 'even' ? 'even' : entry.level;

/**
 * Checks one pair's win rates (`xRate` for the entry's x, `yRate` for its y) against its label's
 * band: a counter by its favoured side's rate, an even pair by its better side's. `nearWithin` is
 * how far outside still passes as NEAR: none in a full run (the label and the check read the same
 * fights), `ciAllowance` for CI's smaller sample.
 */
export function checkCounter(
  entry: CounterEntry,
  xRate: number,
  yRate: number,
  nearWithin = 0,
): CounterVerdict {
  const rate =
    entry.intended === 'even' ? Math.max(xRate, yRate) : entry.intended === 'x' ? xRate : yRate;
  return inBand(rate, labelOf(entry), nearWithin);
}

/**
 * The NEAR allowance for a reduced run (`pnpm balance --ci`): three standard errors of a pair's
 * win rate over `games` games (at most 0.5 / sqrt(games)). A sample that small is noisy, so the
 * CI check fails only on a clear miss of the map's labels; a pair it lets through near a line is
 * for a full `pnpm balance` to judge. The seeds are fixed, so the result is the same on every
 * run: it can't flake, only miss a borderline pair.
 */
export function ciAllowance(games: number): number {
  return (3 * 0.5) / Math.sqrt(games);
}

/** One measured pair: each side's win rate (draws count as games). */
interface MeasuredPair {
  readonly x: string;
  readonly y: string;
  readonly xRate: number;
  readonly yRate: number;
}

/** A ball's strong counters in a run: the balls it beats and loses to outright. */
export interface StrongCounters {
  readonly id: string;
  readonly beats: readonly string[];
  readonly losesTo: readonly string[];
}

/**
 * Each of `ids`' strong counters in a run. A full run reads the measured levels (the same seeds
 * the map was labelled from); a reduced run (CI's 150 seeds) is too noisy to call a pair near 65%,
 * so it reads the map's strong counters, each already checked against its band.
 */
export function strongCountersIn(
  ids: readonly string[],
  pairs: readonly MeasuredPair[],
  fromMap: boolean,
): StrongCounters[] {
  const strong = (rate: number) => measuredOf(rate) === 'strong';
  return ids.map((id) => {
    const beats: string[] = [];
    const losesTo: string[] = [];
    for (const { x, y, xRate, yRate } of pairs) {
      if (x !== id && y !== id) continue;
      const other = x === id ? y : x;
      const [own, theirs] = x === id ? [xRate, yRate] : [yRate, xRate];
      const entry = fromMap ? counterFor(x, y) : undefined;
      const strongWinner =
        entry === undefined || entry.intended === 'even' || entry.level !== 'strong'
          ? undefined
          : entry.intended === 'x'
            ? entry.x
            : entry.y;
      if (fromMap ? strongWinner === id : strong(own)) beats.push(other);
      if (fromMap ? strongWinner === other : strong(theirs)) losesTo.push(other);
    }
    return { id, beats, losesTo };
  });
}

/** Every "ball: finding" that `judge` (`counterProblem` or `shapeWarning`) makes of `counters`. */
export function findingsIn(
  counters: readonly StrongCounters[],
  judge: (id: string, beats: readonly string[], losesTo: readonly string[]) => string | undefined,
): string[] {
  return counters.flatMap(({ id, beats, losesTo }) => {
    const finding = judge(id, beats, losesTo);
    return finding === undefined ? [] : [`${id}: ${finding}`];
  });
}
