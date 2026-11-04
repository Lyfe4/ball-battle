// Plays every matchup headlessly with the real simulation and prints a balance matrix, ability
// impact and win-rate sensitivity.
// Usage: pnpm balance [seeds]   (default 500 per slot order; seeds 0..N-1, so results reproduce)
import { BALLS } from '../src/sim/balls/index.ts';
import type { BallDefinition } from '../src/sim/types.ts';
import {
  averageHit,
  median,
  playPair,
  withContactDamage,
  type BallTotals,
  type PairResult,
} from './balance-stats.ts';

const DEFAULT_SEEDS = 500;
const SENSITIVITY_FACTORS = [0.95, 1.05] as const;

/** Balance targets; the summary marks each one as met or not. */
const TARGETS = {
  ballWinRate: [0.4, 0.6],
  worstMatchup: 0.25,
  drawRate: 0.05,
  medianSeconds: [12, 30],
  /**
   * Largest win-rate swing, in points, from a ±5% change to one ball's contact damage. Above
   * `warn` is worth a look; above `fail` is a miss. The gap allows for ±2-3 points of noise.
   */
  sensitivity: { warn: 15, fail: 20 },
  /** Average healing per match as a share of max health, per ball id. */
  minHealShare: { vampire: 0.25 },
} as const;

function parseSeedCount(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_SEEDS;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1) {
    console.error(`Seed count must be a positive integer, got "${raw}".`);
    console.error('Usage: pnpm balance [seeds]');
    process.exit(1);
  }
  return count;
}

const pct = (part: number, whole = 1): string =>
  `${((part / whole) * 100).toFixed(1)}%`.padStart(6);
const signedPct = (value: number): string => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
const check = (ok: boolean): string => (ok ? 'ok  ' : 'MISS');
const grade = (value: number, warn: number, fail: number): string =>
  value > fail ? 'MISS' : value > warn ? 'WARN' : 'ok  ';

const seeds = parseSeedCount(process.argv[2]);
const started = performance.now();
const ballTotals = new Map<string, BallTotals & { games: number; wins: number }>(
  BALLS.map((ball) => [
    ball.id,
    {
      contactDamage: 0,
      abilityDamage: 0,
      healed: 0,
      unclampedHits: 0,
      unclampedHitDamage: 0,
      games: 0,
      wins: 0,
    },
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
console.log(
  `  ${'Matchup'.padEnd(24)} ${'Wins'.padEnd(15)}  Draw   Median  Sensitivity (±5% damage)`,
);
const sensitivityLines: string[] = [];

BALLS.forEach((x, i) => {
  for (const y of BALLS.slice(i + 1)) {
    const base = playPair(x, y, seeds, BALLS);
    record(x, base, 0);
    record(y, base, 1);
    draws += base.draws;
    games += base.games;
    lengths.push(...base.lengths);
    const xRate = base.wins[0] / base.games;
    worstShare = Math.min(worstShare, xRate, base.wins[1] / base.games);

    // Nudge each ball's contact damage by ±5% on the same seeds and see how far x's win rate moves.
    let swing = 0;
    const details: string[] = [];
    for (const [index, ball] of [[0, x] as const, [1, y] as const]) {
      for (const factor of SENSITIVITY_FACTORS) {
        const nudged = withContactDamage(ball, factor);
        const run =
          index === 0 ? playPair(nudged, y, seeds, BALLS) : playPair(x, nudged, seeds, BALLS);
        const delta = run.wins[0] / run.games - xRate;
        swing = Math.max(swing, Math.abs(delta));
        const effective = averageHit(run.totals[index]) / averageHit(base.totals[index]) - 1;
        details.push(
          `${ball.name} ${signedPct(factor - 1)} (effective ${signedPct(effective)}): ${x.name} ${signedPct(delta)}`,
        );
      }
    }
    worstSensitivity = Math.max(worstSensitivity, swing * 100);
    sensitivityLines.push(`  ${x.name} vs ${y.name}`, ...details.map((line) => `      ${line}`));

    console.log(
      `  ${`${x.name} vs ${y.name}`.padEnd(24)} ${pct(base.wins[0], base.games)} / ${pct(base.wins[1], base.games)}  ${pct(base.draws, base.games)}  ${median(base.lengths).toFixed(1).padStart(5)} s  max ${(swing * 100).toFixed(1)} pts`,
    );
  }
});

console.log('\n  Mirror matches (not counted in the totals)');
for (const ball of BALLS) {
  const mirror = playPair(ball, ball, seeds, BALLS);
  console.log(
    `  ${`${ball.name} vs ${ball.name}`.padEnd(24)} ${pct(mirror.wins[0], mirror.games)} / ${pct(mirror.wins[1], mirror.games)}  ${pct(mirror.draws, mirror.games)}  ${median(mirror.lengths).toFixed(1).padStart(5)} s`,
  );
}

console.log('\n  Sensitivity detail: win-rate change for the first ball of each matchup');
console.log(sensitivityLines.join('\n'));

console.log('\n  Per ball (non-mirror)        Win rate  Ability dmg share  Healing/match');
let ballsInRange = true;
let healingOk = true;
for (const ball of BALLS) {
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
console.log(`  ${check(ballsInRange)} every ball wins 40-60% overall`);
console.log(
  `  ${check(worstShare >= TARGETS.worstMatchup)} no matchup worse than 25/75 (worst side ${pct(worstShare).trim()})`,
);
console.log(`  ${check(drawRate < TARGETS.drawRate)} draws under 5%`);
console.log(
  `  ${check(medianLength >= TARGETS.medianSeconds[0] && medianLength <= TARGETS.medianSeconds[1])} median match 12-30 s`,
);
console.log(
  `  ${grade(worstSensitivity, TARGETS.sensitivity.warn, TARGETS.sensitivity.fail)} win rates move at most 15 pts (warn) / 20 pts (fail) for ±5% damage (worst ${worstSensitivity.toFixed(1)} pts)`,
);
console.log(`  ${check(healingOk)} Vampire heals at least 25% of max health per match`);
console.log(`\n  (${((performance.now() - started) / 1000).toFixed(0)} s)`);
