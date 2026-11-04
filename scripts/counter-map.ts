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

/**
 * One soft triangle from the balls' mechanics (Speedster > Archer > Vampire > Speedster), the
 * Storm's place (favoured against the Vampire, unfavoured against the Speedster, even with the
 * Archer), and the Brawler as the safe pick, even against everyone but Thorns, its one designed counter
 * (docs/vision.md, ADR 0013). Frost
 * (ADR 0012) has one favoured and one unfavoured matchup from its mechanics and is even against
 * the rest. Venom (ADR 0014) is favoured against Thorns and unfavoured against the Vampire.
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
    x: 'storm',
    y: 'vampire',
    intended: 'x',
    reason: 'Lightning is ranged damage, which lifesteal cannot answer.',
  },
  {
    x: 'speedster',
    y: 'storm',
    intended: 'x',
    reason: 'The fastest target outruns the most warnings.',
  },
  {
    x: 'archer',
    y: 'storm',
    intended: 'even',
    reason: 'Two ranged balls: arrows hit more often, a strike hits harder.',
  },
  {
    x: 'brawler',
    y: 'speedster',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'brawler',
    y: 'vampire',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'brawler',
    y: 'archer',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'brawler',
    y: 'storm',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'frost',
    y: 'speedster',
    intended: 'x',
    reason:
      'Slowed cuts both Speedster weapons: its speed and the wall bounces that build its stacks.',
  },
  {
    x: 'storm',
    y: 'frost',
    intended: 'x',
    reason: 'The slowest ball is the least likely to leave a lightning warning in time.',
  },
  {
    x: 'brawler',
    y: 'frost',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'frost',
    y: 'vampire',
    intended: 'even',
    reason: 'Slowing does not change a contact trade, and Frost never stops the healing.',
  },
  {
    x: 'frost',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows land on a slow target, but Frost wins the contacts it gets.',
  },
  {
    x: 'thorns',
    y: 'brawler',
    intended: 'x',
    reason: 'The hardest hitter hurts itself the most on the spikes.',
  },
  {
    x: 'archer',
    y: 'thorns',
    intended: 'x',
    reason: 'Arrows never touch the spikes, so they are never reflected.',
  },
  {
    x: 'storm',
    y: 'thorns',
    intended: 'x',
    reason: 'Lightning never touches the spikes, so it is never reflected.',
  },
  {
    x: 'thorns',
    y: 'speedster',
    intended: 'even',
    reason: 'Reflection answers its contact hits, but it hits softly and often.',
  },
  {
    x: 'thorns',
    y: 'vampire',
    intended: 'even',
    reason: 'Reflection hurts the Vampire, but lifesteal heals back part of every trade.',
  },
  {
    x: 'thorns',
    y: 'frost',
    intended: 'even',
    reason: 'Two contact balls: the Frost hits hard into the spikes, but slows Thorns.',
  },
  {
    x: 'venom',
    y: 'thorns',
    intended: 'x',
    reason: 'Poison never touches the spikes, and its light hits leave little to reflect.',
  },
  {
    x: 'vampire',
    y: 'venom',
    intended: 'x',
    reason: 'Lifesteal out-heals the poison: every trade heals back what the poison chipped.',
  },
  {
    x: 'brawler',
    y: 'venom',
    intended: 'even',
    reason: 'Safe pick: solid stats, no matchup decided by mechanics.',
  },
  {
    x: 'venom',
    y: 'speedster',
    intended: 'even',
    reason: 'Poison works between the Speedster bursts, but Venom’s own hits are light.',
  },
  {
    x: 'venom',
    y: 'archer',
    intended: 'even',
    reason: 'Arrows chip Venom from range, but every contact poisons the fragile Archer.',
  },
  {
    x: 'venom',
    y: 'storm',
    intended: 'even',
    reason: 'Lightning outdamages poison per hit, but every Storm contact is poisoned too.',
  },
  {
    x: 'venom',
    y: 'frost',
    intended: 'even',
    reason: 'Long fights feed the poison, but the Frost hits hard and slows Venom.',
  },
];

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
