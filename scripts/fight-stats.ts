// Fight length, collisions per match, and projectile / zone hit rates for every pair on today's
// random start, across all cores (used in docs/experiments/bigger-balls-experiment.md). Writes JSON and prints a
// summary.
// Usage: node scripts/fight-stats.ts --out <file> [--seeds N]   (default 500 per slot order)
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { BALLS } from '../src/sim/balls/index.ts';
import { STANDARD_BALL_RADIUS, TICK_RATE } from '../src/sim/constants.ts';
import type { FightResult, FightTask } from './fight-stats-play.ts';
import { runPool } from './worker-pool.ts';

const { values } = parseArgs({ options: { out: { type: 'string' }, seeds: { type: 'string' } } });
if (values.out === undefined) {
  console.error('Usage: node scripts/fight-stats.ts --out <file> [--seeds N]');
  process.exit(1);
}
const seeds = Number(values.seeds ?? 500);
const ids = BALLS.map((ball) => ball.id);
const pairs = ids.flatMap((x, i) => ids.slice(i + 1).map((y) => [x, y] as const));
const SLICE = 50;
const tasks: FightTask[] = pairs.flatMap(([p, q]) =>
  Array.from({ length: Math.ceil(seeds / SLICE) }, (_, s) => ({
    p,
    q,
    firstSeed: s * SLICE,
    endSeed: Math.min(seeds, (s + 1) * SLICE),
  })),
);
const results = await runPool<FightResult>(
  new URL('./fight-stats-worker.ts', import.meta.url),
  tasks,
);

const lengths: number[] = [];
let collisions = 0;
let timeouts = 0;
const perBall = new Map(ids.map((id) => [id, { fired: 0, hit: 0, zones: 0, zoneHits: 0 }]));
results.forEach((result, index) => {
  const task = tasks[index];
  if (task === undefined) return;
  lengths.push(...result.lengths);
  collisions += result.collisions;
  timeouts += result.timeouts;
  [task.p, task.q].forEach((id, side) => {
    const total = perBall.get(id);
    const own = result.shots[side === 0 ? 0 : 1];
    if (total === undefined) return;
    total.fired += own.fired;
    total.hit += own.hit;
    total.zones += own.zones;
    total.zoneHits += own.zoneHits;
  });
});
lengths.sort((a, b) => a - b);
const quantile = (q: number) => (lengths[Math.floor(q * (lengths.length - 1))] ?? 0) / TICK_RATE;
const summary = {
  radius: STANDARD_BALL_RADIUS,
  games: lengths.length,
  seconds: {
    p10: quantile(0.1),
    p25: quantile(0.25),
    median: quantile(0.5),
    p75: quantile(0.75),
    p90: quantile(0.9),
  },
  meanSeconds: lengths.reduce((s, v) => s + v, 0) / lengths.length / TICK_RATE,
  collisionsPerMatch: collisions / lengths.length,
  collisionsPerSecond: collisions / (lengths.reduce((s, v) => s + v, 0) / TICK_RATE),
  timeoutShare: timeouts / lengths.length,
  perBall: Object.fromEntries(
    [...perBall].map(([id, s]) => [
      id,
      {
        projectileHitRate: s.fired === 0 ? null : s.hit / s.fired,
        zoneHitRate: s.zones === 0 ? null : s.zoneHits / s.zones,
      },
    ]),
  ),
};
writeFileSync(values.out, JSON.stringify(summary, undefined, 2));
console.log(JSON.stringify(summary, undefined, 2));
