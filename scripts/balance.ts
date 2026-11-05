// Plays every matchup headlessly with the real simulation and prints a balance matrix, ability
// impact and win-rate sensitivity. Matchups run across all CPU cores; results are identical to a
// serial run (--serial), because each job is deterministic and results are printed in job order.
// Usage: pnpm balance [seeds] [--ball <id>] [--serial] [--ci]
//   seeds   per slot order, default 500 (seeds 0..N-1, so results reproduce)
//   --ball  only that ball's matchups and its mirror, for adding or tuning one ball
//   --ci    the reduced check CI runs (pnpm balance:ci): no sensitivity runs, and a counter-map
//           allowance scaled to the sample, so only a clear miss fails
// The elapsed time goes to stderr, so stdout can be diffed between runs. Exits with 1 when any
// target is a MISS.
import { BALLS } from '../src/sim/balls/index.ts';
import type { BallDefinition } from '../src/sim/types.ts';
import { parseBalanceArgs, USAGE } from './balance-args.ts';
import { runJobs, type PairJob } from './balance-jobs.ts';
import {
  checkCounter,
  ciAllowance,
  COUNTER_BANDS,
  counterFor,
  HARD_WORST_MATCHUP,
  type CounterVerdict,
} from './counter-map.ts';
import { median, withMaxHealth, type BallTotals, type PairResult } from './balance-stats.ts';

const SENSITIVITY_FACTORS = [0.95, 1.05] as const;

/** Balance targets; the summary marks each one as met or not. */
const TARGETS = {
  ballWinRate: [0.4, 0.6],
  /** Counters are allowed, but must stay soft: no matchup worse than this for either side. */
  worstMatchup: 0.2,
  drawRate: 0.05,
  medianSeconds: [12, 30],
  /**
   * Largest win-rate swing, in points, from a ±5% change to one ball's max health. Above
   * `warn` is worth a look; above `fail` is a miss. The gap allows for ±2-3 points of noise.
   */
  sensitivity: { warn: 15, fail: 20 },
  /** Average healing per match as a share of max health, per ball id. */
  minHealShare: { vampire: 0.25 },
} as const;

const pct = (part: number, whole = 1): string =>
  `${((part / whole) * 100).toFixed(1)}%`.padStart(6);
const signedPct = (value: number): string => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
const check = (ok: boolean): string => (ok ? 'ok  ' : 'MISS');
const grade = (value: number, warn: number, fail: number): string =>
  value > fail ? 'MISS' : value > warn ? 'WARN' : 'ok  ';

const options = parseBalanceArgs(
  process.argv.slice(2),
  BALLS.map((ball) => ball.id),
);
if ('error' in options) {
  console.error(options.error);
  console.error(USAGE);
  process.exit(1);
}
const { seeds, ballId, serial, ci } = options;
/** How far outside a counter-map band still passes (NEAR). */
const nearWithin = ci ? ciAllowance(seeds * 2) : COUNTER_BANDS.nearWithin;
const sensitivityFactors = ci ? [] : SENSITIVITY_FACTORS;
const started = performance.now();

// Every non-mirror pair once (x before y in roster order), or only the chosen ball's.
const pairs = BALLS.flatMap((x, i) => BALLS.slice(i + 1).map((y) => [x, y] as const)).filter(
  ([x, y]) => ballId === undefined || x.id === ballId || y.id === ballId,
);
const mirrors = BALLS.filter((ball) => ballId === undefined || ball.id === ballId);
const focus = BALLS.filter((ball) => ballId === undefined || ball.id === ballId);

// Jobs in print order: per pair the base run, then each ball nudged by each factor; then mirrors.
const job = (x: string, y: string, xHealth = 1, yHealth = 1): PairJob => ({
  x,
  y,
  xHealth,
  yHealth,
  seeds,
});
const jobs: PairJob[] = [];
for (const [x, y] of pairs) {
  jobs.push(job(x.id, y.id));
  for (const index of [0, 1] as const) {
    for (const factor of sensitivityFactors) {
      jobs.push(index === 0 ? job(x.id, y.id, factor) : job(x.id, y.id, 1, factor));
    }
  }
}
for (const ball of mirrors) jobs.push(job(ball.id, ball.id));
const results = await runJobs(jobs, serial);
let cursor = 0;
const nextResult = (): PairResult => {
  const result = results[cursor++];
  if (result === undefined) throw new Error('Ran out of balance results');
  return result;
};

const ballTotals = new Map<string, BallTotals & { games: number; wins: number }>(
  BALLS.map((ball) => [
    ball.id,
    { contactDamage: 0, abilityDamage: 0, healed: 0, games: 0, wins: 0 },
  ]),
);
const lengths: number[] = [];
let draws = 0;
let games = 0;
let worstShare = 1;
let worstSensitivity = 0;

function record(ball: BallDefinition, result: PairResult, index: 0 | 1): void {
  const totals = ballTotals.get(ball.id);
  const own = result.totals[index];
  if (totals === undefined) return;
  totals.contactDamage += own.contactDamage;
  totals.abilityDamage += own.abilityDamage;
  totals.healed += own.healed;
  totals.games += result.games;
  totals.wins += result.wins[index];
}

console.log(`BallBattle balance: ${seeds} seeds per slot order (seeds 0-${seeds - 1})\n`);
if (ci) {
  console.log(
    `  CI check: no sensitivity runs; a counter-map pair fails only ${(nearWithin * 100).toFixed(1)} pts or more outside its band.\n`,
  );
}
if (ballId !== undefined) {
  console.log(`  Only ${ballId}'s matchups and mirror; targets are checked for ${ballId} only.\n`);
}
console.log(
  `  ${'Matchup'.padEnd(24)} ${'Wins'.padEnd(15)}  Draw   Median  Sensitivity (±5% health)`,
);
const sensitivityLines: string[] = [];
const counterLines: string[] = [];
let counterMapOk = true;

const VERDICT_LABEL: Readonly<Record<CounterVerdict, string>> = {
  ok: 'ok  ',
  warn: 'WARN',
  near: 'NEAR',
  miss: 'MISS',
};

/**
 * One counter-map line for a pair. Only MISS fails the target: WARN (in band, near an edge) and
 * NEAR (just outside, within the noise allowance) pass.
 */
function counterLine(x: BallDefinition, y: BallDefinition, base: PairResult): string {
  const entry = counterFor(x.id, y.id);
  if (entry === undefined) {
    counterMapOk = false;
    return `  MISS ${`${x.name} vs ${y.name}`.padEnd(24)} not in the counter map`;
  }
  // Rates for the entry's own x and y, whichever order the matrix plays them in.
  const xRate = base.wins[entry.x === x.id ? 0 : 1] / base.games;
  const yRate = base.wins[entry.x === x.id ? 1 : 0] / base.games;
  const verdict = checkCounter(entry, xRate, yRate, nearWithin);
  if (verdict === 'miss') counterMapOk = false;
  const name = (id: string) => BALLS.find((ball) => ball.id === id)?.name ?? id;
  const intended =
    entry.intended === 'even'
      ? 'even'
      : `${name(entry.intended === 'x' ? entry.x : entry.y)} favoured`;
  const rates =
    entry.intended === 'even'
      ? `${pct(xRate).trim()} / ${pct(yRate).trim()}`
      : pct(entry.intended === 'x' ? xRate : yRate).trim();
  return `  ${VERDICT_LABEL[verdict]} ${`${name(entry.x)} vs ${name(entry.y)}`.padEnd(24)} ${intended.padEnd(20)} ${rates}`;
}

for (const [x, y] of pairs) {
  const base = nextResult();
  record(x, base, 0);
  record(y, base, 1);
  draws += base.draws;
  games += base.games;
  lengths.push(...base.lengths);
  const xRate = base.wins[0] / base.games;
  const own = (ball: BallDefinition, share: number) =>
    ballId === undefined || ball.id === ballId ? share : 1;
  worstShare = Math.min(worstShare, own(x, xRate), own(y, base.wins[1] / base.games));

  // Each ball's max health nudged by ±5% on the same seeds: how far does x's win rate move?
  let swing = 0;
  const details: string[] = [];
  for (const ball of [x, y]) {
    for (const factor of sensitivityFactors) {
      const run = nextResult();
      const delta = run.wins[0] / run.games - xRate;
      swing = Math.max(swing, Math.abs(delta));
      const effective = withMaxHealth(ball, factor).maxHealth / ball.maxHealth - 1;
      details.push(
        `${ball.name} ${signedPct(factor - 1)} (effective ${signedPct(effective)}): ${x.name} ${signedPct(delta)}`,
      );
    }
  }
  worstSensitivity = Math.max(worstSensitivity, swing * 100);
  counterLines.push(counterLine(x, y, base));
  sensitivityLines.push(`  ${x.name} vs ${y.name}`, ...details.map((line) => `      ${line}`));

  console.log(
    `  ${`${x.name} vs ${y.name}`.padEnd(24)} ${pct(base.wins[0], base.games)} / ${pct(base.wins[1], base.games)}  ${pct(base.draws, base.games)}  ${median(base.lengths).toFixed(1).padStart(5)} s  max ${(swing * 100).toFixed(1)} pts`,
  );
}

console.log('\n  Mirror matches (not counted in the totals)');
for (const ball of mirrors) {
  const mirror = nextResult();
  console.log(
    `  ${`${ball.name} vs ${ball.name}`.padEnd(24)} ${pct(mirror.wins[0], mirror.games)} / ${pct(mirror.wins[1], mirror.games)}  ${pct(mirror.draws, mirror.games)}  ${median(mirror.lengths).toFixed(1).padStart(5)} s`,
  );
}

const band = ([low, high]: readonly [number, number]) =>
  `${Math.round(low * 100)}-${Math.round(high * 100)}%`;
console.log(
  `\n  Counter map (favoured ${band(COUNTER_BANDS.favoured)}, even ${band(COUNTER_BANDS.even)}; WARN in band within ${COUNTER_BANDS.warnWithin * 100} pts of an edge; NEAR outside by at most ${(nearWithin * 100).toFixed(1)} pts, passes)`,
);
console.log(counterLines.join('\n'));

console.log('\n  Sensitivity detail: win-rate change for the first ball of each matchup');
console.log(sensitivityLines.join('\n'));

console.log('\n  Per ball (non-mirror)        Win rate  Ability dmg share  Healing/match');
let ballsInRange = true;
let healingOk = true;
for (const ball of focus) {
  const totals = ballTotals.get(ball.id);
  if (totals === undefined) continue;
  const rate = totals.wins / totals.games;
  ballsInRange &&= rate >= TARGETS.ballWinRate[0] && rate <= TARGETS.ballWinRate[1];
  const dealt = totals.contactDamage + totals.abilityDamage;
  const healPerMatch = totals.healed / totals.games;
  const minHeal = (TARGETS.minHealShare as Readonly<Record<string, number>>)[ball.id];
  if (minHeal !== undefined) healingOk &&= healPerMatch / ball.maxHealth >= minHeal;
  console.log(
    `  ${ball.name.padEnd(28)} ${pct(rate)}   ${pct(dealt === 0 ? 0 : totals.abilityDamage / dealt).padStart(10)}       ${healPerMatch.toFixed(1).padStart(5)} (${pct(healPerMatch / ball.maxHealth).trim()} of max)`,
  );
}

const drawRate = draws / games;
const medianLength = median(lengths);
console.log(`\n  ${'Draws'.padEnd(28)} ${pct(drawRate)}`);
console.log(`  ${'Median match length'.padEnd(28)} ${medianLength.toFixed(1)} s\n`);

console.log('  Targets');
const who = ballId === undefined ? 'every ball wins' : `${focus[0]?.name ?? ballId} wins`;
console.log(`  ${check(ballsInRange)} ${who} 40-60% overall`);
console.log(
  `  ${check(worstShare >= TARGETS.worstMatchup)} no matchup worse than 20/80 (worst side ${pct(worstShare).trim()})`,
);
console.log(
  `  ${check(worstShare >= HARD_WORST_MATCHUP)} no matchup worse than 25/75 (hard limit, docs/vision.md)`,
);
console.log(`  ${check(counterMapOk)} every pair in its counter-map band`);
console.log(`  ${check(drawRate < TARGETS.drawRate)} draws under 5%`);
console.log(
  `  ${check(medianLength >= TARGETS.medianSeconds[0] && medianLength <= TARGETS.medianSeconds[1])} median match 12-30 s`,
);
const sensitivityGrade = grade(
  worstSensitivity,
  TARGETS.sensitivity.warn,
  TARGETS.sensitivity.fail,
);
console.log(
  ci
    ? '  --   win rates for ±5% health: not measured in the CI check'
    : `  ${sensitivityGrade} win rates move at most 15 pts (warn) / 20 pts (fail) for ±5% health (worst ${worstSensitivity.toFixed(1)} pts)`,
);
const checksVampire = focus.some((ball) => ball.id === 'vampire');
if (checksVampire) {
  console.log(`  ${check(healingOk)} Vampire heals at least 25% of max health per match`);
}
console.error(
  `\n  (${((performance.now() - started) / 1000).toFixed(0)} s, ${serial ? 'serial' : 'parallel'})`,
);
const missed = [
  !ballsInRange,
  worstShare < TARGETS.worstMatchup,
  worstShare < HARD_WORST_MATCHUP,
  !counterMapOk,
  drawRate >= TARGETS.drawRate,
  medianLength < TARGETS.medianSeconds[0] || medianLength > TARGETS.medianSeconds[1],
  !ci && sensitivityGrade === 'MISS',
  checksVampire && !healingOk,
].some(Boolean);
if (missed) {
  console.error('  A target is a MISS.');
  process.exitCode = 1;
}
