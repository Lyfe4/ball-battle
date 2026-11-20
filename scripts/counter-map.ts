// Checks for the counter map (ADR 0010, 0073): the band each level's win rate must land in, and
// each ball's shape. The map itself is data in src/sim/counter-map.ts (a bot reads it); it is
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
 * The even pick, the exception to the shape (docs/vision.md): even against nearly everyone, with
 * exactly these strong counters. The Brawler, the plain bump, loses to the Thorns (reflection
 * scales with the hit, ADR 0013) and beats nobody: it is the plain default (ADR 0049). The Magnet
 * was the other until ruleset 18 (ADR 0058). Adding one is a design decision.
 */
export const EVEN_PICKS: Readonly<
  Record<string, { readonly beats: readonly string[]; readonly losesTo: readonly string[] }>
> = {
  brawler: { beats: [], losesTo: ['thorns'] },
};

/**
 * Every ball's shape (ADR 0045 group 4, ADR 0073), counting strong counters only: 2-4 it beats and
 * 2-4 it loses to, the two counts within 1, so every pick has a clear strength and a clear
 * weakness. An edge is a small lean a player can't plan a pick around, so edges aren't counted;
 * every ball's 45-55% overall keeps them in balance.
 */
export const SHAPE = { fewest: 2, most: 4, within: 1 } as const;

/**
 * A fifth strong counter on one side is allowed (ADR 0073, Batch 2) when it comes from the same
 * visible mechanic as the others there. Each names that mechanic; adding one is a design decision.
 * - The Bloom: any hit shuts the bud, so every ball that hits it often beats it (ADR 0050).
 */
export const FIFTH_FROM_ONE_MECHANIC: Readonly<
  Record<string, { readonly side: 'wins' | 'losses'; readonly mechanic: string }>
> = {
  bloom: { side: 'losses', mechanic: 'any hit shuts the bud' },
};

/** The fewest and most counters a ball may have on one side (the balls it beats, or loses to). */
export interface CounterRange {
  readonly fewest: number;
  readonly most: number;
}

/** How far a ball may stray from SHAPE: its own range of wins, of losses, and their gap. */
export interface ShapeAllowance {
  readonly wins: CounterRange;
  readonly losses: CounterRange;
  readonly within: number;
}

/** The shape a ball must fit unless named in SHAPE_EXCEPTIONS: SHAPE, with its fifth if any. */
export function standardShapeOf(id: string): ShapeAllowance {
  const fifth = FIFTH_FROM_ONE_MECHANIC[id]?.side;
  const range = (side: 'wins' | 'losses'): CounterRange => ({
    fewest: SHAPE.fewest,
    most: fifth === side ? SHAPE.most + 1 : SHAPE.most,
  });
  return { wins: range('wins'), losses: range('losses'), within: SHAPE.within };
}

/** A ball's standard shape with only the numbers its gap needs moved. */
function allow(
  id: string,
  gap: {
    readonly wins?: Partial<CounterRange>;
    readonly losses?: Partial<CounterRange>;
    readonly within?: number;
  },
): ShapeAllowance {
  const standard = standardShapeOf(id);
  return {
    wins: { ...standard.wins, ...gap.wins },
    losses: { ...standard.losses, ...gap.losses },
    within: gap.within ?? standard.within,
  };
}

/**
 * The balls off the strong-only shape today (ruleset 21, ADR 0073, 0074), each allowed exactly its
 * gap (strong wins / losses) and no wider: a ball slipping one more step fails, and a ball moving
 * back towards the shape still passes, so its allowance can then be tightened.
 *
 * All ten wait for ability tweaks or new balls: one-number changes move a ball's whole row (ADR
 * 0010, 0028, 0045), and the three-levels proposal's search plateaued with these still off.
 * - Titan 0/0: growing evens its fights out, weak early and strong late, so no pair leans far.
 * - Ghost 2/1: phased, nothing touches it, so only the Bloom's regrowth beats it outright.
 * - Quake 2/0: small, wide shockwaves chip every ball alike, so no ball beats it outright.
 * - Slime 1/0: its split outlasts one-at-a-time hitters; it beats only the Sniper, and none beat it.
 * - Spider 1/2: webs slow every wall-bouncer a little; only the Speedster, living on walls, loses.
 * - Spartan 1/2: shield and spear trade evenly with most; only the frail Vampire loses outright.
 * - Sniper 1/2: a moving ball often slips its line; only the slow Thorns loses outright.
 * - Inferno 2/1: fire burns every ball alike; only the Berserker, raged by each burn, beats it.
 * - Boomerang 2/4: two light hits a throw beat the Vampire and Bloom; four punish its light bumps.
 * - Vampire 2/5: it heals only from its bumps, so five balls that hit without a touch beat it.
 */
export const SHAPE_EXCEPTIONS: Readonly<Record<string, ShapeAllowance>> = {
  titan: allow('titan', { wins: { fewest: 0 }, losses: { fewest: 0 } }),
  ghost: allow('ghost', { losses: { fewest: 1 } }),
  quake: allow('quake', { losses: { fewest: 0 }, within: 2 }),
  slime: allow('slime', { wins: { fewest: 1 }, losses: { fewest: 0 } }),
  spider: allow('spider', { wins: { fewest: 1 } }),
  spartan: allow('spartan', { wins: { fewest: 1 } }),
  sniper: allow('sniper', { wins: { fewest: 1 } }),
  inferno: allow('inferno', { losses: { fewest: 1 } }),
  boomerang: allow('boomerang', { within: 2 }),
  vampire: allow('vampire', { losses: { most: 5 }, within: 3 }),
};

/**
 * What is wrong with a ball's shape, given the balls it beats and loses to outright (strong
 * counters), or undefined when it fits: an even pick must have exactly its listed counters, every
 * other ball its standard shape or its SHAPE_EXCEPTIONS allowance.
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
  const { wins, losses, within } = SHAPE_EXCEPTIONS[id] ?? standardShapeOf(id);
  for (const [side, count, { fewest, most }] of [
    ['wins', beats.length, wins],
    ['losses', losesTo.length, losses],
  ] as const) {
    if (count < fewest || count > most) return `needs ${fewest}-${most} strong ${side}`;
  }
  return Math.abs(beats.length - losesTo.length) > within
    ? `strong wins and losses must be within ${within}`
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

/**
 * Every shape problem among `ids` in a run, as "ball: problem", counting strong counters only. A
 * full run judges the measured levels (the same seeds the map was labelled from); a reduced run
 * (CI's 150 seeds) is too noisy to call a pair near 65%, so it judges the map's strong counters,
 * each already checked against its band.
 */
export function shapeProblems(
  ids: readonly string[],
  pairs: readonly MeasuredPair[],
  fromMap: boolean,
): string[] {
  const strong = (rate: number) => measuredOf(rate) === 'strong';
  return ids.flatMap((id) => {
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
    const problem = shapeProblem(id, beats, losesTo);
    return problem === undefined ? [] : [`${id}: ${problem}`];
  });
}
