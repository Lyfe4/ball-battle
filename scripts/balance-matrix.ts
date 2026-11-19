// Writes the matchup sheet for the current ruleset: docs/balance-matrix.csv (every pair, mirrors
// excluded) and docs/balance-balls.csv (every ball's overall win rate and counters). The same
// fights as `pnpm balance` on the same seeds, without the sensitivity runs, so its numbers match
// docs/balance-summary.md exactly. Run after `pnpm balance:summary` and commit all three.
// Usage: pnpm balance:matrix [seeds] [--serial]   (default 500 seeds per slot order)
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { BALLS } from '../src/sim/balls/index.ts';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';
import { DEFAULT_SEEDS } from './balance-args.ts';
import { ballsCsv, matrixCsv, type PlayedPair } from './balance-csv.ts';
import { runJobs, type PairJob } from './balance-jobs.ts';
import { summarise } from './balance-summary.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { serial: { type: 'boolean', default: false } },
});
const seeds = positionals[0] === undefined ? DEFAULT_SEEDS : Number(positionals[0]);
if (!Number.isInteger(seeds) || seeds < 1) {
  console.error('Usage: pnpm balance:matrix [seeds] [--serial]');
  process.exit(1);
}
const started = performance.now();

const pairs = BALLS.flatMap((x, i) => BALLS.slice(i + 1).map((y) => [x.id, y.id] as const));
const jobs: PairJob[] = pairs.map(([x, y]) => ({ x, y, xHealth: 1, yHealth: 1, seeds }));
const results = await runJobs(jobs, values.serial);

const played: PlayedPair[] = pairs.map(([x, y], index) => {
  const result = results[index];
  if (result === undefined) throw new Error(`No result for ${x} vs ${y}`);
  return {
    x,
    y,
    xWins: result.wins[0],
    yWins: result.wins[1],
    draws: result.draws,
    games: result.games,
  };
});

const totals = new Map(BALLS.map((ball) => [ball.id, { wins: 0, games: 0 }]));
for (const pair of played) {
  for (const [id, wins] of [
    [pair.x, pair.xWins],
    [pair.y, pair.yWins],
  ] as const) {
    const total = totals.get(id);
    if (total === undefined) continue;
    total.wins += wins;
    total.games += pair.games;
  }
}
const summaries = summarise(
  BALLS,
  (id) => {
    const total = totals.get(id);
    return total === undefined || total.games === 0 ? 0 : total.wins / total.games;
  },
  played.map((pair) => ({
    x: pair.x,
    y: pair.y,
    xRate: pair.xWins / pair.games,
    yRate: pair.yWins / pair.games,
  })),
);

const nameOf = (id: string) => BALLS.find((ball) => ball.id === id)?.name ?? id;
writeFileSync('docs/balance-matrix.csv', matrixCsv(played, RULESET_VERSION, nameOf));
writeFileSync('docs/balance-balls.csv', ballsCsv(summaries, RULESET_VERSION));
console.log(
  `Wrote docs/balance-matrix.csv (${String(played.length)} pairs) and docs/balance-balls.csv (${String(summaries.length)} balls): ruleset ${String(RULESET_VERSION)}, ${String(seeds)} seeds per slot order.`,
);
console.error(`(${((performance.now() - started) / 1000).toFixed(0)} s)`);
