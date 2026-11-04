// The intended counter map (ADR 0009, docs/vision.md): for every pair of balls, which side should
// be favoured, or whether it should be even. `pnpm balance` checks each pair against its band.
// A new ball must add one entry per existing ball; a test checks the map covers every pair.

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
 * Favoured: the favoured side wins 58-70%. Even: both sides win 45-55%. A result within
 * `warnWithin` of a band edge is flagged, since one pair at 500 seeds has about ±1.6 points of
 * standard error.
 */
export const COUNTER_BANDS = {
  favoured: [0.58, 0.7],
  even: [0.45, 0.55],
  warnWithin: 0.02,
} as const;

/** Hard limit on top of the map: no side of any matchup wins less than this (docs/vision.md). */
export const HARD_WORST_MATCHUP = 0.25;

/**
 * Two soft triangles, Speedster > Archer > Vampire > Speedster and Brawler > Speedster > Storm >
 * Brawler; every other pair is even. Every ball has a favoured and an unfavoured matchup.
 */
export const COUNTER_MAP: readonly CounterEntry[] = [
  {
    x: 'speedster',
    y: 'archer',
    intended: 'x',
    reason: 'Closes the distance faster than arrows can stop it.',
  },
  {
    x: 'archer',
    y: 'vampire',
    intended: 'x',
    reason: 'Chips the Vampire from range, where lifesteal cannot answer.',
  },
  {
    x: 'vampire',
    y: 'speedster',
    intended: 'x',
    reason: 'Outlasts the burst by healing off every exchange.',
  },
  {
    x: 'brawler',
    y: 'speedster',
    intended: 'x',
    reason: 'Every Brawler hit lands at full weight; the Speedster needs bounces to match one.',
  },
  {
    x: 'speedster',
    y: 'storm',
    intended: 'x',
    reason: 'The fastest target outruns the most warnings.',
  },
  {
    x: 'storm',
    y: 'brawler',
    intended: 'x',
    reason: 'No ability and below-average speed: the Brawler walks into zones.',
  },
  {
    x: 'brawler',
    y: 'vampire',
    intended: 'even',
    reason: 'Burst against sustain: the biggest hits are also the biggest heals.',
  },
  {
    x: 'brawler',
    y: 'archer',
    intended: 'even',
    reason: 'The Archer kites; the Brawler ends it in two clean hits once it connects.',
  },
  {
    x: 'vampire',
    y: 'storm',
    intended: 'even',
    reason: 'Lightning out-damages lifesteal at range; the Vampire heals it back up close.',
  },
  {
    x: 'archer',
    y: 'storm',
    intended: 'even',
    reason: 'Two ranged balls: arrows hit more often, a strike hits harder.',
  },
];

export type CounterVerdict = 'ok' | 'warn' | 'miss';

/** The map entry for a pair, whichever order the pair comes in. */
export function counterFor(a: string, b: string): CounterEntry | undefined {
  return COUNTER_MAP.find(
    (entry) => (entry.x === a && entry.y === b) || (entry.x === b && entry.y === a),
  );
}

function inBand(rate: number, [low, high]: readonly [number, number]): CounterVerdict {
  if (rate < low || rate > high) return 'miss';
  const margin = COUNTER_BANDS.warnWithin;
  return rate < low + margin || rate > high - margin ? 'warn' : 'ok';
}

/**
 * Checks one pair's win rates (`xRate` for the entry's x, `yRate` for its y) against its band.
 * For an even pair both sides must be in the even band; the worse verdict counts.
 */
export function checkCounter(entry: CounterEntry, xRate: number, yRate: number): CounterVerdict {
  if (entry.intended === 'x') return inBand(xRate, COUNTER_BANDS.favoured);
  if (entry.intended === 'y') return inBand(yRate, COUNTER_BANDS.favoured);
  const verdicts = [inBand(xRate, COUNTER_BANDS.even), inBand(yRate, COUNTER_BANDS.even)];
  if (verdicts.includes('miss')) return 'miss';
  return verdicts.includes('warn') ? 'warn' : 'ok';
}
